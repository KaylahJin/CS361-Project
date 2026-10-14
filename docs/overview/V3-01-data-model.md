# V3 Data Model Design

## 1. Existing Tables

Reuse the existing `students` and `coop_plans` tables.

The `coop_plans` table already contains plan status, `reviewer_name`, `reviewed_at`, and `review_comment`. Existing statuses include `PREPARING`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, and `REJECTED`.

## 2. Proposed New Tables

These tables are design proposals, not existing database changes.

### app_users

Links an authenticated account to a system role.

- `cognito_sub`: unique account identifier from a verified Cognito identity
- `role`: proposed values `STUDENT`, `ADVISOR`, or `ADMIN`
- `student_id`: optional reference to `students.student_id`
- `is_active`: whether the account is active

### advisor_student_assignments

Defines which students an advisor is responsible for.

- `advisor_sub`: reference to an advisor account
- `student_id`: reference to a student
- `created_at`: assignment creation time

A combined key on `advisor_sub` and `student_id` can prevent duplicate assignments.

### plan_reviews

Stores review history if the team requires it.

- `review_id`: primary key
- `plan_id`: reference to `coop_plans.plan_id`
- `reviewer_sub`: reference to the reviewer account
- `decision`: `APPROVED` or `REJECTED`
- `comment`: review comment or rejection reason
- `reviewed_at`: review time

## 3. Relationships

- One student can have multiple coop plans.
- User accounts can be linked to student records.
- Advisor assignments link advisor accounts to students.
- A coop plan can have multiple review records if review history is required.

## 4. Data Integrity and Migration

- Preserve existing student and coop plan data.
- Enforce foreign keys and valid role and decision values.
- Check ownership and advisor assignment in the backend.
- Save a review decision and its status change in one database transaction.
- Existing reviewer names cannot be safely mapped to user accounts without matching information.

## 5. Items to Confirm

- Are all three roles required?
- Will Cognito be used for authentication?
- Can a student have multiple advisors?
- Is review history required?
- Should the latest review remain in `coop_plans` while past reviews are stored separately?
- How will existing users be linked to accounts?

The proposed tables and constraints must be reviewed before database migration.
