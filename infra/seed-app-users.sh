#!/usr/bin/env bash
#
# Seed only the explicitly approved Cognito demo accounts into app_users.
# Unknown accounts, including nobody1@example.com, are never assigned roles.
# Re-runnable: approved accounts are upserted.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"

for cmd in psql terraform aws node; do
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "error: '$cmd' not found on PATH" >&2
    exit 1
  }
done

cd "$TF_DIR"
POOL_ID="$(terraform output -raw cognito_user_pool_id)"
PGHOST="$(terraform output -raw rds_endpoint)"
PGDATABASE="$(terraform output -raw db_name)"
PGUSER="$(terraform output -raw db_username)"

if [ -z "${PGPASSWORD:-}" ]; then
  printf 'DB password for %s@%s: ' "$PGUSER" "$PGHOST" >&2
  read -rs PGPASSWORD
  printf '\n' >&2
fi
export PGPASSWORD
export PGCLIENTENCODING=UTF8

STUDENT_ID="${SEED_STUDENT_ID:-6600000001}"

echo "pool:     $POOL_ID"
echo "database: $PGDATABASE@$PGHOST"
echo "student:  $STUDENT_ID"
echo

psql_q() {
  psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
    -v ON_ERROR_STOP=1 -tAc "$1"
}

if [ "$(psql_q "SELECT to_regclass('public.app_users') IS NOT NULL;")" != "t" ]; then
  echo "error: app_users does not exist. Run the V3 migration first." >&2
  exit 1
fi

if [ "$(psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
    -v ON_ERROR_STOP=1 -v student_id="$STUDENT_ID" -tAc \
    "SELECT EXISTS (SELECT 1 FROM students WHERE student_id = :'student_id');")" != "t" ]; then
  echo "error: student $STUDENT_ID is not in the students table." >&2
  echo "Load seed data first or set SEED_STUDENT_ID." >&2
  exit 1
fi

# Exact allowlist: never infer roles from an email prefix.
aws cognito-idp list-users --user-pool-id "$POOL_ID" --output json |
  node --input-type=module -e '
    let raw = "";
    for await (const chunk of process.stdin) raw += chunk;

    const allowed = new Map([
      ["student1@example.com", "STUDENT"],
      ["advisor1@example.com", "ADVISOR"],
      ["staff1@example.com", "STAFF"],
      ["admin1@example.com", "ADMIN"],
    ]);

    for (const user of JSON.parse(raw).Users ?? []) {
      const attr = (name) =>
        user.Attributes?.find((a) => a.Name === name)?.Value;
      const email = attr("email")?.toLowerCase();
      const sub = attr("sub");
      const role = allowed.get(email);

      if (!role || !sub) {
        if (email) console.log(JSON.stringify({ skip: email }));
        continue;
      }

      console.log(JSON.stringify({ sub, email, role }));
    }
  ' | while IFS= read -r ACCOUNT; do

  SKIP="$(node -e 'const a=JSON.parse(process.argv[1]);process.stdout.write(a.skip||"")' "$ACCOUNT")"
  if [ -n "$SKIP" ]; then
    echo "skip: $SKIP (not allowlisted)"
    continue
  fi

  SUB="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).sub)' "$ACCOUNT")"
  EMAIL="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).email)' "$ACCOUNT")"
  ROLE="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).role)' "$ACCOUNT")"

  case "$EMAIL:$ROLE" in
    student1@example.com:STUDENT|advisor1@example.com:ADVISOR|staff1@example.com:STAFF|admin1@example.com:ADMIN) ;;
    *) echo "error: unexpected account-role mapping" >&2; exit 1 ;;
  esac

  if [ "$ROLE" = "STUDENT" ]; then
    psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
      -v ON_ERROR_STOP=1 \
      -v sub="$SUB" -v email="$EMAIL" -v role="$ROLE" -v student_id="$STUDENT_ID" \
      -c "INSERT INTO app_users (cognito_sub, email, role, student_id, is_active)
          VALUES (:'sub', :'email', :'role', :'student_id', TRUE)
          ON CONFLICT (cognito_sub) DO UPDATE
            SET email = EXCLUDED.email,
                role = EXCLUDED.role,
                student_id = EXCLUDED.student_id,
                is_active = TRUE;" >/dev/null
  else
    psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
      -v ON_ERROR_STOP=1 \
      -v sub="$SUB" -v email="$EMAIL" -v role="$ROLE" \
      -c "INSERT INTO app_users (cognito_sub, email, role, student_id, is_active)
          VALUES (:'sub', :'email', :'role', NULL, TRUE)
          ON CONFLICT (cognito_sub) DO UPDATE
            SET email = EXCLUDED.email,
                role = EXCLUDED.role,
                student_id = EXCLUDED.student_id,
                is_active = TRUE;" >/dev/null
  fi

  echo "upsert: $EMAIL -> $ROLE"

  if [ "$ROLE" = "ADVISOR" ]; then
    psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
      -v ON_ERROR_STOP=1 \
      -v sub="$SUB" -v student_id="$STUDENT_ID" \
      -c "INSERT INTO advisor_student_assignments (advisor_sub, student_id)
          VALUES (:'sub', :'student_id')
          ON CONFLICT DO NOTHING;" >/dev/null
    echo "assign: $EMAIL supervises $STUDENT_ID"
  fi
done

echo
echo "accounts now in app_users:"
psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" -c \
  "SELECT role, email, student_id, is_active FROM app_users ORDER BY role;"
