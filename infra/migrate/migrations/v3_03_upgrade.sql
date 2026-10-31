ALTER TABLE periods
    ADD COLUMN IF NOT EXISTS min_gpa NUMERIC(3, 2),
    ADD COLUMN IF NOT EXISTS min_group_gpa NUMERIC(3, 2),
    ADD COLUMN IF NOT EXISTS capacity INTEGER;

-- Defaults fill only what is still empty: db:load re-runs this file, and a
-- criterion someone has since changed must survive that.
UPDATE periods
SET
    min_gpa = COALESCE(min_gpa, 2.75),
    min_group_gpa = COALESCE(min_group_gpa, 2.50),
    capacity = COALESCE(capacity, 2)
WHERE period_id IN ('P2568-1', 'P2567-2');
