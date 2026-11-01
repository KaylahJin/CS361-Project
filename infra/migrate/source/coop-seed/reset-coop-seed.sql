-- =====================================================================
-- reset-coop-seed.sql
-- Issue #152: Reset preparation for COOP-2569-01
--
-- Safety:
--   - Locks the target period to prevent race conditions.
--   - Removes only records explicitly claimed by seed 'COOP-2569-01'.
--   - Preserves a seed student AND that student's seed-owned courses
--     (plus their ownership rows) while any plan or student account
--     depends on the student, in any period. Eligibility checks need
--     those course records.
--   - Preserves the period if any coop_plans still reference it.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Concurrency control: Lock the target period row
-- ---------------------------------------------------------------------
SELECT 1 
FROM periods 
WHERE period_id = 'COOP-2569-01' 
FOR UPDATE;


-- ---------------------------------------------------------------------
-- 2. Delete seed-owned course records, only for students nothing depends on
-- ---------------------------------------------------------------------
DELETE FROM student_courses sc
USING seed_course_ownership o
WHERE o.seed_name   = 'COOP-2569-01'
  AND sc.student_id  = o.student_id
  AND sc.course_code = o.course_code
  AND NOT EXISTS (
      SELECT 1
      FROM coop_plans cp
      WHERE cp.student_id = sc.student_id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM app_users u
      WHERE u.student_id = sc.student_id
        AND u.role = 'STUDENT'
  );

-- Drop ownership rows only for courses that are actually gone
DELETE FROM seed_course_ownership o
WHERE o.seed_name = 'COOP-2569-01'
  AND NOT EXISTS (
      SELECT 1
      FROM student_courses sc
      WHERE sc.student_id  = o.student_id
        AND sc.course_code = o.course_code
  );

-- ---------------------------------------------------------------------
-- 3. Delete seed-owned students (only if no plans, accounts, or courses remain)
-- ---------------------------------------------------------------------
DELETE FROM students s
USING seed_student_ownership o
WHERE o.seed_name   = 'COOP-2569-01'
  AND o.student_id  = s.student_id
  AND NOT EXISTS (
      SELECT 1 FROM coop_plans p WHERE p.student_id = s.student_id
  )
  AND NOT EXISTS (
      SELECT 1 
      FROM app_users u 
      WHERE u.student_id = s.student_id 
        AND u.role = 'STUDENT'
  )
  AND NOT EXISTS (
      SELECT 1 FROM student_courses c WHERE c.student_id = s.student_id
  );

-- Retain ownership logs only for students that couldn't be deleted
DELETE FROM seed_student_ownership o
WHERE o.seed_name = 'COOP-2569-01'
  AND NOT EXISTS (
      SELECT 1 FROM students s WHERE s.student_id = o.student_id
  );


-- ---------------------------------------------------------------------
-- 4. Teardown schedule, position links, and period
-- (Skipped if any coop_plans still reference this period)
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM coop_plans WHERE period_id = 'COOP-2569-01') THEN

        -- 4.1 Schedules
        DELETE FROM coop_schedules s
        USING seed_schedule_ownership o
        WHERE o.seed_name    = 'COOP-2569-01'
          AND o.schedule_id  = s.schedule_id
          AND s.period_id    = 'COOP-2569-01';

        DELETE FROM seed_schedule_ownership o
        WHERE o.seed_name = 'COOP-2569-01'
          AND NOT EXISTS (
              SELECT 1 FROM coop_schedules s WHERE s.schedule_id = o.schedule_id
          );

        -- 4.2 Position links
        DELETE FROM position_periods pp
        USING seed_position_period_ownership o
        WHERE o.seed_name     = 'COOP-2569-01'
          AND o.position_id   = pp.position_id
          AND o.period_id     = pp.period_id
          AND pp.period_id    = 'COOP-2569-01';

        DELETE FROM seed_position_period_ownership o
        WHERE o.seed_name = 'COOP-2569-01'
          AND NOT EXISTS (
              SELECT 1 
              FROM position_periods pp
              WHERE pp.position_id = o.position_id 
                AND pp.period_id   = o.period_id
          );

        -- 4.3 Academic period
        DELETE FROM periods p
        USING seed_period_ownership o
        WHERE o.seed_name   = 'COOP-2569-01'
          AND o.period_id   = p.period_id
          AND p.period_id   = 'COOP-2569-01'
          AND NOT EXISTS (SELECT 1 FROM coop_plans cp WHERE cp.period_id = p.period_id)
          AND NOT EXISTS (SELECT 1 FROM coop_schedules cs WHERE cs.period_id = p.period_id)
          AND NOT EXISTS (SELECT 1 FROM position_periods pp WHERE pp.period_id = p.period_id);

        DELETE FROM seed_period_ownership o
        WHERE o.seed_name = 'COOP-2569-01'
          AND NOT EXISTS (
              SELECT 1 FROM periods p WHERE p.period_id = o.period_id
          );

    END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------
-- Evidence check after reset
-- ---------------------------------------------------------------------
SELECT 'period' AS entity, COUNT(*) AS remaining 
FROM periods 
WHERE period_id = 'COOP-2569-01'

UNION ALL

SELECT 'schedule', COUNT(*) 
FROM coop_schedules 
WHERE schedule_id = 'SCH-COOP-2569-01-APP'

UNION ALL

SELECT 'seed-owned students', COUNT(*) 
FROM seed_student_ownership 
WHERE seed_name = 'COOP-2569-01'

UNION ALL

SELECT 'seed-owned courses', COUNT(*) 
FROM seed_course_ownership 
WHERE seed_name = 'COOP-2569-01';