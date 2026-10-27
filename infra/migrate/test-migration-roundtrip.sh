#!/usr/bin/env bash
#
# Prove the V3 migration and its rollback end to end:
#
#   npm run db:test-migration
#
# Loads the V2 schema and seed data into a throwaway database on the same RDS
# instance, upgrades it to V3, exercises the new foreign keys with real rows,
# rolls back to V2, and drops the database again. The real database is never
# touched, so this is safe to run as often as you like.
#
# It covers what v3_01_verify.sql cannot: verify reads an already-migrated
# database, while this runs the migration itself and checks the rollback path,
# including the RETURNED status that has no V2 equivalent.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO="$REPO_ROOT"
TEST_DB="${MIGRATION_TEST_DB:-coop_db_migration_test}"

for cmd in psql terraform; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "error: '$cmd' not found on PATH" >&2; exit 1; }
done

cd "$REPO/infra/terraform"
export PGHOST="$(terraform output -raw rds_endpoint)"
export PGUSER="$(terraform output -raw db_username)"
if [ -z "${PGPASSWORD:-}" ]; then
  printf 'DB password for %s@%s: ' "$PGUSER" "$PGHOST" >&2
  read -rs PGPASSWORD
  printf '
' >&2
fi
export PGPASSWORD
export PGCLIENTENCODING=UTF8
ADMIN_DB="$(terraform output -raw db_name)"
cd "$REPO"

q() { psql -h "$PGHOST" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -tAc "$1"; }
runfile() { psql -h "$PGHOST" -U "$PGUSER" -d "$TEST_DB" -v ON_ERROR_STOP=1 --quiet -f "$1"; }

echo "### 0. scratch database"
psql -h "$PGHOST" -U "$PGUSER" -d "$ADMIN_DB" -v ON_ERROR_STOP=1 -q \
  -c "DROP DATABASE IF EXISTS $TEST_DB;" -c "CREATE DATABASE $TEST_DB;"
echo "created $TEST_DB on $PGHOST (coop_db untouched)"
echo

echo "### 1. load the V2 schema and seed data"
runfile infra/schema.sql
runfile infra/seed-students.sql
runfile infra/seed.sql
echo "V2 loaded: $(q 'SELECT count(*) FROM companies;') companies, $(q 'SELECT count(*) FROM coop_plans;') plans"
echo "V2 plan_id type: $(q "SELECT data_type FROM information_schema.columns WHERE table_name='coop_plans' AND column_name='plan_id';")"
echo "V2 status constraint: $(q "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='chk_coop_plans_status';")"
echo

echo "### 2. put a plan on the V2-only status UNDER_REVIEW"
q "UPDATE coop_plans SET status='UNDER_REVIEW' WHERE plan_id = (SELECT min(plan_id) FROM coop_plans);" >/dev/null
echo "UNDER_REVIEW rows before upgrade: $(q "SELECT count(*) FROM coop_plans WHERE status='UNDER_REVIEW';")"
echo

echo "### 3. run v3_01_upgrade.sql (ON_ERROR_STOP=1)"
runfile infra/migrate/migrations/v3_01_upgrade.sql
echo "upgrade exit: 0 (no FK type conflict, no constraint violation)"
echo "UNDER_REVIEW rows after upgrade:  $(q "SELECT count(*) FROM coop_plans WHERE status='UNDER_REVIEW';")"
echo "statuses now: $(q "SELECT string_agg(status || '=' || n, ', ' ORDER BY status) FROM (SELECT status, count(*) n FROM coop_plans GROUP BY status) s;")"
echo "V3 status constraint: $(q "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='chk_coop_plans_status';")"
echo

echo "### 4. exercise the new foreign keys with real rows"
q "INSERT INTO app_users (cognito_sub, email, role, student_id)
   VALUES ('sub-staff-test', 'staff-test@example.com', 'STAFF', NULL);" >/dev/null
PLAN_ID="$(q 'SELECT min(plan_id) FROM coop_plans;')"
q "INSERT INTO plan_reviews (plan_id, reviewer_sub, decision, comment)
   VALUES ($PLAN_ID, 'sub-staff-test', 'RETURNED', 'please attach the signed form');" >/dev/null
