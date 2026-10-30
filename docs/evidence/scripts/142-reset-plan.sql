-- Evidence helper for #142 (lab database only).
-- Undoes what 142-capture-review-history.mjs wrote: removes the review rows of
-- the plan and puts it back to a SUBMITTED plan with no result, the way the
-- seed data has it.
--
--   psql "host=<rds> user=postgres dbname=coop_db" -v plan=2 -f docs/evidence/scripts/142-reset-plan.sql
BEGIN;
DELETE FROM plan_reviews WHERE plan_id = :plan;
UPDATE coop_plans
   SET status = 'SUBMITTED', reviewer_name = NULL, reviewed_at = NULL, review_comment = NULL
 WHERE plan_id = :plan
RETURNING plan_id, status;
COMMIT;
