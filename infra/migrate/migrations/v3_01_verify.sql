-- ============================================================
-- 1. ตรวจสอบการสร้างตารางและคอลัมน์ใหม่
-- ============================================================
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('users', 'advisor_students', 'plan_reviews');

SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'students' AND column_name = 'cognito_sub';

-- ============================================================
-- 2. ทดสอบ Constraint: ห้ามยื่นแผนซ้ำในรอบเดียวกัน (uq_coop_plans_active_period)
-- ============================================================
-- 2.1 ส่งแผนแรก (ต้องผ่าน - ใช้ position_id 'POS001')
INSERT INTO coop_plans (plan_id, student_id, position_id, period_id, status) 
VALUES ('P-TEST-01', '6600000001', 'POS001', 'P2568-1', 'SUBMITTED');

-- 2.2 ส่งอีกแผนในรอบเดียวกัน (ต้องเกิด ERROR: duplicate key value violates unique constraint "uq_coop_plans_active_period")
INSERT INTO coop_plans (plan_id, student_id, position_id, period_id, status) 
VALUES ('P-TEST-02', '6600000001', 'POS001', 'P2568-1', 'DRAFT');

-- ============================================================
-- 3. ทดสอบ Check Constraint: ปฏิเสธสถานะที่ไม่ถูกต้อง
-- ============================================================
-- ลองใส่สถานะมั่ว (ต้องเกิด ERROR: check constraint "chk_coop_plans_status")
INSERT INTO coop_plans (plan_id, student_id, position_id, period_id, status) 
VALUES ('P-TEST-03', '6600000002', 'POS001', 'P2568-1', 'INVALID_STATUS');

-- ============================================================
-- 4. ทดสอบ Constraint: ตรวจสอบ Cognito Sub ห้ามซ้ำ
-- ============================================================
-- ผู้ใช้คนแรก (ต้องผ่าน)
INSERT INTO users (user_id, cognito_sub, email, role)
VALUES ('U-TEST-01', 'sub-test-111', 'test1@tu.ac.th', 'STUDENT');

-- คนที่สองใช้ sub ซ้ำ (ต้องเกิด ERROR: duplicate key value violates unique constraint "users_cognito_sub_key")
INSERT INTO users (user_id, cognito_sub, email, role)
VALUES ('U-TEST-02', 'sub-test-111', 'test2@tu.ac.th', 'STUDENT');

-- ============================================================
-- 5. ล้างข้อมูลทดสอบ (Cleanup)
-- ============================================================
DELETE FROM coop_plans WHERE plan_id IN ('P-TEST-01', 'P-TEST-02', 'P-TEST-03');
DELETE FROM users WHERE user_id IN ('U-TEST-01', 'U-TEST-02');