-- V3 database migration 05: verification. Read-only. Every check raises an
-- error when it fails, so run it with ON_ERROR_STOP=1 and a wrong state stops
-- the runner instead of scrolling past:
--
--   psql ... -v ON_ERROR_STOP=1 -f infra/migrate/migrations/v3_05_one_plan_per_period_verify.sql

DO $$
DECLARE
    def TEXT := pg_get_indexdef(to_regclass('public.uq_coop_plans_active_period'));
    want TEXT;
BEGIN
    IF def IS NULL THEN
        RAISE EXCEPTION 'v3_05 verify: uq_coop_plans_active_period is missing';
    END IF;
    IF def NOT LIKE 'CREATE UNIQUE INDEX%' THEN
        RAISE EXCEPTION 'v3_05 verify: uq_coop_plans_active_period is not unique: %', def;
    END IF;
    FOREACH want IN ARRAY ARRAY['PREPARING', 'SUBMITTED', 'RETURNED', 'ENDORSED', 'ELIGIBLE',
                                'SELECTED', 'NOT_SELECTED'] LOOP
        IF def NOT LIKE '%''' || want || '''%' THEN
            RAISE EXCEPTION 'v3_05 verify: % is not counted as the plan for its period: %', want, def;
        END IF;
    END LOOP;
    -- Each value is matched with its quotes, so 'ELIGIBLE' above never matched
    -- NOT_ELIGIBLE, and this catches it being added by mistake.
    IF def LIKE '%NOT_ELIGIBLE%' THEN
        RAISE EXCEPTION 'v3_05 verify: NOT_ELIGIBLE must not hold the period: %', def;
    END IF;
    RAISE NOTICE 'v3_05 verify: ok';
END $$;
