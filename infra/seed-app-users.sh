#!/usr/bin/env bash
#
# Seed allowlisted Cognito test accounts into app_users and assign the
# advisor to the demo student.
#
#   npm run db:seed-users
#
# Re-runnable: writes use upserts. Only the four documented test accounts
# are activated. Other existing app_users rows are deactivated.

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

# Pass SQL through stdin so psql variable interpolation works.
psql_var() {
  local sql="$1"
  shift
  psql -X -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
    -v ON_ERROR_STOP=1 "$@" <<< "$sql"
}

if [ "$(psql_var "SELECT to_regclass('public.app_users') IS NOT NULL;" -tA)" != "t" ]; then
  echo "error: app_users does not exist. Run the V3 migration first:" >&2
  echo "  psql -f infra/migrate/migrations/v3_01_upgrade.sql" >&2
  exit 1
fi

if [ "$(psql_var "SELECT EXISTS (SELECT 1 FROM students WHERE student_id = :'student_id');" \
    -v student_id="$STUDENT_ID" -tA)" != "t" ]; then
  echo "error: student $STUDENT_ID is not in the students table." >&2
  echo "  Load seed data first (npm run db:load), or set SEED_STUDENT_ID." >&2
  exit 1
fi

# Read Cognito accounts and emit JSON so email addresses and subs are passed
# safely to psql variables without SQL string interpolation in the shell.
aws cognito-idp list-users --user-pool-id "$POOL_ID" --output json |
  node -e '
    let raw = "";
    process.stdin.on("data", (c) => (raw += c));
    process.stdin.on("end", () => {
      const allowed = new Map([
        ["student1@example.com", "STUDENT"],
        ["advisor1@example.com", "ADVISOR"],
        ["staff1@example.com", "STAFF"],
        ["admin1@example.com", "ADMIN"],
      ]);
      for (const user of JSON.parse(raw).Users ?? []) {
        const attr = (name) => user.Attributes?.find((a) => a.Name === name)?.Value;
        const sub = attr("sub");
        const email = attr("email")?.toLowerCase();
        if (!email || !allowed.has(email)) continue;
        if (!sub) {
          console.error(`error: missing Cognito sub for ${email}`);
          process.exitCode = 1;
          continue;
        }
        console.log(JSON.stringify({ sub, email, role: allowed.get(email) }));
      }
    });
  ' | while IFS= read -r ACCOUNT; do

  SUB="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).sub)' "$ACCOUNT")"
  EMAIL="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).email)' "$ACCOUNT")"
  ROLE="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).role)' "$ACCOUNT")"

  if [ "$ROLE" = "STUDENT" ]; then
    psql_var "
      INSERT INTO app_users (cognito_sub, email, role, student_id, is_active)
      VALUES (:'sub', :'email', :'role', :'student_id', TRUE)
      ON CONFLICT (cognito_sub) DO UPDATE
        SET email = EXCLUDED.email,
            role = EXCLUDED.role,
            student_id = EXCLUDED.student_id,
            is_active = TRUE;
    " -v sub="$SUB" -v email="$EMAIL" -v role="$ROLE" -v student_id="$STUDENT_ID" >/dev/null
  else
    psql_var "
      INSERT INTO app_users (cognito_sub, email, role, student_id, is_active)
      VALUES (:'sub', :'email', :'role', NULL, TRUE)
      ON CONFLICT (cognito_sub) DO UPDATE
        SET email = EXCLUDED.email,
            role = EXCLUDED.role,
            student_id = EXCLUDED.student_id,
            is_active = TRUE;
    " -v sub="$SUB" -v email="$EMAIL" -v role="$ROLE" >/dev/null
  fi

  echo "upsert: $EMAIL -> $ROLE"

  if [ "$ROLE" = "ADVISOR" ]; then
    psql_var "
      INSERT INTO advisor_student_assignments (advisor_sub, student_id)
      VALUES (:'sub', :'student_id')
      ON CONFLICT DO NOTHING;
    " -v sub="$SUB" -v student_id="$STUDENT_ID" >/dev/null
    echo "assign: $EMAIL supervises $STUDENT_ID"
  fi
done

# Deactivate legacy mappings that are outside the explicit allowlist.
psql_var "
  UPDATE app_users
  SET is_active = FALSE
  WHERE lower(COALESCE(email, '')) NOT IN (
    'student1@example.com',
    'advisor1@example.com',
    'staff1@example.com',
    'admin1@example.com'
  )
  AND is_active = TRUE;
" >/dev/null

echo
echo "accounts now in app_users:"
psql -X -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
  -v ON_ERROR_STOP=1 \
  -c "SELECT role, email, student_id, is_active FROM app_users ORDER BY role;"
