-- =====================================================================
-- coop-seed.sql
-- Issue #152: Seed preparation for COOP-2569-01 (Ownership Protected)
--
-- Prerequisite:
--   Run seed-ownership.sql once first to initialize tracking tables:
--   - seed_period_ownership
--   - seed_schedule_ownership
--   - seed_position_period_ownership
--   - seed_student_ownership
--   - seed_course_ownership
--
-- Safety:
--   Refuses to modify or link records not claimed by seed 'COOP-2569-01'.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Academic periods
-- ---------------------------------------------------------------------
WITH new_period AS (
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
    ON CONFLICT (period_id) DO NOTHING
    RETURNING period_id
)
INSERT INTO seed_period_ownership (seed_name, period_id)
SELECT 'COOP-2569-01', period_id
FROM new_period
ON CONFLICT DO NOTHING;

-- Guard: Abort if target period exists but was created outside this seed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM seed_period_ownership
        WHERE seed_name = 'COOP-2569-01'
          AND period_id = 'COOP-2569-01'
    ) THEN
        RAISE EXCEPTION 'COOP-2569-01 exists but is not owned by this seed; refusing to modify manual data.';
    END IF;
END $$;


-- ---------------------------------------------------------------------
-- 2. Application window for the new test period
-- ---------------------------------------------------------------------
WITH new_schedule AS (
    INSERT INTO coop_schedules (
        schedule_id,
        period_id,
        title,
        description,
        activity_type,
        start_date,
        end_date,
        step_order
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
    ON CONFLICT (schedule_id) DO NOTHING
    RETURNING schedule_id
)
INSERT INTO seed_schedule_ownership (seed_name, schedule_id)
SELECT 'COOP-2569-01', schedule_id
FROM new_schedule
ON CONFLICT DO NOTHING;

-- Guard: Abort if schedule ID exists without seed ownership
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM seed_schedule_ownership
        WHERE seed_name = 'COOP-2569-01'
          AND schedule_id = 'SCH-COOP-2569-01-APP'
    ) THEN
        RAISE EXCEPTION 'Seed schedule ID already exists but is not seed-owned; refusing to modify manual data.';
    END IF;
END $$;

-- Update schedule details if owned
UPDATE coop_schedules
SET period_id     = 'COOP-2569-01',
    title         = 'เปิดรับสมัครและยื่นแผนสหกิจศึกษา',
    description   = 'ช่วงยื่นแผนสำหรับผู้สมัครทดสอบ S01-S05',
    activity_type = 'APPLICATION',
    start_date    = DATE '2026-10-01',
    end_date      = DATE '2026-12-31',
    step_order    = 1
WHERE schedule_id = 'SCH-COOP-2569-01-APP'
  AND EXISTS (
      SELECT 1
      FROM seed_schedule_ownership o
      WHERE o.seed_name = 'COOP-2569-01'
        AND o.schedule_id = coop_schedules.schedule_id
  );


