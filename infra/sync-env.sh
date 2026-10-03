#!/usr/bin/env bash
#
# Point the frontend at whatever API Gateway URL Terraform currently owns.
#
#   npm run env:sync
#
# Why this exists: .env is gitignored, so it does not travel with the repo and
# it does not follow Terraform. The API Gateway ID changes every time the API
# is destroyed and recreated, and a stale VITE_API_URL fails in the ugliest
# possible way — the old hostname no longer resolves at all, so the browser
# shows a bare network error with no status code to look up.
#
# Run this after every `terraform apply` that recreated the API.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

command -v terraform >/dev/null 2>&1 || { echo "error: terraform not on PATH" >&2; exit 1; }

cd "$REPO_ROOT/infra/terraform"
API_URL="$(terraform output -raw api_url 2>/dev/null)" || {
  echo "error: could not read 'api_url' from Terraform." >&2
  echo "  Run 'terraform apply' in infra/terraform first." >&2
  exit 1
}

# Rewrite only the VITE_API_URL line, so any other local vars survive.
if [ -f "$ENV_FILE" ] && grep -q '^VITE_API_URL=' "$ENV_FILE"; then
  OLD="$(grep '^VITE_API_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
  if [ "$OLD" = "$API_URL" ]; then
    echo "VITE_API_URL already current: $API_URL"
    exit 0
  fi
  # sed -i needs a backup suffix to behave the same on both GNU and BSD sed.
  sed -i.bak "s|^VITE_API_URL=.*|VITE_API_URL=$API_URL|" "$ENV_FILE"
  rm -f "$ENV_FILE.bak"
  echo "was: $OLD"
  echo "now: $API_URL"
else
  printf 'VITE_API_URL=%s\n' "$API_URL" >> "$ENV_FILE"
  echo "wrote VITE_API_URL=$API_URL"
fi

echo
echo "Vite only reads .env at startup — restart 'npm run dev' to pick this up."
