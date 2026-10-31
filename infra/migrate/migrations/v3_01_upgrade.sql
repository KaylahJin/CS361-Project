-- V3 database migration: upgrade (V2 -> V3)
--
-- Table and column names follow docs/overview/V3-01-data-model.md, which is
-- the agreed contract the V3-02 Lambda code already queries against.
--
-- Safe to re-run: every statement is guarded.

BEGIN;

-- 1. Accounts. One row per Cognito account that may use the system; anyone
-- without a row is Public. student_id is filled for STUDENT accounts only.
CREATE TABLE IF NOT EXISTS app_users (
    cognito_sub VARCHAR(64) PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    role        VARCHAR(20) NOT NULL
        CHECK (role IN ('STUDENT', 'ADVISOR', 'STAFF', 'ADMIN')),
    student_id  VARCHAR(10) REFERENCES students(student_id) ON DELETE SET NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A STUDENT account with no student_id can see nothing, which reads as an
    -- empty list rather than the misconfiguration it is. Refuse it up front.
    CONSTRAINT chk_app_users_student_link
        CHECK (role <> 'STUDENT' OR student_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_app_users_student ON app_users(student_id);

-- 2. Which students each advisor is responsible for. The pair is the primary
-- key, so the same assignment cannot be recorded twice.
CREATE TABLE IF NOT EXISTS advisor_student_assignments (
    advisor_sub VARCHAR(64) NOT NULL REFERENCES app_users(cognito_sub) ON DELETE CASCADE,
    student_id  VARCHAR(10) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (advisor_sub, student_id)
);

CREATE INDEX IF NOT EXISTS idx_advisor_assignments_student
    ON advisor_student_assignments(student_id);

-- 3. Plan statuses. V3 drops UNDER_REVIEW and adds RETURNED; PREPARING stays
-- as it is in V2. Plans still waiting on a decision move to SUBMITTED, which
-- is the state reviewers act on.
UPDATE coop_plans SET status = 'SUBMITTED' WHERE status = 'UNDER_REVIEW';

-- Only the V2 constraint (no RETURNED) is replaced. db:load re-runs this file
-- after v3_04 has widened the list, and narrowing it back would fail on any
-- ENDORSED / ELIGIBLE / SELECTED plan, or strip those statuses from an empty one.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_coop_plans_status'
          AND pg_get_constraintdef(oid) LIKE '%RETURNED%'
    ) THEN
        ALTER TABLE coop_plans DROP CONSTRAINT IF EXISTS chk_coop_plans_status;
        ALTER TABLE coop_plans
            ADD CONSTRAINT chk_coop_plans_status
            CHECK (status IN ('PREPARING', 'SUBMITTED', 'RETURNED', 'APPROVED', 'REJECTED'));
    END IF;
END $$;

-- One plan in flight per student per period. APPROVED and REJECTED are final,
-- so they fall outside the index and a student may start a new plan after one.
CREATE UNIQUE INDEX IF NOT EXISTS uq_coop_plans_active_period
    ON coop_plans(student_id, period_id)
    WHERE status IN ('PREPARING', 'SUBMITTED', 'RETURNED');

-- 4. Review history. coop_plans keeps the latest result for reading; this
-- table keeps every decision, so a returned-then-resubmitted plan still shows
-- what was said the first time. plan_id is INTEGER to match coop_plans.
CREATE TABLE IF NOT EXISTS plan_reviews (
    review_id    SERIAL PRIMARY KEY,
    plan_id      INTEGER NOT NULL REFERENCES coop_plans(plan_id) ON DELETE CASCADE,
    reviewer_sub VARCHAR(64) NOT NULL REFERENCES app_users(cognito_sub),
    decision     VARCHAR(20) NOT NULL
        CHECK (decision IN ('APPROVED', 'RETURNED', 'REJECTED')),
    comment      TEXT,
    reviewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Returning or rejecting a plan without saying why leaves the student
    -- nothing to act on.
    CONSTRAINT chk_plan_reviews_comment
        CHECK (decision = 'APPROVED' OR (comment IS NOT NULL AND length(btrim(comment)) > 0))
);

CREATE INDEX IF NOT EXISTS idx_plan_reviews_plan ON plan_reviews(plan_id);

COMMIT;
