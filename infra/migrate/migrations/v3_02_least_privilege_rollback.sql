-- V3-02 least privilege: rollback grants given to coop_app.
-- This revokes only the grants introduced by v3_02_least_privilege.sql.
-- It does not drop tables, roles, or application data.

BEGIN;

REVOKE SELECT ON TABLE
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
FROM coop_app;

REVOKE INSERT (student_id, period_id, position_id)
ON TABLE public.coop_plans
FROM coop_app;

REVOKE UPDATE (
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
FROM coop_app;

REVOKE INSERT (
    plan_id,
    reviewer_sub,
    decision,
    comment,
    reviewed_at
)
ON TABLE public.plan_reviews
FROM coop_app;

REVOKE SELECT, INSERT, DELETE
ON TABLE public.plan_attachments
FROM coop_app;

REVOKE USAGE, SELECT ON SEQUENCE
    public.coop_plans_plan_id_seq,
    public.plan_reviews_review_id_seq,
    public.plan_attachments_attachment_id_seq
FROM coop_app;

COMMIT;
