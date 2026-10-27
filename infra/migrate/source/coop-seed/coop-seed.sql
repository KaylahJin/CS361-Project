
-- =====================================================================
-- coop-seed.sql
-- Issue #152: Seed preparation for COOP-2569-01
--
-- Synthetic test data only. GPA criteria and capacity below are test
-- expectations, not official policy.
--
-- Existing schema used:
--   periods, coop_schedules, students, student_courses,
--   coop_plans, positions, position_periods
--
-- Run the existing student/position seed first if those records do
-- not exist yet. This script does not recreate omitted legacy course
-- rows from the older seed.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Academic periods
-- ---------------------------------------------------------------------
INSERT INTO periods (
    period_id,
    name,
    academic_year,
    semester,
    is_active,
    min_gpa,
    min_group_gpa,
    capacity
)
VALUES (
    'COOP-2569-01',
    'รอบทดสอบสหกิจศึกษา 2569/01',
    2569,
    '1',
    TRUE,
    2.80,
    2.50,
    2
)
ON CONFLICT (period_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Application window for the new test period
-- ---------------------------------------------------------------------
INSERT INTO coop_schedules (
    schedule_id, period_id, title, description,
    activity_type, start_date, end_date, step_order
)
VALUES (
    'SCH-COOP-2569-01-APP',
    'COOP-2569-01',
    'เปิดรับสมัครและยื่นแผนสหกิจศึกษา',
    'ช่วงยื่นแผนสำหรับผู้สมัครทดสอบ S01-S05',
    'APPLICATION',
    DATE '2026-10-01',
    DATE '2026-12-31',
    1
)
ON CONFLICT (schedule_id) DO NOTHING;


-- ---------------------------------------------------------------------
-- 3. Link ALL currently existing positions to the new period
-- Newly created positions added later will require rerunning this script.
-- ---------------------------------------------------------------------
INSERT INTO position_periods (position_id, period_id)
SELECT p.position_id, 'COOP-2569-01'
FROM positions p
ON CONFLICT (position_id, period_id) DO NOTHING;


-- ---------------------------------------------------------------------
-- 4. Synthetic students S01-S05
-- Dedicated IDs: 6900000001 through 6900000005
-- ---------------------------------------------------------------------
INSERT INTO students (
    student_id, first_name, last_name, email,
    phone, birth_date, curriculum, gpa
)
VALUES
    (
        '6900000001', 'ณิชา', 'ผู้สมัครทดสอบ',
        'coop-s01@example.ac.th', '0806900001',
        DATE '2004-01-15', '66', 3.65
    ),
    (
        '6900000002', 'ธนกฤต', 'ผู้สมัครทดสอบ',
        'coop-s02@example.ac.th', '0806900002',
        DATE '2004-02-15', '66', 3.82
    ),
    (
        '6900000003', 'ปาริชาติ', 'ผู้สมัครทดสอบ',
        'coop-s03@example.ac.th', '0806900003',
        DATE '2004-03-15', '66', 3.25
    ),
    (
        '6900000004', 'กิตติพงศ์', 'ผู้สมัครทดสอบ',
        'coop-s04@example.ac.th', '0806900004',
        DATE '2004-04-15', '66', 2.75
    ),
    (
        '6900000005', 'ศิริพร', 'ผู้สมัครทดสอบ',
        'coop-s05@example.ac.th', '0806900005',
        DATE '2004-05-15', '66', 3.10
    )
ON CONFLICT (student_id) DO NOTHING;
-- ---------------------------------------------------------------------
-- 5. Synthetic course grades
-- These six sample courses have the target averages shown below.
-- Confirm the actual required course list in coop_course_rules before
-- ---------------------------------------------------------------------
INSERT INTO student_courses (
    student_id, course_code, status, grade_point
)
VALUES
    -- S01: target sample group GPA 3.40; overall GPA 3.65
    ('6900000001', 'คพ.101', 'PASSED', 3.00),
    ('6900000001', 'คพ.102', 'PASSED', 3.50),
    ('6900000001', 'คพ.111', 'PASSED', 3.00),
    ('6900000001', 'คพ.216', 'PASSED', 3.50),
    ('6900000001', 'คพ.251', 'PASSED', 3.50),
    ('6900000001', 'คพ.264', 'PASSED', 3.90),

    -- S02: target sample group GPA 3.55; missing Transcript is not
    -- represented here because the document table/schema is unknown.
    ('6900000002', 'คพ.101', 'PASSED', 3.50),
    ('6900000002', 'คพ.102', 'PASSED', 3.50),
    ('6900000002', 'คพ.111', 'PASSED', 3.50),
    ('6900000002', 'คพ.216', 'PASSED', 3.50),
    ('6900000002', 'คพ.251', 'PASSED', 3.50),
    ('6900000002', 'คพ.264', 'PASSED', 3.80),

    -- S03: target sample group GPA 3.10; overall GPA 3.25
    ('6900000003', 'คพ.101', 'PASSED', 3.00),
    ('6900000003', 'คพ.102', 'PASSED', 3.00),
    ('6900000003', 'คพ.111', 'PASSED', 3.50),
    ('6900000003', 'คพ.216', 'PASSED', 3.00),
    ('6900000003', 'คพ.251', 'PASSED', 3.00),
    ('6900000003', 'คพ.264', 'PASSED', 3.10),

    -- S04: target sample group GPA 3.00; overall GPA 2.75
    ('6900000004', 'คพ.101', 'PASSED', 3.00),
    ('6900000004', 'คพ.102', 'PASSED', 3.00),
    ('6900000004', 'คพ.111', 'PASSED', 3.00),
    ('6900000004', 'คพ.216', 'PASSED', 3.00),
    ('6900000004', 'คพ.251', 'PASSED', 3.00),
    ('6900000004', 'คพ.264', 'PASSED', 3.00),

    -- S05: target sample group GPA 2.30; overall GPA 3.10
    ('6900000005', 'คพ.101', 'PASSED', 2.00),
    ('6900000005', 'คพ.102', 'PASSED', 2.50),
    ('6900000005', 'คพ.111', 'PASSED', 2.00),
    ('6900000005', 'คพ.216', 'PASSED', 2.50),
    ('6900000005', 'คพ.251', 'PASSED', 2.50),
    ('6900000005', 'คพ.264', 'PASSED', 2.30)
ON CONFLICT (student_id, course_code) DO NOTHING;

COMMIT;


-- Verify the seeded academic period.
SELECT *
FROM periods
WHERE period_id = 'COOP-2569-01';

-- Verify the five synthetic test students.
SELECT *
FROM students
WHERE student_id IN (
    '6900000001',
    '6900000002',
    '6900000003',
    '6900000004',
    '6900000005'
)
ORDER BY student_id;

-- Verify the number of seeded course records for each test student.
SELECT
    student_id,
    COUNT(*) AS course_count
FROM student_courses
WHERE student_id IN (
    '6900000001',
    '6900000002',
    '6900000003',
    '6900000004',
    '6900000005'
)
AND course_code IN (
    'คพ.101',
    'คพ.102',
    'คพ.111',
    'คพ.216',
    'คพ.251',
    'คพ.264'
)
GROUP BY student_id
ORDER BY student_id;

-- Verify the application schedule for the test period.
SELECT *
FROM coop_schedules
WHERE schedule_id = 'SCH-COOP-2569-01-APP'
  AND period_id = 'COOP-2569-01';

-- Verify the positions linked to the test period.
SELECT *
FROM position_periods
WHERE period_id = 'COOP-2569-01';
