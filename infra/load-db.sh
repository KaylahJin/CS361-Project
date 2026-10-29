#!/usr/bin/env bash
#
# Load schema.sql + seed.sql into the RDS instance Terraform just created,
# bring the database up to the V3 shape, and give the Cognito test accounts
# their app_users rows.
#
#   npm run db:load                        # first-time load
#   npm run db:load -- --reset             # wipe and reload
#   npm run db:load -- --no-seed-users     # skip the Cognito account step
#
# Why this is a separate step: Terraform creates an EMPTY Postgres instance.
# It does not run SQL. Skip this and every resource is healthy, the Lambda
# works, and GET /companies returns [] — which looks like a broken API but
# is just an empty table.
#
# Why the V3 migration and the account seeding run from here: schema.sql is
# the V2 shape and has no app_users, advisor_student_assignments or
# plan_reviews. A load that stops there leaves a stack where every signed-in
# request answers 403, because the handlers resolve the caller against a table
# that does not exist. Both extra steps are re-runnable, so one command now
# yields a database the API can actually serve.
#
# Connects to the RAW RDS endpoint, not the proxy — the proxy is reachable
# only from inside the VPC (the Lambda). Your laptop reaches RDS directly
# through the my_ip_cidr security group rule.
#
# Run from anywhere in the repo. Git Bash on Windows is fine; PowerShell is
# not (use `bash infra/load-db.sh` there, or just use Git Bash).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$REPO_ROOT/infra/terraform"
V3_MIGRATION="$REPO_ROOT/infra/migrate/migrations/v3_01_upgrade.sql"
V3_ATTACHMENTS_MIGRATION="$REPO_ROOT/infra/migrate/migrations/v3_02_attachments_upgrade.sql"

RESET=0
SEED_USERS=1

for arg in "$@"; do
  case "$arg" in
  --reset) RESET=1 ;;
  --no-seed-users) SEED_USERS=0 ;;
  *)
    echo "error: unknown argument '$arg'" >&2
    echo "usage: npm run db:load -- [--reset] [--no-seed-users]" >&2
    exit 1
    ;;
  esac
done

for cmd in psql terraform; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: '$cmd' not found on PATH." >&2
    if [ "$cmd" = psql ]; then
      echo "  Windows: winget install -e --id PostgreSQL.PostgreSQL.16" >&2
      echo "  then add C:\\Program Files\\PostgreSQL\\16\\bin to PATH and reopen the terminal." >&2
    fi
    exit 1
  fi
done

# Read connection details from Terraform state rather than asking for them —
# no chance of pasting the proxy endpoint here by mistake.
cd "$TF_DIR"
if ! PGHOST="$(terraform output -raw rds_endpoint 2>/dev/null)"; then
  echo "error: could not read 'rds_endpoint' from Terraform." >&2
  echo "  Run 'terraform apply' in infra/terraform first." >&2
  exit 1
fi
PGDATABASE="$(terraform output -raw db_name 2>/dev/null || echo coop_db)"
PGUSER="$(terraform output -raw db_username 2>/dev/null || echo postgres)"

# Password is deliberately NOT a Terraform output (it would then show up in
# plaintext in any `terraform output` dump). Take it from the environment, or
# prompt without echoing so it never enters shell history.
if [ -z "${PGPASSWORD:-}" ]; then
  printf 'DB password for %s@%s: ' "$PGUSER" "$PGHOST" >&2
  read -rs PGPASSWORD
  printf '\n' >&2
fi
export PGPASSWORD
export PGCLIENTENCODING=UTF8 # without this, the Thai company names load as mojibake

echo "host:     $PGHOST"
echo "database: $PGDATABASE"
echo

psql_q() {
  psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" -tAc "$1"
}

run_sql() {
  psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
    -v ON_ERROR_STOP=1 --quiet -f "$1"
}

# ON_ERROR_STOP is the point of this script. Plain `psql -f` keeps going after
# a failed statement and still exits 0, so a broken load looks like a success.
run_sql_file() {
  echo "--- $1"
  run_sql "$REPO_ROOT/infra/$1"
}

# Every statement in the V3 migration is guarded (CREATE TABLE IF NOT EXISTS,
# DROP CONSTRAINT IF EXISTS), so this runs on a fresh load and on an existing
# database alike.
apply_v3_migration() {
  if [ ! -f "$V3_MIGRATION" ]; then
    echo "--- V3 migration: NOT FOUND at infra/migrate/migrations/v3_01_upgrade.sql" >&2
    echo "    app_users, advisor_student_assignments and plan_reviews will be absent," >&2
    echo "    and every signed-in API request will answer 403. The file arrives with" >&2
    echo "    the #98 migration work; check out that branch, or apply the SQL by hand." >&2
    return 1
  fi

  echo "--- migrate/migrations/v3_01_upgrade.sql"
  run_sql "$V3_MIGRATION" || return 1
  echo "--- migrate/migrations/v3_02_cognito_sub_cascade.sql"
  run_sql "$REPO_ROOT/infra/migrate/migrations/v3_02_cognito_sub_cascade.sql" || return 1

  if [ ! -f "$V3_ATTACHMENTS_MIGRATION" ]; then
    echo "--- v3_02 attachments migration: NOT FOUND" >&2
    return 1
  fi
  echo "--- migrate/migrations/v3_02_attachments_upgrade.sql"
  run_sql "$V3_ATTACHMENTS_MIGRATION" || return 1
  # Before the account seeding: the COMMITTEE role only exists from here on.
  echo "--- migrate/migrations/v3_04_review_steps_upgrade.sql"
  run_sql "$REPO_ROOT/infra/migrate/migrations/v3_04_review_steps_upgrade.sql" || return 1
}

