-- ============================================================
-- CS361 V3 Database Migration: Upgrade (V2 -> V3)
-- Issue: V3-03.1 #98
-- ============================================================

-- 1. สร้างตารางผู้ใช้เพื่อผูกกับ Cognito sub
CREATE TABLE IF NOT EXISTS users (
    user_id     VARCHAR(50) PRIMARY KEY,
    cognito_sub VARCHAR(50) UNIQUE NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('STUDENT', 'ADVISOR', 'STAFF', 'ADMIN')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_cognito_sub ON users(cognito_sub);

-- เพิ่ม cognito_sub ในตาราง students
ALTER TABLE students 
    ADD COLUMN IF NOT EXISTS cognito_sub VARCHAR(50) UNIQUE;

-- 2. สร้างตารางความสัมพันธ์อาจารย์ที่ปรึกษา - นักศึกษา
CREATE TABLE IF NOT EXISTS advisor_students (
    advisor_id    VARCHAR(50) NOT NULL,
    student_id    VARCHAR(10) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    academic_year INT NOT NULL DEFAULT 2568,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (advisor_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_advisor_students_student ON advisor_students(student_id);

-- 3. ปรับโครงสร้าง coop_plans ให้รองรับ Workflow V3
-- 3.1 แปลงข้อมูลสถานะเดิม: PREPARING -> DRAFT
UPDATE coop_plans 
SET status = 'DRAFT' 
WHERE status = 'PREPARING';

-- 3.2 ปลด Check Constraint เดิมของ V2
ALTER TABLE coop_plans 
    DROP CONSTRAINT IF EXISTS chk_coop_plans_status;

-- 3.3 ใส่ Constraint สถานะใหม่ของ V3
ALTER TABLE coop_plans 
    ADD CONSTRAINT chk_coop_plans_status 
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED', 'REJECTED'));

-- 3.4 บังคับเงื่อนไข: 1 นักศึกษา ยื่นได้ 1 แผน ต่อ 1 รอบสหกิจ (ยกเว้นสถานะ REJECTED)
CREATE UNIQUE INDEX IF NOT EXISTS uq_coop_plans_active_period 
    ON coop_plans(student_id, period_id) 
    WHERE status NOT IN ('REJECTED');

-- 4. สร้างตารางบันทึกผลการพิจารณา (Audit Trail)
CREATE TABLE IF NOT EXISTS plan_reviews (
    review_id    SERIAL PRIMARY KEY,
    plan_id      VARCHAR(50) NOT NULL REFERENCES coop_plans(plan_id) ON DELETE CASCADE,
    reviewer_id  VARCHAR(50) NOT NULL,
    action       VARCHAR(20) NOT NULL CHECK (action IN ('APPROVED', 'RETURNED', 'REJECTED')),
    comment      TEXT,
    reviewed_at  TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_plan_reviews_comment 
        CHECK (action = 'APPROVED' OR (comment IS NOT NULL AND length(btrim(comment)) > 0))
);

CREATE INDEX IF NOT EXISTS idx_plan_reviews_plan ON plan_reviews(plan_id);