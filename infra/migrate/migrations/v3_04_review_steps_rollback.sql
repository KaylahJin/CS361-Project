-- V3 database migration 04: rollback (review steps -> single review)
--
-- Undoes v3_04_review_steps_upgrade.sql. No plan or review row is deleted
-- except an ENDORSED or ELIGIBLE review, which has no single-step equivalent;
-- its plan goes back to SUBMITTED, waiting on a decision as before.
--
--   ENDORSED, ELIGIBLE           -> SUBMITTED
--   SELECTED                     -> APPROVED
--   NOT_ELIGIBLE, NOT_SELECTED   -> REJECTED
--   review NOT_ENDORSED, INCOMPLETE -> RETURNED
--
-- COMMITTEE accounts become inactive STAFF rows instead of being deleted, so
-- the reviews they recorded keep their reviewer. Inactive accounts get 403.

BEGIN;

ALTER TABLE coop_plans DROP CONSTRAINT IF EXISTS chk_coop_plans_status;
ALTER TABLE plan_reviews DROP CONSTRAINT IF EXISTS plan_reviews_decision_check;
ALTER TABLE plan_reviews DROP CONSTRAINT IF EXISTS chk_plan_reviews_step;
ALTER TABLE plan_reviews DROP CONSTRAINT IF EXISTS chk_plan_reviews_comment;
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;

UPDATE coop_plans SET status = 'SUBMITTED' WHERE status IN ('ENDORSED', 'ELIGIBLE');
UPDATE coop_plans SET status = 'APPROVED'  WHERE status = 'SELECTED';
UPDATE coop_plans SET status = 'REJECTED'  WHERE status IN ('NOT_ELIGIBLE', 'NOT_SELECTED');

DELETE FROM plan_reviews WHERE decision IN ('ENDORSED', 'ELIGIBLE');
UPDATE plan_reviews SET decision = 'RETURNED' WHERE decision IN ('NOT_ENDORSED', 'INCOMPLETE');
UPDATE plan_reviews SET decision = 'APPROVED' WHERE decision = 'SELECTED';
UPDATE plan_reviews SET decision = 'REJECTED' WHERE decision IN ('NOT_ELIGIBLE', 'NOT_SELECTED');

UPDATE app_users SET role = 'STAFF', is_active = FALSE WHERE role = 'COMMITTEE';

ALTER TABLE plan_reviews DROP COLUMN IF EXISTS step;

ALTER TABLE plan_reviews
    ADD CONSTRAINT plan_reviews_decision_check
    CHECK (decision IN ('APPROVED', 'RETURNED', 'REJECTED'));
ALTER TABLE plan_reviews
    ADD CONSTRAINT chk_plan_reviews_comment
    CHECK (decision = 'APPROVED' OR (comment IS NOT NULL AND length(btrim(comment)) > 0));

DROP INDEX IF EXISTS uq_coop_plans_active_period;
CREATE UNIQUE INDEX uq_coop_plans_active_period
    ON coop_plans(student_id, period_id)
    WHERE status IN ('PREPARING', 'SUBMITTED', 'RETURNED');

ALTER TABLE coop_plans
    ADD CONSTRAINT chk_coop_plans_status
    CHECK (status IN ('PREPARING', 'SUBMITTED', 'RETURNED', 'APPROVED', 'REJECTED'));

ALTER TABLE app_users
    ADD CONSTRAINT app_users_role_check
    CHECK (role IN ('STUDENT', 'ADVISOR', 'STAFF', 'ADMIN'));

COMMIT;
