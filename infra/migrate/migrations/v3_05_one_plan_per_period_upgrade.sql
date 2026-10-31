-- V3 database migration 05: one plan per period counts selection results (#149, F10 in #125)
--
-- After v3_04 a student whose plan was SELECTED or NOT_SELECTED could start a
-- second plan in the same period, because the unique index only covered the
-- statuses still waiting on a step. Selection is the period's final answer, so
-- both results now hold the student's one plan for that period. NOT_ELIGIBLE
-- stays out: the student may fix what was missing and apply again.
--
-- No plan row is changed. If a student already has a second plan beside a
-- selection result (possible between v3_04 and this migration), the upgrade
-- stops and names them, so staff can decide which plan stays; nothing is
-- deleted for them.
--
-- Safe to re-run.

BEGIN;

DO $$
DECLARE
    clash TEXT;
BEGIN
    SELECT string_agg(student_id || ' / ' || period_id, ', ')
      INTO clash
      FROM (SELECT student_id, period_id
              FROM coop_plans
             WHERE status IN ('PREPARING', 'SUBMITTED', 'RETURNED', 'ENDORSED', 'ELIGIBLE',
                              'SELECTED', 'NOT_SELECTED')
             GROUP BY student_id, period_id
            HAVING count(*) > 1) dup;
    IF clash IS NOT NULL THEN
        RAISE EXCEPTION 'v3_05: these students already have more than one plan in a period: %', clash
            USING HINT = 'Close the extra plan by hand, then run this migration again.';
    END IF;
END $$;

DROP INDEX IF EXISTS uq_coop_plans_active_period;
CREATE UNIQUE INDEX uq_coop_plans_active_period
    ON coop_plans(student_id, period_id)
    WHERE status IN ('PREPARING', 'SUBMITTED', 'RETURNED', 'ENDORSED', 'ELIGIBLE',
                     'SELECTED', 'NOT_SELECTED');

COMMIT;
