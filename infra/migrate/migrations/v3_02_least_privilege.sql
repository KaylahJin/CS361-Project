BEGIN;

-- Tables the Lambda API needs to read.
GRANT SELECT ON TABLE
    public.companies,
    public.positions,
    public.periods,
    public.position_periods,
    public.coop_info,
    public.students,
    public.student_courses,
    public.coop_schedules,
    public.app_users,
    public.advisor_student_assignments,
    public.coop_plans,
    public.plan_reviews
TO coop_app;

-- Creating a plan: allow only the necessary insert columns.
GRANT INSERT (student_id, period_id, position_id)
ON TABLE public.coop_plans
TO coop_app;

-- Students can edit and submit plans; reviewers can record decisions.
GRANT UPDATE (
    period_id,
    position_id,
    acknowledged_pre_course,
    terms_accepted_at,
    student_note,
    status,
    submitted_at,
    reviewer_name,
    reviewed_at,
    review_comment,
    updated_at
)
ON TABLE public.coop_plans
TO coop_app;

GRANT INSERT (
    plan_id,
    reviewer_sub,
    decision,
    comment,
    reviewed_at
)
ON TABLE public.plan_reviews
TO coop_app;

-- Required for automatically generated IDs.
GRANT USAGE, SELECT ON SEQUENCE
    public.coop_plans_plan_id_seq,
    public.plan_reviews_review_id_seq
TO coop_app;

COMMIT;
