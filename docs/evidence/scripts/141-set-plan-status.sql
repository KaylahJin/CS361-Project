-- Evidence helper for #141 (lab database only).
-- The seeded plan of student1 (plan 1) is a draft, so a student never sees a
-- review button on it. Put it in the state to photograph, then put it back:
--
--   psql "host=<rds> user=postgres dbname=coop_db" -v status=SUBMITTED -f docs/evidence/scripts/141-set-plan-status.sql
--   ... capture ...
--   psql "host=<rds> user=postgres dbname=coop_db" -v status=PREPARING -f docs/evidence/scripts/141-set-plan-status.sql
UPDATE coop_plans SET status = :'status' WHERE plan_id = 1 RETURNING plan_id, status;
