-- V3 database migration 04: review steps (#147, D1/D2 in #125)
--
-- A plan now passes three steps, each owned by one role:
--   ENDORSEMENT  ADVISOR    SUBMITTED -> ENDORSED, or RETURNED (NOT_ENDORSED)
--   SCREENING    STAFF      ENDORSED  -> ELIGIBLE, RETURNED (INCOMPLETE) or NOT_ELIGIBLE
--   SELECTION    COMMITTEE  ELIGIBLE  -> SELECTED or NOT_SELECTED
--
-- The role stays STAFF in the database: the project brief calls them
-- "เจ้าหน้าที่สหกิจศึกษา", and its "ผู้ประสานงาน" is the company-side contact.
--
-- APPROVED and REJECTED stay allowed until #148 and #149 replace the old
-- review route. No plan row is changed here, only what the columns accept.
--
-- Safe to re-run: every statement is guarded.

BEGIN;

-- 1. COMMITTEE accounts. The CHECK was written inline in v3_01, so it carries
-- Postgres's default name.
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users
    ADD CONSTRAINT app_users_role_check
    CHECK (role IN ('STUDENT', 'ADVISOR', 'STAFF', 'COMMITTEE', 'ADMIN'));

-- 2. Plan statuses from D2.
ALTER TABLE coop_plans DROP CONSTRAINT IF EXISTS chk_coop_plans_status;
ALTER TABLE coop_plans
    ADD CONSTRAINT chk_coop_plans_status
    CHECK (status IN ('PREPARING', 'SUBMITTED', 'RETURNED',
                      'ENDORSED', 'ELIGIBLE', 'NOT_ELIGIBLE',
                      'SELECTED', 'NOT_SELECTED',
                      'APPROVED', 'REJECTED'));

-- ENDORSED and ELIGIBLE are still waiting on a step, so they count as the
-- student's plan in flight for that period, like SUBMITTED.
DROP INDEX IF EXISTS uq_coop_plans_active_period;
CREATE UNIQUE INDEX uq_coop_plans_active_period
    ON coop_plans(student_id, period_id)
    WHERE status IN ('PREPARING', 'SUBMITTED', 'RETURNED', 'ENDORSED', 'ELIGIBLE');

-- 3. Which step a review belongs to. NULL marks a review recorded through the
-- old single-step route, before the steps existed.
ALTER TABLE plan_reviews ADD COLUMN IF NOT EXISTS step VARCHAR(20);

ALTER TABLE plan_reviews DROP CONSTRAINT IF EXISTS plan_reviews_decision_check;
ALTER TABLE plan_reviews
    ADD CONSTRAINT plan_reviews_decision_check
    CHECK (decision IN ('APPROVED', 'RETURNED', 'REJECTED',
                        'ENDORSED', 'NOT_ENDORSED',
                        'ELIGIBLE', 'INCOMPLETE', 'NOT_ELIGIBLE',
                        'SELECTED', 'NOT_SELECTED'));

-- A decision belongs to exactly one step, so an endorsement can never be
-- recorded as a selection by a handler bug. CASE rather than ORs: with a NULL
-- step an OR chain evaluates to NULL, and a CHECK lets NULL through.
ALTER TABLE plan_reviews DROP CONSTRAINT IF EXISTS chk_plan_reviews_step;
ALTER TABLE plan_reviews
    ADD CONSTRAINT chk_plan_reviews_step
    CHECK (CASE
        WHEN step IS NULL THEN decision IN ('APPROVED', 'RETURNED', 'REJECTED')
        WHEN step = 'ENDORSEMENT' THEN decision IN ('ENDORSED', 'NOT_ENDORSED')
        WHEN step = 'SCREENING' THEN decision IN ('ELIGIBLE', 'INCOMPLETE', 'NOT_ELIGIBLE')
        WHEN step = 'SELECTION' THEN decision IN ('SELECTED', 'NOT_SELECTED')
        ELSE FALSE
    END);

-- Every negative outcome needs a reason (D2).
ALTER TABLE plan_reviews DROP CONSTRAINT IF EXISTS chk_plan_reviews_comment;
ALTER TABLE plan_reviews
    ADD CONSTRAINT chk_plan_reviews_comment
    CHECK (decision IN ('APPROVED', 'ENDORSED', 'ELIGIBLE', 'SELECTED')
           OR (comment IS NOT NULL AND length(btrim(comment)) > 0));

COMMIT;
