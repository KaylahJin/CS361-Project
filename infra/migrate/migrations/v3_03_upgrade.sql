ALTER TABLE periods
    ADD COLUMN min_gpa NUMERIC(3, 2),
    ADD COLUMN min_group_gpa NUMERIC(3, 2),
    ADD COLUMN capacity INTEGER;