echo "plan_reviews insert ok: plan_id=$PLAN_ID (INTEGER) -> coop_plans.plan_id, reviewer_sub -> app_users.cognito_sub"
echo "FK columns as built:"
psql -h "$PGHOST" -U "$PGUSER" -d "$TEST_DB" -t -A -F' | ' -c "
  SELECT c.conname, pg_get_constraintdef(c.oid)
  FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
  WHERE c.contype = 'f' AND t.relname IN ('app_users','advisor_student_assignments','plan_reviews')
  ORDER BY t.relname, c.conname;"
echo

echo "### 5. refuse a bad row (FK must reject an unknown reviewer)"
if q "INSERT INTO plan_reviews (plan_id, reviewer_sub, decision, comment)
      VALUES ($PLAN_ID, 'sub-does-not-exist', 'APPROVED', NULL);" >/dev/null 2>&1; then
  echo "UNEXPECTED: unknown reviewer_sub was accepted" >&2
  exit 1
else
  echo "rejected as expected: unknown reviewer_sub violates the foreign key"
fi
echo

echo "### 6. put a plan on RETURNED, the V3-only status"
q "UPDATE coop_plans SET status='RETURNED' WHERE plan_id=$PLAN_ID;" >/dev/null
echo "RETURNED rows before rollback: $(q "SELECT count(*) FROM coop_plans WHERE status='RETURNED';")"
echo

echo "### 7b. attachments migration: upgrade, re-run, FK, rollback"
runfile infra/migrate/migrations/v3_02_attachments_upgrade.sql
runfile infra/migrate/migrations/v3_02_attachments_upgrade.sql   # idempotent: second run must not fail
q "INSERT INTO plan_attachments (plan_id, s3_key, file_name, size_bytes, uploaded_by)
   VALUES ($PLAN_ID, 'plans/$PLAN_ID/test.pdf', 'test.pdf', 1000, 'sub-staff-test');" >/dev/null
echo "attachment insert ok"
if q "INSERT INTO plan_attachments (plan_id, s3_key, file_name, size_bytes, uploaded_by)
      VALUES ($PLAN_ID, 'plans/$PLAN_ID/big.pdf', 'big.pdf', 5242881, 'sub-staff-test');" >/dev/null 2>&1; then
  echo "UNEXPECTED: 5 MB + 1 byte was accepted" >&2
  exit 1
else
  echo "rejected as expected: over 5 MB"
fi

echo "### refuse an attachment with an unknown uploader"
if q "INSERT INTO plan_attachments
       (plan_id, s3_key, file_name, size_bytes, uploaded_by)
       VALUES ($PLAN_ID, 'plans/$PLAN_ID/invalid.pdf',
               'invalid.pdf', 1000, 'sub-does-not-exist');" >/dev/null 2>&1; then
  echo "UNEXPECTED: unknown uploaded_by was accepted" >&2
  exit 1
else
  echo "rejected as expected: unknown uploaded_by"
fi

runfile infra/migrate/migrations/v3_02_attachments_rollback.sql
runfile infra/migrate/migrations/v3_02_attachments_rollback.sql  # rollback is re-runnable too
echo "plan_attachments after rollback: $(q "SELECT to_regclass('public.plan_attachments') IS NULL;") (t = gone)"
echo

echo "### 7. run v3_01_rollback.sql (ON_ERROR_STOP=1)"
runfile infra/migrate/migrations/v3_01_rollback.sql
echo "rollback exit: 0"
echo "RETURNED rows after rollback:  $(q "SELECT count(*) FROM coop_plans WHERE status='RETURNED';")"
echo "plan $PLAN_ID status now:      $(q "SELECT status FROM coop_plans WHERE plan_id=$PLAN_ID;")"
echo "V3 tables left behind: $(q "SELECT coalesce(string_agg(t,', '),'none') FROM (VALUES ('app_users'),('advisor_student_assignments'),('plan_reviews')) v(t) WHERE to_regclass('public.'||t) IS NOT NULL;")"
echo "restored constraint: $(q "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='chk_coop_plans_status';")"
echo "V2 data intact: $(q 'SELECT count(*) FROM companies;') companies, $(q 'SELECT count(*) FROM coop_plans;') plans, $(q 'SELECT count(*) FROM students;') students"
echo

echo "### 8. drop the scratch database"
psql -h "$PGHOST" -U "$PGUSER" -d "$ADMIN_DB" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE $TEST_DB;"
echo "dropped $TEST_DB"
