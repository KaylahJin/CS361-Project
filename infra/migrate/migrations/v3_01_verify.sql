-- V3 database migration: verification
--
--   psql ... -f infra/migrate/migrations/v3_01_verify.sql
--
-- Read-only on purpose. The earlier version inserted test rows and relied on
-- them failing, which aborts the script under ON_ERROR_STOP and leaves rows
-- behind when it does not. Every check below is a SELECT: run it against the
-- real database as often as you like.
--
-- Every row should read 'ok'. Anything reading 'MISSING' or a count that does
-- not match means the upgrade did not fully apply.

\echo '== tables =='
SELECT expected AS table_name,
       CASE WHEN to_regclass('public.' || expected) IS NULL THEN 'MISSING' ELSE 'ok' END AS status
FROM (VALUES ('app_users'), ('advisor_student_assignments'), ('plan_reviews')) AS t(expected);

\echo '== app_users columns =='
SELECT expected AS column_name,
       CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'ok: ' || c.data_type END AS status
FROM (VALUES ('cognito_sub'), ('email'), ('role'), ('student_id'), ('is_active')) AS e(expected)
LEFT JOIN information_schema.columns c
       ON c.table_name = 'app_users' AND c.column_name = e.expected;

\echo '== advisor_student_assignments columns =='
SELECT expected AS column_name,
       CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'ok: ' || c.data_type END AS status
FROM (VALUES ('advisor_sub'), ('student_id'), ('created_at')) AS e(expected)
LEFT JOIN information_schema.columns c
       ON c.table_name = 'advisor_student_assignments' AND c.column_name = e.expected;

\echo '== plan_reviews columns =='
SELECT expected AS column_name,
       CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'ok: ' || c.data_type END AS status
FROM (VALUES ('review_id'), ('plan_id'), ('reviewer_sub'), ('decision'), ('comment'), ('reviewed_at')) AS e(expected)
LEFT JOIN information_schema.columns c
       ON c.table_name = 'plan_reviews' AND c.column_name = e.expected;

\echo '== plan_reviews.plan_id matches coop_plans.plan_id type =='
SELECT (SELECT data_type FROM information_schema.columns
         WHERE table_name = 'coop_plans' AND column_name = 'plan_id')   AS coop_plans,
       (SELECT data_type FROM information_schema.columns
         WHERE table_name = 'plan_reviews' AND column_name = 'plan_id') AS plan_reviews;

\echo '== constraints and indexes =='
SELECT 'chk_coop_plans_status' AS name,
       CASE WHEN pg_get_constraintdef(oid) LIKE '%RETURNED%'
                 AND pg_get_constraintdef(oid) NOT LIKE '%UNDER_REVIEW%'
            THEN 'ok' ELSE 'WRONG: ' || pg_get_constraintdef(oid) END AS status
FROM pg_constraint WHERE conname = 'chk_coop_plans_status';

SELECT 'uq_coop_plans_active_period' AS name,
       CASE WHEN to_regclass('public.uq_coop_plans_active_period') IS NULL
            THEN 'MISSING' ELSE 'ok' END AS status;

\echo '== no plan left on a V2-only status =='
SELECT status, count(*) AS plans
FROM coop_plans
GROUP BY status
ORDER BY status;

\echo '== accounts by role (empty until app_users is seeded) =='
SELECT role, count(*) FILTER (WHERE is_active) AS active, count(*) AS total
FROM app_users
GROUP BY role
ORDER BY role;
