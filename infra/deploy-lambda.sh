#!/usr/bin/env bash
#
# Install the Lambda's dependencies, package and deploy it, then check the API.
#
#   npm run lambda:deploy                    # terraform apply asks "yes"
#   npm run lambda:deploy -- -auto-approve   # extra args go to terraform apply
#
# Terraform does the packaging (data.archive_file.lambda in lambda.tf zips
# infra/lambda/companies/) and redeploys only when the zip's hash changes, so
# re-running with no code change is a no-op. What Terraform cannot do is
# install node_modules — skip that and the zip ships without `pg`, and every
# request fails with "Cannot find package 'pg'". So this script runs it first.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAMBDA_DIR="$REPO_ROOT/infra/lambda/companies"
TF_DIR="$REPO_ROOT/infra/terraform"

for cmd in terraform npm curl; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "error: '$cmd' not found on PATH" >&2; exit 1; }
done

# ---- dependencies ----------------------------------------------------------
# npm ci, not npm install: installs exactly what package-lock.json says and
# never rewrites the lockfile, so every run packages the same dependencies.
echo "==> installing Lambda dependencies (npm ci --omit=dev)"
npm ci --omit=dev --no-audit --no-fund --prefix "$LAMBDA_DIR"
[ -f "$LAMBDA_DIR/node_modules/pg/package.json" ] || {
  echo "error: node_modules/pg missing after npm ci — the zip would be broken." >&2
  exit 1
}

# ---- package + deploy ------------------------------------------------------
echo
echo "==> terraform apply (packages infra/lambda/companies -> .build/function.zip)"
cd "$TF_DIR"
terraform apply "$@"

API_URL="$(terraform output -raw api_url)"
FUNCTION="$(terraform output -raw lambda_function_name)"

# ---- verify ----------------------------------------------------------------
# GET /companies is a public route (route-policy.mjs) that goes through the
# Lambda to RDS, so a 200 proves the whole chain, not just API Gateway.
echo
echo "==> checking $API_URL/companies"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$API_URL/companies" || true)"
if [ "$CODE" != "200" ]; then
  echo "HTTP $CODE — API check failed. Logs: CloudWatch /aws/lambda/$FUNCTION" >&2
  exit 1
fi
echo "HTTP 200 — API is live"
echo
echo "deployed: $FUNCTION"
echo "api:      $API_URL"
