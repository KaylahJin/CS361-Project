-- Issue #25 evidence. Open in pgAdmin Query Tool, run one section at a time.
-- Each section answers one reviewer comment.

-- [1] Schema / columns of companies
--     "ภาพยังไม่แสดง column/schema ของ companies"
SELECT ordinal_position AS pos, column_name, data_type,
       character_maximum_length AS max_len, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'companies'
ORDER BY ordinal_position;

-- [1b] Constraints and indexes
SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'companies';

SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'companies';

-- [2] Row count
--     "ข้อมูลจริงบริษัทมี 103 บริษัท"
SELECT count(*) AS total_companies FROM companies;

-- [3] DISTINCT province, and how many companies per province
--     "ยังไม่เห็นข้อมูล province หรือ DISTINCT province"
SELECT DISTINCT province FROM companies ORDER BY province;

SELECT province, count(*) AS companies
FROM companies
GROUP BY province
ORDER BY companies DESC, province;

-- [4] Sample data — two companies from each province, so it is not all Bangkok
--     "มีแค่ count ไม่มีตัวอย่างข้อมูล"
SELECT company_id, name, short_name, province, location, logo_filename, url
FROM (
  SELECT *, row_number() OVER (PARTITION BY province ORDER BY company_id) AS rn
  FROM companies
) t
WHERE rn <= 2
ORDER BY province, company_id;

-- [5] Validation — every check must read PASS
--     "ไม่มี validation"
SELECT 'row count is 103' AS check,
       count(*)::text AS actual, '103' AS expected,
       CASE WHEN count(*) = 103 THEN 'PASS' ELSE 'FAIL' END AS result
FROM companies
UNION ALL
SELECT 'company_id unique', count(DISTINCT company_id)::text, count(*)::text,
       CASE WHEN count(DISTINCT company_id) = count(*) THEN 'PASS' ELSE 'FAIL' END
FROM companies
UNION ALL
SELECT 'no NULL in NOT NULL columns',
       count(*) FILTER (WHERE name IS NULL OR province IS NULL OR location IS NULL)::text, '0',
       CASE WHEN count(*) FILTER (WHERE name IS NULL OR province IS NULL OR location IS NULL) = 0
            THEN 'PASS' ELSE 'FAIL' END
FROM companies
UNION ALL
SELECT 'no blank name/province/location',
       count(*) FILTER (WHERE btrim(name) = '' OR btrim(province) = '' OR btrim(location) = '')::text, '0',
       CASE WHEN count(*) FILTER (WHERE btrim(name) = '' OR btrim(province) = '' OR btrim(location) = '') = 0
            THEN 'PASS' ELSE 'FAIL' END
FROM companies
UNION ALL
SELECT 'company_id format Cnn', count(*) FILTER (WHERE company_id !~ '^C[0-9]+$')::text, '0',
       CASE WHEN count(*) FILTER (WHERE company_id !~ '^C[0-9]+$') = 0 THEN 'PASS' ELSE 'FAIL' END
FROM companies
UNION ALL
SELECT 'more than one province', count(DISTINCT province)::text, '> 1',
       CASE WHEN count(DISTINCT province) > 1 THEN 'PASS' ELSE 'FAIL' END
FROM companies
UNION ALL
SELECT 'every url is https', count(*) FILTER (WHERE url IS NOT NULL AND url NOT LIKE 'https://%')::text, '0',
       CASE WHEN count(*) FILTER (WHERE url IS NOT NULL AND url NOT LIKE 'https://%') = 0
            THEN 'PASS' ELSE 'FAIL' END
FROM companies
UNION ALL
-- province must be a real Thai province, not a leftover address fragment
SELECT 'province has no digits', count(*) FILTER (WHERE province ~ '[0-9]')::text, '0',
       CASE WHEN count(*) FILTER (WHERE province ~ '[0-9]') = 0 THEN 'PASS' ELSE 'FAIL' END
FROM companies
UNION ALL
-- Search and filter need enough rows to be worth testing
SELECT 'provinces with 2+ companies', count(*)::text, '>= 3',
       CASE WHEN count(*) >= 3 THEN 'PASS' ELSE 'FAIL' END
FROM (SELECT province FROM companies GROUP BY province HAVING count(*) >= 2) p;

-- [0] All companies, every column. Sort by the numeric part of company_id,
--     otherwise C100 lands between C10 and C11.
SELECT row_number() OVER (ORDER BY substring(company_id FROM 2)::int) AS no,
       company_id, name, short_name, province, location, logo_filename, url
FROM companies
ORDER BY substring(company_id FROM 2)::int;

-- [0b] Short version — fits on one screen
SELECT row_number() OVER (ORDER BY substring(company_id FROM 2)::int) AS no,
       company_id, short_name, province, name
FROM companies
ORDER BY substring(company_id FROM 2)::int;

-- [6] Proof the data is no longer static — companies not present in the old
--     81-row registry seed, i.e. the ones that were missing before.
SELECT company_id, name, province
FROM companies
WHERE company_id IN ('C89','C90','C91','C92','C93','C94','C95','C96','C97','C98','C99','C100',
                     'C101','C102','C103','C104','C105','C106','C107','C108','C109','C110','C111','C112')
ORDER BY company_id;
