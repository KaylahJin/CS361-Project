-- V3 database migration 04: verification. Read-only. A failed check raises an
-- error, so run it with ON_ERROR_STOP and a wrong database exits non-zero.
--
-- Count the plans before upgrading and pass the number in, so the script can
-- prove the upgrade lost or added none (AC of #147):
--
--   psql ... -tAc 'SELECT count(*) FROM coop_plans'          # say it prints 42
--   psql ... -f infra/migrate/migrations/v3_04_review_steps_upgrade.sql
--   psql ... -v ON_ERROR_STOP=1 -v plans_before=42 -f infra/migrate/migrations/v3_04_review_steps_verify.sql

\echo '== plan count unchanged by the upgrade =='
\if :{?plans_before}
-- A DO block cannot see psql variables, so the count goes through a session
-- setting (not a write).
SELECT set_config('verify.plans_before', :'plans_before', false) AS plans_before;
DO $$
DECLARE
    before bigint := current_setting('verify.plans_before')::bigint;
    after  bigint;
BEGIN
    SELECT count(*) INTO after FROM coop_plans;
    IF after <> before THEN
        RAISE EXCEPTION 'MISMATCH: % plans before the upgrade, % after', before, after;
    END IF;
    RAISE NOTICE 'ok: % plans before and after', after;
END $$;
\else
\echo 'SKIPPED: run with -v plans_before=<count taken before the upgrade>'
\endif

\echo '== schema after the upgrade =='
DO $$
DECLARE
    problems text[] := '{}';
    expected record;
    def text;
BEGIN
    FOR expected IN
        SELECT * FROM (VALUES ('app_users_role_check', 'COMMITTEE'),
                              ('chk_coop_plans_status', 'NOT_SELECTED'),
                              ('plan_reviews_decision_check', 'NOT_ENDORSED'),
                              ('chk_plan_reviews_step', 'ENDORSEMENT'),
                              ('chk_plan_reviews_comment', 'ENDORSED')) AS e(name, must_contain)
    LOOP
        SELECT pg_get_constraintdef(oid) INTO def FROM pg_constraint WHERE conname = expected.name;
        IF def IS NULL THEN
            problems := problems || (expected.name || ' missing');
        ELSIF def NOT LIKE '%' || expected.must_contain || '%' THEN
            problems := problems || (expected.name || ' lacks ' || expected.must_contain);
        END IF;
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'plan_reviews' AND column_name = 'step') THEN
        problems := problems || 'plan_reviews.step missing'::text;
    END IF;

    -- ENDORSED and ELIGIBLE count as a plan in flight.
    IF coalesce(pg_get_indexdef(to_regclass('public.uq_coop_plans_active_period')), '') NOT LIKE '%ELIGIBLE%' THEN
        problems := problems || 'uq_coop_plans_active_period missing or without ELIGIBLE'::text;
    END IF;

    IF cardinality(problems) > 0 THEN
        RAISE EXCEPTION 'v3_04 verify failed: %', array_to_string(problems, '; ');
    END IF;
    RAISE NOTICE 'ok: constraints, plan_reviews.step and uq_coop_plans_active_period';
END $$;

\echo '== plans by status =='
SELECT status, count(*) AS plans FROM coop_plans GROUP BY status ORDER BY status;

\echo '== accounts by role =='
SELECT role, count(*) FILTER (WHERE is_active) AS active, count(*) AS total
FROM app_users GROUP BY role ORDER BY role;
