#!/usr/bin/env bash
#
# Create (if needed) and lock down the private attachments bucket.
#
#   npm run attachments:deploy              # create / repair
#   npm run attachments:deploy -- --destroy # delete the bucket and all files
#
# Every step is idempotent: re-running repairs a hand-edited bucket.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"

for cmd in terraform aws; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "error: '$cmd' not found on PATH" >&2
    exit 1
  }
done

cd "$TF_DIR"

read_output() {
  terraform output -raw "$1" 2>/dev/null || {
    echo "error: could not read '$1' from Terraform." >&2
    echo "  Run 'terraform apply' in infra/terraform first." >&2
    exit 1
  }
}

BUCKET="$(read_output attachments_bucket_name)"
WEB_URL="$(read_output web_url)"
DEV_ORIGIN="$(read_output cors_allow_origin)"
REGION="$(terraform output -raw aws_region 2>/dev/null || echo us-east-1)"

# Always use the Terraform region, not the AWS CLI default region.
AWS=(aws --region "$REGION")

# Check bucket ownership using the current AWS account.
# If permission is denied, set -e stops the script safely.
bucket_status() {
  local existing
  existing="$("${AWS[@]}" s3api list-buckets \
    --query "Buckets[?Name=='$BUCKET'].Name | [0]" \
    --output text)" || {
      echo "error: cannot list S3 buckets; refusing to continue." >&2
      return 1
    }

  if [ "$existing" = "$BUCKET" ]; then
    echo "exists"
  else
    echo "missing"
  fi
}

BUCKET_STATUS="$(bucket_status)"

# ---- teardown -------------------------------------------------------------
if [ "${1:-}" = "--destroy" ]; then
  if [ "$BUCKET_STATUS" = "missing" ]; then
    echo "bucket $BUCKET does not exist. Nothing to do."
    exit 0
  fi

  echo "This permanently deletes s3://$BUCKET and every attachment in it."
  printf 'Type the bucket name to confirm: '
  read -r CONFIRM
  [ "$CONFIRM" = "$BUCKET" ] || {
    echo "aborted."
    exit 1
  }

  "${AWS[@]}" s3 rb "s3://$BUCKET" --force
  echo "deleted s3://$BUCKET"
  exit 0
fi

# ---- bucket ---------------------------------------------------------------
if [ "$BUCKET_STATUS" = "exists" ]; then
  echo "bucket:  $BUCKET (exists)"
else
  echo "bucket:  $BUCKET (creating)"

  # us-east-1 rejects a LocationConstraint; other regions require one.
  if [ "$REGION" = "us-east-1" ]; then
    "${AWS[@]}" s3api create-bucket --bucket "$BUCKET" >/dev/null
  else
    "${AWS[@]}" s3api create-bucket --bucket "$BUCKET" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
fi

# Private: all four Block Public Access switches on.
"${AWS[@]}" s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# ACLs disabled: bucket owner owns every object.
"${AWS[@]}" s3api put-bucket-ownership-controls --bucket "$BUCKET" \
  --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'

# Encrypt at rest.
"${AWS[@]}" s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Refuse plain-HTTP access.
"${AWS[@]}" s3api put-bucket-policy --bucket "$BUCKET" --policy "$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::$BUCKET", "arn:aws:s3:::$BUCKET/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    }
  ]
}
JSON
)"

# CORS for the dev server and deployed site.
"${AWS[@]}" s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "$(cat <<JSON
{
  "CORSRules": [
    {
      "AllowedOrigins": ["$DEV_ORIGIN", "$WEB_URL"],
      "AllowedMethods": ["GET", "POST", "PUT"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
JSON
)"

# Abort incomplete multipart uploads after one day.
"${AWS[@]}" s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "abort-incomplete-multipart",
        "Status": "Enabled",
        "Filter": { "Prefix": "" },
        "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
      }
    ]
  }'

# ---- verify ---------------------------------------------------------------
echo
echo "==> verifying"

PAB="$("${AWS[@]}" s3api get-public-access-block --bucket "$BUCKET" \
  --query 'PublicAccessBlockConfiguration.[BlockPublicAcls,IgnorePublicAcls,BlockPublicPolicy,RestrictPublicBuckets]' \
  --output text)"

# Normalize whitespace before comparison.
PAB="$(echo "$PAB" | xargs)"
echo "public access block: $PAB"

if [ "$PAB" != "True True True True" ]; then
  echo "error: Block Public Access is not fully on." >&2
  exit 1
fi

# An anonymous request must be refused (403), never served.
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
  "https://$BUCKET.s3.$REGION.amazonaws.com/" || true)"

case "$CODE" in
  403)
    echo "anonymous GET: HTTP 403 — bucket is private"
    ;;
  000)
    echo "no response — DNS for a new bucket can take a minute; re-run to verify." >&2
    ;;
  *)
    echo "error: anonymous GET returned HTTP $CODE, expected 403." >&2
    exit 1
    ;;
esac

echo
echo "ready: s3://$BUCKET"
echo "Lambda reads it from the ATTACHMENTS_BUCKET env var (terraform apply sets it)."
