ALTER TABLE periods
    ADD COLUMN min_gpa NUMERIC(3, 2),
    ADD COLUMN min_group_gpa NUMERIC(3, 2),
    ADD COLUMN capacity INTEGER;

UPDATE periods
SET
    min_gpa = 2.75,
    min_group_gpa = 2.50,
    capacity = 2
WHERE period_id = 'P2568-1';

UPDATE periods
SET
    min_gpa = 2.75,
    min_group_gpa = 2.50,
    capacity = 2
WHERE period_id = 'P2567-2';