-- ---------------------------------------------------------------------
-- 3. Link positions to period
-- ---------------------------------------------------------------------
WITH linked_positions AS (
    INSERT INTO position_periods (position_id, period_id)
    SELECT position_id, 'COOP-2569-01'
    FROM positions
    ON CONFLICT (position_id, period_id) DO NOTHING
    RETURNING position_id, period_id
)
INSERT INTO seed_position_period_ownership (seed_name, position_id, period_id)
SELECT 'COOP-2569-01', position_id, period_id
FROM linked_positions
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------
-- 4. Synthetic students S01-S05
-- ---------------------------------------------------------------------
WITH inserted_students AS (
    INSERT INTO students (
        student_id,
        first_name,
        last_name,
        email,
        phone,
        birth_date,
        curriculum,
        gpa
    )
    VALUES
        ('6900000001', 'ณิชา', 'ผู้สมัครทดสอบ', 'coop-s01@example.ac.th', '0806900001', DATE '2004-01-15', '66', 3.65),
        ('6900000002', 'ธนกฤต', 'ผู้สมัครทดสอบ', 'coop-s02@example.ac.th', '0806900002', DATE '2004-02-15', '66', 3.82),
        ('6900000003', 'ปาริชาติ', 'ผู้สมัครทดสอบ', 'coop-s03@example.ac.th', '0806900003', DATE '2004-03-15', '66', 3.25),
        ('6900000004', 'กิตติพงศ์', 'ผู้สมัครทดสอบ', 'coop-s04@example.ac.th', '0806900004', DATE '2004-04-15', '66', 2.75),
        ('6900000005', 'ศิริพร', 'ผู้สมัครทดสอบ', 'coop-s05@example.ac.th', '0806900005', DATE '2004-05-15', '66', 3.10)
    ON CONFLICT (student_id) DO NOTHING
    RETURNING student_id
)
INSERT INTO seed_student_ownership (seed_name, student_id)
SELECT 'COOP-2569-01', student_id
FROM inserted_students
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------
-- 5. Synthetic course records
-- ---------------------------------------------------------------------
WITH course_data (student_id, course_code, status, grade_point) AS (
    VALUES
        -- S01: target group GPA 3.40; overall GPA 3.65
        ('6900000001', 'คพ.100', 'PASSED', 3.50),
        ('6900000001', 'คพ.101', 'PASSED', 3.20),
        ('6900000001', 'คพ.102', 'PASSED', 3.50),
        ('6900000001', 'คพ.111', 'PASSED', 3.00),
        ('6900000001', 'คพ.216', 'PASSED', 3.50),
        ('6900000001', 'คพ.251', 'PASSED', 3.50),
        ('6900000001', 'คพ.261', 'PASSED', 3.50),
        ('6900000001', 'คพ.180', 'ENROLLED', NULL),
        ('6900000001', 'คพ.331', 'ENROLLED', NULL),
        ('6900000001', 'คพ.301', 'PASSED', 3.50),

        -- S02: target group GPA 3.55; overall GPA 3.82
        ('6900000002', 'คพ.100', 'PASSED', 3.50),
        ('6900000002', 'คพ.101', 'PASSED', 3.90),
        ('6900000002', 'คพ.102', 'PASSED', 3.50),
        ('6900000002', 'คพ.111', 'PASSED', 3.50),
        ('6900000002', 'คพ.216', 'PASSED', 3.50),
        ('6900000002', 'คพ.251', 'PASSED', 3.50),
        ('6900000002', 'คพ.261', 'PASSED', 3.50),
        ('6900000002', 'คพ.180', 'ENROLLED', NULL),
        ('6900000002', 'คพ.262', 'ENROLLED', NULL),
        ('6900000002', 'คพ.301', 'PASSED', 3.50),

        -- S03: target group GPA 3.10; overall GPA 3.25
        ('6900000003', 'คพ.100', 'PASSED', 3.50),
        ('6900000003', 'คพ.101', 'PASSED', 3.20),
        ('6900000003', 'คพ.102', 'PASSED', 3.20),
        ('6900000003', 'คพ.111', 'PASSED', 3.50),
        ('6900000003', 'คพ.216', 'PASSED', 3.00),
        ('6900000003', 'คพ.251', 'PASSED', 3.00),
        ('6900000003', 'คพ.261', 'PASSED', 3.00),
        ('6900000003', 'คพ.180', 'ENROLLED', NULL),
        ('6900000003', 'คพ.331', 'ENROLLED', NULL),
        ('6900000003', 'คพ.301', 'PASSED', 3.00),

        -- S04: target group GPA 3.00; overall GPA 2.75
        ('6900000004', 'คพ.100', 'PASSED', 3.00),
        ('6900000004', 'คพ.101', 'PASSED', 3.00),
        ('6900000004', 'คพ.102', 'PASSED', 3.00),
        ('6900000004', 'คพ.111', 'PASSED', 3.00),
        ('6900000004', 'คพ.216', 'PASSED', 3.00),
        ('6900000004', 'คพ.251', 'PASSED', 3.00),
        ('6900000004', 'คพ.261', 'PASSED', 3.00),
        ('6900000004', 'คพ.180', 'ENROLLED', NULL),
        ('6900000004', 'คพ.331', 'ENROLLED', NULL),
        ('6900000004', 'คพ.301', 'PASSED', 3.00),

        -- S05: target group GPA 2.30; overall GPA 3.10
        ('6900000005', 'คพ.100', 'PASSED', 2.30),
        ('6900000005', 'คพ.101', 'PASSED', 2.00),
        ('6900000005', 'คพ.102', 'PASSED', 2.50),
        ('6900000005', 'คพ.111', 'PASSED', 2.00),
        ('6900000005', 'คพ.216', 'PASSED', 2.50),
        ('6900000005', 'คพ.251', 'PASSED', 2.50),
        ('6900000005', 'คพ.261', 'PASSED', 2.30),
        ('6900000005', 'คพ.180', 'ENROLLED', NULL),
        ('6900000005', 'คพ.331', 'ENROLLED', NULL),
        ('6900000005', 'คพ.301', 'PASSED', 2.30)
),
inserted_courses AS (
    INSERT INTO student_courses (student_id, course_code, status, grade_point)
    SELECT c.student_id, c.course_code, c.status, c.grade_point
    FROM course_data c
    JOIN seed_student_ownership o
      ON o.seed_name = 'COOP-2569-01'
     AND o.student_id = c.student_id
    ON CONFLICT (student_id, course_code) DO NOTHING
    RETURNING student_id, course_code
)
INSERT INTO seed_course_ownership (seed_name, student_id, course_code)
SELECT 'COOP-2569-01', student_id, course_code
FROM inserted_courses
ON CONFLICT DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------
-- Verification Queries
-- ---------------------------------------------------------------------

