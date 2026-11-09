#!/usr/bin/env bash
#
# Point the frontend at whatever API and Cognito pool Terraform currently owns.
#
#   npm run env:sync
#
# Why this exists: .env is gitignored, so it does not travel with the repo and
# it does not follow Terraform. The API Gateway ID changes every time the API
# is destroyed and recreated, and a stale VITE_API_URL fails in the ugliest
# possible way — the old hostname no longer resolves at all, so the browser
# shows a bare network error with no status code to look up. The Cognito IDs
# change the same way after a rebuild, and a stale one breaks sign-in.
#
# Run this after every `terraform apply` that recreated the API or the pool.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

command -v terraform >/dev/null 2>&1 || { echo "error: terraform not on PATH" >&2; exit 1; }

cd "$REPO_ROOT/infra/terraform"

# .env variable  <-  terraform output
VARS="VITE_API_URL=api_url
VITE_COGNITO_USER_POOL_ID=cognito_user_pool_id
VITE_COGNITO_CLIENT_ID=cognito_user_pool_client_id"

touch "$ENV_FILE"
# A last line with no newline would get the next appended variable glued to it.
if [ -s "$ENV_FILE" ] && [ -n "$(tail -c1 "$ENV_FILE")" ]; then echo >> "$ENV_FILE"; fi
changed=0
while IFS='=' read -r NAME OUTPUT; do
  VALUE="$(terraform output -raw "$OUTPUT" 2>/dev/null)" || {
    echo "error: could not read '$OUTPUT' from Terraform." >&2
    echo "  Run 'terraform apply' in infra/terraform first." >&2
    exit 1
  }
  # Rewrite only this variable's line, so any other local vars survive.
  if grep -q "^$NAME=" "$ENV_FILE"; then
    OLD="$(grep "^$NAME=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
    if [ "$OLD" = "$VALUE" ]; then
      echo "$NAME already current: $VALUE"
      continue
    fi
    # sed -i needs a backup suffix to behave the same on both GNU and BSD sed.
    sed -i.bak "s|^$NAME=.*|$NAME=$VALUE|" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
    echo "$NAME was: $OLD"
    echo "$NAME now: $VALUE"
  else
    printf '%s=%s\n' "$NAME" "$VALUE" >> "$ENV_FILE"
    echo "wrote $NAME=$VALUE"
  fi
  changed=1
done <<< "$VARS"

if [ "$changed" = 1 ]; then
  echo
  echo "Vite only reads .env at startup — restart 'npm run dev' to pick this up."
fi
