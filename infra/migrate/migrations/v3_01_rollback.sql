-- V3 database migration: rollback (V3 -> V2)
--
-- Undoes v3_01_upgrade.sql. The V2 tables and their rows are left untouched;
-- only what the upgrade added comes out.
--
-- RETURNED has no V2 equivalent. Those plans go back to PREPARING, which is
-- where a student picks a returned plan up anyway — the reviewer's comment
-- survives in coop_plans.review_comment.

BEGIN;

DROP TABLE IF EXISTS plan_reviews;
DROP TABLE IF EXISTS advisor_student_assignments;
DROP TABLE IF EXISTS app_users;

DROP INDEX IF EXISTS uq_coop_plans_active_period;

ALTER TABLE coop_plans DROP CONSTRAINT IF EXISTS chk_coop_plans_status;

UPDATE coop_plans SET status = 'PREPARING' WHERE status = 'RETURNED';

ALTER TABLE coop_plans
    ADD CONSTRAINT chk_coop_plans_status
    CHECK (status IN ('PREPARING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'));

COMMIT;
