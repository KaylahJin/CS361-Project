#!/usr/bin/env bash
#
# Create (if needed), configure, and publish the frontend's S3 website.
#
#   npm run web:deploy              # build + upload
#   npm run web:deploy -- --destroy # delete the bucket and everything in it
#
# This script owns the bucket, not Terraform — see infra/terraform/s3_web.tf
# for why. Terraform still computes the bucket name and site URL, so the API's
# CORS origin and this script can't disagree.
#
# Every step is idempotent: re-running repairs a hand-edited bucket.
#
# VITE_API_URL is read from Terraform, not .env, because Vite inlines it at
# build time — that makes deploying a stale API URL impossible.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"

for cmd in terraform aws; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "error: '$cmd' not found on PATH" >&2; exit 1; }
done

cd "$TF_DIR"

read_output() {
  terraform output -raw "$1" 2>/dev/null || {
    echo "error: could not read '$1' from Terraform." >&2
    echo "  Run 'terraform apply' in infra/terraform first." >&2
    exit 1
  }
}

BUCKET="$(read_output web_bucket_name)"
WEB_URL="$(read_output web_url)"
REGION="$(terraform output -raw aws_region 2>/dev/null || echo us-east-1)"

# ---- teardown ------------------------------------------------------------
# `terraform destroy` can't remove an unmanaged bucket, so teardown lives here.
if [ "${1:-}" = "--destroy" ]; then
  if ! aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
    echo "bucket $BUCKET does not exist. Nothing to do."
    exit 0
  fi
  echo "This permanently deletes s3://$BUCKET and every file in it."
  printf 'Type the bucket name to confirm: '
  read -r CONFIRM
  [ "$CONFIRM" = "$BUCKET" ] || { echo "aborted."; exit 1; }
  aws s3 rb "s3://$BUCKET" --force
  echo "deleted s3://$BUCKET"
  exit 0
fi

# ---- bucket ---------------------------------------------------------------
if aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  echo "bucket:  $BUCKET (exists)"
else
  echo "bucket:  $BUCKET (creating)"
  # us-east-1 rejects a LocationConstraint; every other region requires one.
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
fi

# Block Public Access silently overrides the policy below — any part left on
# means 403 on every request. Deleting it is idempotent.
aws s3api delete-public-access-block --bucket "$BUCKET"

# ACLs disabled; public read comes from the bucket policy instead. One rule to
# audit, and `aws s3 sync` doesn't need --acl public-read.
aws s3api put-bucket-ownership-controls --bucket "$BUCKET" \
  --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'

# index.html doubles as the 404 document, so adding a router later needs no
# infra change.
aws s3api put-bucket-website --bucket "$BUCKET" --website-configuration \
  '{"IndexDocument":{"Suffix":"index.html"},"ErrorDocument":{"Key":"index.html"}}'

# GetObject only — no ListBucket (would expose a browsable index), no writes.
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET/*"
    }
  ]
}
JSON
)"

# ---- build ----------------------------------------------------------------
API_URL="$(read_output api_url)"
echo "api:     $API_URL"
echo

cd "$REPO_ROOT"
echo "==> building (VITE_API_URL=$API_URL)"
# Exported, not written to .env: a real env var beats .env in Vite, so this is
# what lands in the bundle regardless of someone's local .env.
VITE_API_URL="$API_URL" npm run build

echo
echo "==> uploading hashed assets"
# Two passes, different Cache-Control. Assets are fingerprinted, so a year is
# safe. index.html is not: cached, returning visitors request the old build's
# asset names that --delete removed, and the page comes up blank.
aws s3 sync dist/ "s3://$BUCKET/" \
  --delete \
  --exclude "index.html" \
  --cache-control "public, max-age=31536000, immutable"

echo
echo "==> uploading index.html (no-cache)"
aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-cache, must-revalidate" \
  --content-type "text/html; charset=utf-8"

# ---- verify ---------------------------------------------------------------
# Catch a 403 (public access blocked) or 404 (empty bucket) here, not in a
# teammate's browser.
echo
echo "==> checking $WEB_URL"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$WEB_URL" || echo 000)"
case "$CODE" in
  200) echo "HTTP 200 — site is live" ;;
  403) echo "HTTP 403 — bucket policy is being overridden. Check account-level S3 Block Public Access." >&2; exit 1 ;;
  000) echo "no response — DNS for a new bucket can take a minute; retry the URL in a browser." >&2 ;;
  *)   echo "HTTP $CODE — unexpected. Open $WEB_URL to see what S3 returns." >&2; exit 1 ;;
esac

echo
echo "deployed: $WEB_URL"
echo
echo "The site is HTTP — S3 website endpoints do not serve TLS."
echo "If the company list is empty, check the browser console: a CORS error"
echo "there means the API's allowed origins don't include this bucket."
echo "Fix with 'terraform apply' in infra/terraform."
