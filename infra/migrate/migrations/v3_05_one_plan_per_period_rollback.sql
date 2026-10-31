-- V3 database migration 05: rollback. Restores the v3_04 index; no row is
-- changed. Run it before v3_04_review_steps_rollback.sql. Safe to re-run.

BEGIN;

DROP INDEX IF EXISTS uq_coop_plans_active_period;
CREATE UNIQUE INDEX uq_coop_plans_active_period
    ON coop_plans(student_id, period_id)
    WHERE status IN ('PREPARING', 'SUBMITTED', 'RETURNED', 'ENDORSED', 'ELIGIBLE');

COMMIT;
