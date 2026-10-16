-- ============================================================
-- CS361 V3 Database Migration: Rollback (V3 -> V2)
-- ============================================================

-- 1. ลบตาราง Audit Trail และ Index ป้องกันซ้ำ
DROP TABLE IF EXISTS plan_reviews;
DROP INDEX IF EXISTS uq_coop_plans_active_period;

-- 2. ย้อนคืนสถานะ coop_plans กลับเป็นของ V2
ALTER TABLE coop_plans DROP CONSTRAINT IF EXISTS chk_coop_plans_status;

UPDATE coop_plans 
SET status = 'PREPARING' 
WHERE status = 'DRAFT';

ALTER TABLE coop_plans 
    ADD CONSTRAINT chk_coop_plans_status 
    CHECK (status IN ('PREPARING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'));

-- 3. ลบตารางความสัมพันธ์และข้อมูล Cognito
DROP TABLE IF EXISTS advisor_students;
ALTER TABLE students DROP COLUMN IF EXISTS cognito_sub;
DROP TABLE IF EXISTS users;