# Needs Cognito, so it is skipped rather than fatal when this stack has no
# user pool or the AWS CLI is absent: loading seed data on a machine with no
# credentials is a legitimate thing to do. PGPASSWORD is already exported, so
# the child script does not prompt again.
seed_app_users() {
  if [ "$SEED_USERS" -eq 0 ]; then
    echo "app_users: skipped (--no-seed-users)"
    return 0
  fi

  if ! command -v aws >/dev/null 2>&1; then
    echo "app_users: skipped (aws CLI not on PATH)"
    echo "           run 'npm run db:seed-users' once it is, or the test accounts get 403"
    return 0
  fi

  if ! (cd "$TF_DIR" && terraform output -raw cognito_user_pool_id >/dev/null 2>&1); then
    echo "app_users: skipped (this stack has no Cognito user pool)"
    return 0
  fi

  echo
  bash "$REPO_ROOT/infra/seed-app-users.sh"
}

# schema.sql is plain CREATE TABLE, so a second run would die on "relation
# already exists". The seed files are skipped in that case, but the migration
# and the account seeding still run: they are both re-runnable, and a database
# loaded before either existed is exactly the case that needs them.
LOAD_SEEDS=1
if [ "$(psql_q "SELECT to_regclass('public.companies') IS NOT NULL;")" = "t" ] && [ "$RESET" -eq 0 ]; then
  echo "schema and seed data are already loaded ($(psql_q 'SELECT count(*) FROM companies;') companies)."
  echo "Skipping those files. To wipe and reload from scratch:"
  echo "  npm run db:load -- --reset"
  echo
  LOAD_SEEDS=0
fi

if [ "$RESET" -eq 1 ]; then
  echo "--reset: dropping existing tables, then reloading."
  # Dropping the schema instead of a hand-written table list: that list went
  # stale as tables were added to schema.sql, so --reset left them behind and
  # the reload failed on 'already exists'. It also drops the V3 tables, which
  # is why the migration below is part of this script rather than a step to
  # remember afterwards.
  psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 --quiet \
    -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
  echo
fi

if [ "$LOAD_SEEDS" -eq 1 ]; then
  run_sql_file schema.sql
  # seed-students.sql has to run first: seed.sql inserts coop_plans rows whose
  # student_id references students, and only seed-students.sql fills that table.
  # The other order fails on fk_coop_plans_student.
  run_sql_file seed-students.sql
  run_sql_file seed.sql
fi

# After the seed files: app_users.student_id and the assignment table reference
# students, so the rows have to exist first.
MIGRATION_OK=1
apply_v3_migration || MIGRATION_OK=0

echo
# Read from seed.sql, never hardcoded — a literal here went stale and failed a good load.
EXPECTED="$(grep -c "^  ('C" "$REPO_ROOT/infra/seed.sql")"
COUNT="$(psql_q 'SELECT count(*) FROM companies;')"
echo "companies loaded: $COUNT (expected $EXPECTED, per infra/seed.sql)"

POS_COUNT="$(psql_q 'SELECT count(*) FROM positions;')"
echo "positions loaded: $POS_COUNT"

# A missing pg_trgm extension does not fail the load, it just makes the
# ?search= filter fall back to a slow scan — worth knowing about now.
if [ "$(psql_q "SELECT count(*) FROM pg_extension WHERE extname = 'pg_trgm';")" = "1" ]; then
  echo "pg_trgm:          installed"
else
  echo "pg_trgm:          MISSING — ?search= will be slow"
fi

# The handlers resolve every caller against app_users. Saying so here turns a
# silent 403 later into a line in this output.
if [ "$(psql_q "SELECT to_regclass('public.app_users') IS NOT NULL;")" = "t" ]; then
  echo "V3 tables:        present"
else
  echo "V3 tables:        MISSING — every signed-in request will answer 403"
fi

if [ "$COUNT" != "$EXPECTED" ]; then
  echo "error: seed.sql holds $EXPECTED companies but the table has $COUNT" >&2
  echo "  Lower: duplicate company_id in seed.sql. Re-run npm run migrate:build-seed." >&2
  echo "  Higher: rows left from an earlier seed. Use --reset." >&2
  exit 1
fi

seed_app_users

echo
if [ "$MIGRATION_OK" -eq 0 ]; then
  echo "Loaded, but the V3 migration did not run. See the warning above." >&2
  exit 1
fi

echo "Done. Next: npm run env:sync   (points the frontend at this stack's API)"
echo "Then:       npm run verify:auth -- <password>   (confirms the routes refuse an anonymous caller)"

if [ "$(psql_q "SELECT to_regclass('public.plan_attachments') IS NOT NULL;")" = "t" ]; then
  echo "attachments:      present"
else
  echo "attachments:      MISSING — uploads will fail"
fi