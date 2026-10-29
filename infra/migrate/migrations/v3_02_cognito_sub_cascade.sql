-- Preserve assignments and review history when an approved Cognito sub changes.
BEGIN;

ALTER TABLE advisor_student_assignments
  DROP CONSTRAINT IF EXISTS advisor_student_assignments_advisor_sub_fkey;
ALTER TABLE advisor_student_assignments
  ADD CONSTRAINT advisor_student_assignments_advisor_sub_fkey
  FOREIGN KEY (advisor_sub) REFERENCES app_users(cognito_sub)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE plan_reviews
  DROP CONSTRAINT IF EXISTS plan_reviews_reviewer_sub_fkey;
ALTER TABLE plan_reviews
  ADD CONSTRAINT plan_reviews_reviewer_sub_fkey
  FOREIGN KEY (reviewer_sub) REFERENCES app_users(cognito_sub)
  ON UPDATE CASCADE;

COMMIT;
