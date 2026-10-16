// ============================================================
// CS361 V3-02.3 — shared role/ownership authorization for coop-plans
// ============================================================
// Issue: #103 — จัดสรรและตรวจสอบสิทธิ์ตามบทบาท
//
// The one place the rules in docs/overview/V3-01-workflow-permissions.md §2
// are expressed in code. V3-04 and V3-05 must import this rather than
// restate the rules, which is what keeps the Permission Matrix in
// docs/permission-matrix.md true of the running system.
//
// Deny by default: every function ends in a throw, so a role this module
// has never heard of (a typo in app_users.role, a role added later and
// wired nowhere) is refused rather than silently allowed. ADMIN lands
// there deliberately — per the data model, "การเป็น ADMIN เพียงอย่างเดียว
// ไม่ให้สิทธิ์พิจารณาแผนโดยอัตโนมัติ": an admin manages accounts and roles,
// and needs a STAFF or ADVISOR row to see or review a plan.
//
// NO CACHING. Every advisor check re-queries advisor_student_assignments.
// An assignment can be revoked between two requests from the same advisor,
// and a cache — here, in the token, or in a module-level map — would keep a
// revoked advisor reading a student's plan until it expired. Do not add one.
//
// This module does not replace the per-function status and ownership checks
// V3-04 / V3-05 still owe (e.g. "may only edit a PREPARING or RETURNED
// plan"); it answers "may this role touch this student's plan at all".
// ============================================================

import { getPool } from './db.mjs';

/** Caller maps this to HTTP 403. */
export class ForbiddenError extends Error {}

// Substituted for the real placeholder number by the caller, which owns the
// running values array ($1/$2/...) for the rest of its query. Returning a
// literal '$1' here would collide with the filters the caller already built.
const PARAM = '$PARAM';

const ASSIGNED_STUDENTS = `p.student_id IN (
  SELECT student_id FROM advisor_student_assignments WHERE advisor_sub = ${PARAM}
)`;

const IS_ASSIGNED = `SELECT student_id
FROM advisor_student_assignments
WHERE advisor_sub = $1 AND student_id = $2`;

/**
 * Row-scope filter for GET /coop-plans, as a SQL fragment plus its params.
 *
 * @param {{sub: string, role: string, studentId: string | null}} user
 * @returns {Promise<{sql: string, params: unknown[]}>}
 *   `sql` is '' when the role may see every row. Any `$PARAM` in `sql` is
 *   replaced by the caller with the placeholder it allocates.
 * @throws {ForbiddenError} when the role may not list plans at all.
 */
export async function buildCoopPlanListFilter(user) {
  if (user.role === 'STUDENT') {
    // Guard the null: `p.student_id = NULL` matches nothing in SQL, so a
    // student account with no linked student row would quietly render an
    // empty list instead of surfacing the misconfiguration.
    if (!user.studentId) {
      throw new ForbiddenError('student account is not linked to a student record');
    }
    return { sql: `p.student_id = ${PARAM}`, params: [user.studentId] };
  }

  if (user.role === 'ADVISOR') {
    return { sql: ASSIGNED_STUDENTS, params: [user.sub] };
  }

  if (user.role === 'STAFF') {
    return { sql: '', params: [] };
  }

  throw new ForbiddenError(`role ${user.role} may not list coop plans`);
}

/**
 * Assert the caller may read one specific plan.
 *
 * @param {{sub: string, role: string, studentId: string | null}} user
 * @param {{student_id: string}} plan  the row already fetched by the caller
 * @returns {Promise<void>} resolves when allowed
 * @throws {ForbiddenError} when not
 */
export async function assertCanViewPlan(user, plan) {
  if (user.role === 'STAFF') return;

  if (user.role === 'STUDENT') {
    if (user.studentId && user.studentId === plan.student_id) return;
    throw new ForbiddenError('student does not own this plan');
  }

  if (user.role === 'ADVISOR') {
    const result = await getPool().query(IS_ASSIGNED, [user.sub, plan.student_id]);
    if (result.rows.length > 0) return;
    throw new ForbiddenError('advisor is not assigned to this student');
  }

  throw new ForbiddenError(`role ${user.role} may not view coop plans`);
}
