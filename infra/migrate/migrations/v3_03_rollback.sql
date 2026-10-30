ALTER TABLE periods
    DROP COLUMN IF EXISTS capacity,
    DROP COLUMN IF EXISTS min_group_gpa,
    DROP COLUMN IF EXISTS min_gpa;