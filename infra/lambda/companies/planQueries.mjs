// SQL shared by the V3-04 plan write handlers.

const MAX_INT4 = 2147483647;

// Same projection as getCoopPlanById, so a create or update answers with
// exactly the object the edit page would load, and the page needs no
// follow-up GET.
export const SELECT_PLAN_BY_ID = `SELECT p.plan_id, p.student_id, p.period_id, p.position_id, p.status,
       p.acknowledged_pre_course, p.terms_accepted_at, p.student_note,
       p.submitted_at, p.reviewer_name, p.reviewed_at, p.review_comment,
       p.created_at, p.updated_at,
       s.first_name, s.last_name, s.curriculum,
       pos.title AS position_title, pos.company_id,
       c.name AS company_name, c.short_name AS company_short_name,
       per.name AS period_name
FROM coop_plans p
JOIN students s ON s.student_id = p.student_id
LEFT JOIN positions pos ON pos.position_id = p.position_id
LEFT JOIN companies c ON c.company_id = pos.company_id
LEFT JOIN periods per ON per.period_id = p.period_id
WHERE p.plan_id = $1`;

// plan_id is an INTEGER column, so a non-numeric id has to be rejected before
// it reaches pg, which would throw and come back as a 500.
export function isValidPlanId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return false;
  const n = Number(value.trim());
  return n >= 1 && n <= MAX_INT4;
}
