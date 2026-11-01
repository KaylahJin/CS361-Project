-- Evidence helper for #142 (lab database only).
-- Puts a plan back in a state a reviewer can decide on again, so a second run of
-- 142-capture-review-history.mjs adds a second entry to the history.
--
--   psql "host=<rds> user=postgres dbname=coop_db" -v plan=2 -v status=SUBMITTED -f docs/evidence/scripts/142-set-plan-status.sql
UPDATE coop_plans SET status = :'status' WHERE plan_id = :plan RETURNING plan_id, status;
