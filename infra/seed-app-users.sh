#!/usr/bin/env bash
#
# Give every Cognito test account a row in app_users, and assign the advisor
# a student to supervise.
#
#   npm run db:seed-users
#
# Cognito subs are generated per account, and a rebuilt pool produces new ones,
# so they are read from Cognito at run time rather than written into a .sql
# file that would go stale the next time the pool is recreated.
#
# Roles come from the email local part: student1@ is a STUDENT, advisor1@ an
# ADVISOR, and so on. That mapping exists only for the demo accounts described
# in docs/v3-02-auth.md; real accounts are assigned a role by an admin.
#
# Re-runnable: every write is an upsert.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"

for cmd in psql terraform aws; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "error: '$cmd' not found on PATH" >&2; exit 1; }
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

# The student account is linked to this row in students, and the advisor is
# assigned the same student so the two roles can be told apart in testing.
STUDENT_ID="${SEED_STUDENT_ID:-6600000001}"

echo "pool:     $POOL_ID"
echo "database: $PGDATABASE@$PGHOST"
echo "student:  $STUDENT_ID"
echo

psql_q() {
  psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -tAc "$1"
}

if [ "$(psql_q "SELECT to_regclass('public.app_users') IS NOT NULL;")" != "t" ]; then
  echo "error: app_users does not exist. Run the V3 migration first:" >&2
  echo "  psql -f infra/migrate/migrations/v3_01_upgrade.sql" >&2
  exit 1
fi

if [ "$(psql_q "SELECT EXISTS (SELECT 1 FROM students WHERE student_id = '$STUDENT_ID');")" != "t" ]; then
  echo "error: student $STUDENT_ID is not in the students table." >&2
  echo "  Load the seed data first (npm run db:load), or set SEED_STUDENT_ID." >&2
  exit 1
fi

# One line per account: "<sub> <email>". The attributes come back as an
# unordered list, so they are picked out by name rather than by position.
aws cognito-idp list-users --user-pool-id "$POOL_ID" --output json \
  | node -e '
      let raw = "";
      process.stdin.on("data", (c) => (raw += c));
      process.stdin.on("end", () => {
        for (const user of JSON.parse(raw).Users) {
          const attr = (name) => user.Attributes.find((a) => a.Name === name)?.Value;
          const sub = attr("sub");
          const email = attr("email");
          if (sub && email) console.log(sub, email);
        }
      });
    ' | while read -r SUB EMAIL; do

  case "$EMAIL" in
    student*) ROLE=STUDENT ;;
    advisor*) ROLE=ADVISOR ;;
    staff*)   ROLE=STAFF ;;
    admin*)   ROLE=ADMIN ;;
    *)        echo "skip:   $EMAIL (no role rule for this address)"; continue ;;
  esac

  if [ "$ROLE" = "STUDENT" ]; then
    LINK="'$STUDENT_ID'"
  else
    LINK="NULL"
  fi

  psql_q "INSERT INTO app_users (cognito_sub, email, role, student_id, is_active)
          VALUES ('$SUB', '$EMAIL', '$ROLE', $LINK, TRUE)
          ON CONFLICT (cognito_sub) DO UPDATE
            SET email = EXCLUDED.email,
                role = EXCLUDED.role,
                student_id = EXCLUDED.student_id,
                is_active = TRUE;" >/dev/null

  echo "upsert: $EMAIL -> $ROLE"

  if [ "$ROLE" = "ADVISOR" ]; then
    psql_q "INSERT INTO advisor_student_assignments (advisor_sub, student_id)
            VALUES ('$SUB', '$STUDENT_ID')
            ON CONFLICT DO NOTHING;" >/dev/null
    echo "assign: $EMAIL supervises $STUDENT_ID"
  fi
done

echo
echo "accounts now in app_users:"
psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" -c \
  "SELECT role, email, student_id, is_active FROM app_users ORDER BY role;"
