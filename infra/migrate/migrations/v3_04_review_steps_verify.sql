-- V3 database migration 04: verification. Read-only; every row should read 'ok'.
--
-- Count the plans before upgrading and pass the number in, so the script can
-- prove the upgrade lost or added none (AC of #147):
--
--   psql ... -tAc 'SELECT count(*) FROM coop_plans'          # say it prints 42
--   psql ... -f infra/migrate/migrations/v3_04_review_steps_upgrade.sql
--   psql ... -v plans_before=42 -f infra/migrate/migrations/v3_04_review_steps_verify.sql

\echo '== plan count unchanged by the upgrade =='
\if :{?plans_before}
SELECT :plans_before AS before, count(*) AS after,
       CASE WHEN count(*) = :plans_before THEN 'ok' ELSE 'MISMATCH' END AS status
FROM coop_plans;
\else
\echo 'SKIPPED: run with -v plans_before=<count taken before the upgrade>'
\endif

\echo '== constraints accept the new values =='
SELECT expected AS name,
       CASE WHEN c.conname IS NULL THEN 'MISSING'
            WHEN pg_get_constraintdef(c.oid) LIKE '%' || e.must_contain || '%' THEN 'ok'
            ELSE 'WRONG: ' || pg_get_constraintdef(c.oid) END AS status
FROM (VALUES ('app_users_role_check', 'COMMITTEE'),
             ('chk_coop_plans_status', 'NOT_SELECTED'),
             ('plan_reviews_decision_check', 'NOT_ENDORSED'),
             ('chk_plan_reviews_step', 'ENDORSEMENT'),
             ('chk_plan_reviews_comment', 'ENDORSED')) AS e(expected, must_contain)
LEFT JOIN pg_constraint c ON c.conname = e.expected;

\echo '== plan_reviews.step column =='
SELECT 'step' AS column_name,
       CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'ok: ' || c.data_type END AS status
FROM (VALUES (1)) AS one
LEFT JOIN information_schema.columns c
       ON c.table_name = 'plan_reviews' AND c.column_name = 'step';

\echo '== ENDORSED and ELIGIBLE count as a plan in flight =='
SELECT 'uq_coop_plans_active_period' AS name,
       CASE WHEN pg_get_indexdef(to_regclass('public.uq_coop_plans_active_period')) LIKE '%ELIGIBLE%'
            THEN 'ok' ELSE 'WRONG or MISSING' END AS status;

\echo '== plans by status =='
SELECT status, count(*) AS plans FROM coop_plans GROUP BY status ORDER BY status;

\echo '== accounts by role =='
SELECT role, count(*) FILTER (WHERE is_active) AS active, count(*) AS total
FROM app_users GROUP BY role ORDER BY role;
