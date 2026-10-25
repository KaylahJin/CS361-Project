-- Evidence helper for #140 (lab database only).
-- Lowers or restores the GPA of the seeded student1 (6600000001) so that the
-- submission is also refused for "GPA below minimum". Seeded value: 2.90.
--
--   psql "host=<rds> user=postgres dbname=coop_db" -v gpa=2.40 -f scripts/evidence/140-set-student-gpa.sql
--   ... capture ...
--   psql "host=<rds> user=postgres dbname=coop_db" -v gpa=2.90 -f scripts/evidence/140-set-student-gpa.sql
UPDATE students SET gpa = :gpa WHERE student_id = '6600000001' RETURNING student_id, gpa;
