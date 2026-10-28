-- =====================================================================
-- reset-coop-seed.sql
-- Issue #152: Reset preparation for COOP-2569-01
--
-- =====================================================================

BEGIN;

-- Lock the period so concurrent plan inserts wait until this reset ends.
SELECT 1 FROM periods WHERE period_id = 'COOP-2569-01' FOR UPDATE;

-- Prevent deletion of the round if it contains plans belonging
-- to students outside the seed-owned test group.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM coop_plans
        WHERE period_id = 'COOP-2569-01'
          AND student_id NOT IN (
              '6900000001',
              '6900000002',
              '6900000003',
              '6900000004',
              '6900000005'
          )
    ) THEN
        RAISE EXCEPTION
            'Reset aborted: COOP-2569-01 contains plans belonging to non-seed students.';
    END IF;
END
$$;

-- Delete synthetic seed students.
-- Related student_courses records are expected to be removed
-- automatically through the ON DELETE CASCADE foreign key.
DELETE FROM students AS s
WHERE s.student_id IN (
    '6900000001',
    '6900000002',
    '6900000003',
    '6900000004',
    '6900000005'
)
AND NOT EXISTS (
    SELECT 1
    FROM coop_plans AS p
    WHERE p.student_id = s.student_id
)
AND NOT EXISTS (
    SELECT 1
    FROM app_users AS u
    WHERE u.student_id = s.student_id
      AND u.role = 'STUDENT'
);

-- Delete only the schedule with the dedicated seed-owned ID.
DELETE FROM coop_schedules
WHERE schedule_id = 'SCH-COOP-2569-01-APP'
  AND period_id = 'COOP-2569-01';

-- Delete position-period links for the test period.
DELETE FROM position_periods
WHERE period_id = 'COOP-2569-01';

-- Delete the test period only when no records reference it.
DELETE FROM periods
WHERE period_id = 'COOP-2569-01'
  AND NOT EXISTS (
      SELECT 1
      FROM coop_plans
      WHERE period_id = 'COOP-2569-01'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM coop_schedules
      WHERE period_id = 'COOP-2569-01'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM position_periods
      WHERE period_id = 'COOP-2569-01'
  );

COMMIT;

-- Verify that no seed-owned students remain.
SELECT COUNT(*) AS remaining_test_students
FROM students
WHERE student_id IN (
    '6900000001',
    '6900000002',
    '6900000003',
    '6900000004',
    '6900000005'
);

-- Verify that the dedicated seed schedule was removed.
SELECT COUNT(*) AS remaining_seed_schedule
FROM coop_schedules
WHERE schedule_id = 'SCH-COOP-2569-01-APP';

-- Verify that the test period was removed.
SELECT COUNT(*) AS remaining_test_period
FROM periods
WHERE period_id = 'COOP-2569-01';   