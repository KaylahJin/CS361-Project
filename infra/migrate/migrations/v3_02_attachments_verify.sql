-- V3-02 attachments: verification. Read-only; every row should read 'ok'.

\echo '== table =='
SELECT 'plan_attachments' AS table_name,
       CASE WHEN to_regclass('public.plan_attachments') IS NULL THEN 'MISSING' ELSE 'ok' END AS status;

\echo '== columns =='
SELECT expected AS column_name,
       CASE WHEN c.column_name IS NULL THEN 'MISSING' ELSE 'ok: ' || c.data_type END AS status
FROM (VALUES ('attachment_id'), ('plan_id'), ('s3_key'), ('file_name'),
             ('content_type'), ('size_bytes'), ('uploaded_by'), ('created_at')) AS e(expected)
LEFT JOIN information_schema.columns c
       ON c.table_name = 'plan_attachments' AND c.column_name = e.expected;

\echo '== plan_id type matches coop_plans.plan_id =='
SELECT (SELECT data_type FROM information_schema.columns
         WHERE table_name = 'coop_plans' AND column_name = 'plan_id')        AS coop_plans,
       (SELECT data_type FROM information_schema.columns
         WHERE table_name = 'plan_attachments' AND column_name = 'plan_id')  AS plan_attachments;

\echo '== constraints =='
SELECT expected AS name,
       CASE WHEN c.conname IS NULL THEN 'MISSING' ELSE 'ok' END AS status
FROM (VALUES ('chk_plan_attachments_type'), ('chk_plan_attachments_size'),
             ('chk_plan_attachments_name')) AS e(expected)
LEFT JOIN pg_constraint c ON c.conname = e.expected;

\echo '== index =='
SELECT 'idx_plan_attachments_plan' AS name,
       CASE WHEN to_regclass('public.idx_plan_attachments_plan') IS NULL
            THEN 'MISSING' ELSE 'ok' END AS status;