-- Verify the seeded academic period.
SELECT p.*, o.seed_name
FROM periods p
LEFT JOIN seed_period_ownership o ON o.period_id = p.period_id
WHERE p.period_id = 'COOP-2569-01';

-- Verify the five synthetic test students.
SELECT s.student_id, s.first_name, s.last_name, s.gpa, o.seed_name
FROM students s
LEFT JOIN seed_student_ownership o ON o.student_id = s.student_id
WHERE s.student_id IN (
    '6900000001', '6900000002', '6900000003', '6900000004', '6900000005'
)
ORDER BY s.student_id;

-- Verify required, alternative, and ongoing course records.
SELECT
    student_id,
    COUNT(*) FILTER (
        WHERE course_code IN (
            'คพ.100', 'คพ.101', 'คพ.102',
            'คพ.111', 'คพ.251', 'คพ.261'
        )
        AND status = 'PASSED'
        AND grade_point IS NOT NULL
    ) AS required_courses_passed,
    COUNT(*) FILTER (
        WHERE course_code IN ('คพ.213', 'คพ.216')
          AND status = 'PASSED'
          AND grade_point IS NOT NULL
    ) AS alternatives_passed,
    COUNT(*) FILTER (
        WHERE course_code = 'คพ.180'
          AND status IN ('PASSED', 'ENROLLED')
    ) AS course_180_present,
    COUNT(*) FILTER (
        WHERE course_code IN ('คพ.262', 'คพ.331', 'คพ.240')
          AND status IN ('PASSED', 'ENROLLED')
    ) AS second_group_present
FROM student_courses
WHERE student_id IN (
    '6900000001', '6900000002', '6900000003',
    '6900000004', '6900000005'
)
GROUP BY student_id
ORDER BY student_id;

-- Verify the application schedule for the test period.
SELECT s.*, o.seed_name
FROM coop_schedules s
LEFT JOIN seed_schedule_ownership o
  ON o.schedule_id = s.schedule_id
 AND o.seed_name = 'COOP-2569-01'
WHERE s.schedule_id = 'SCH-COOP-2569-01-APP'
  AND s.period_id = 'COOP-2569-01';


-- Verify the positions linked to the test period.
SELECT pp.position_id, pp.period_id, o.seed_name
FROM position_periods pp
LEFT JOIN seed_position_period_ownership o 
  ON o.position_id = pp.position_id AND o.period_id = pp.period_id
WHERE pp.period_id = 'COOP-2569-01';