#!/usr/bin/env bash
#
# Load schema.sql + seed.sql into the RDS instance Terraform just created.
#
#   npm run db:load              # first-time load
#   npm run db:load -- --reset   # wipe and reload
#
# Why this is a separate step: Terraform creates an EMPTY Postgres instance.
# It does not run SQL. Skip this and every resource is healthy, the Lambda
# works, and GET /companies returns [] — which looks like a broken API but
# is just an empty table.
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

# schema.sql is plain CREATE TABLE, so a second run would die on "relation
# already exists" — a confusing way to find out the database is already set
# up. Check first and say so plainly.
RESET="${1:-}"
if [ "$(psql_q "SELECT to_regclass('public.companies') IS NOT NULL;")" = "t" ] &&
  [ "$RESET" != "--reset" ]; then
  echo "This database is already loaded ($(psql_q 'SELECT count(*) FROM companies;') companies)."
  echo "Nothing to do."
  echo
  echo "To wipe it and reload from scratch:"
  echo "  npm run db:load -- --reset"
  exit 0
fi

if [ "$RESET" = "--reset" ]; then
  echo "--reset: dropping existing tables, then reloading."
  psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 --quiet \
    -c 'DROP TABLE IF EXISTS coop_plans, student_courses, students, periods, positions, coop_info, companies CASCADE;'
  echo
fi

# ON_ERROR_STOP is the point of this script. Plain `psql -f` keeps going after
# a failed statement and still exits 0, so a broken load looks like a success.
run_sql_file() {
  echo "--- $1"
  psql -h "$PGHOST" -p 5432 -U "$PGUSER" -d "$PGDATABASE" \
    -v ON_ERROR_STOP=1 --quiet -f "$REPO_ROOT/infra/$1"
}

run_sql_file schema.sql
run_sql_file seed.sql
run_sql_file seed-students.sql

echo
COUNT="$(psql_q 'SELECT count(*) FROM companies;')"
echo "companies loaded: $COUNT (expected 81)"

POS_COUNT="$(psql_q 'SELECT count(*) FROM positions;')"
echo "positions loaded: $POS_COUNT"

# A missing pg_trgm extension does not fail the load, it just makes the
# ?search= filter fall back to a slow scan — worth knowing about now.
if [ "$(psql_q "SELECT count(*) FROM pg_extension WHERE extname = 'pg_trgm';")" = "1" ]; then
  echo "pg_trgm:          installed"
else
  echo "pg_trgm:          MISSING — ?search= will be slow"
fi

if [ "$COUNT" != "81" ]; then
  echo "error: expected 81 companies, got $COUNT" >&2
  exit 1
fi

echo
echo "Done. Next: npm run env:sync   (points the frontend at this stack's API)"
