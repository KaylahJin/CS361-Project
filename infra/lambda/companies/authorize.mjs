// Role and ownership rules for coop plans, kept in one place so later
// features import them instead of restating them.
//
// Deny by default: every function ends in a throw, so a role this module has
// never heard of is refused instead of silently allowed. ADMIN ends up there
// on purpose — an admin manages accounts and roles, and needs a STAFF or
// ADVISOR row to see a plan.
//
// Advisor assignments are never cached. An assignment can be revoked between
// two requests, and a cache would keep the revoked advisor reading the plan
// until it expired.

import { getPool } from './db.mjs';

/** Caller maps this to HTTP 403. */
export class ForbiddenError extends Error {}

// Stand-in placeholder. The caller owns the running $1/$2/... numbering for
// its query, so returning a literal '$1' here would collide with the filters
// it has already built.
const PARAM = '$PARAM';

const ASSIGNED_STUDENTS = `p.student_id IN (
  SELECT student_id FROM advisor_student_assignments WHERE advisor_sub = ${PARAM}
)`;

const IS_ASSIGNED = `SELECT student_id
FROM advisor_student_assignments
WHERE advisor_sub = $1 AND student_id = $2`;

/**
 * Row filter for GET /coop-plans, as a SQL fragment plus its params. `sql` is
 * '' when the role may see every row; the caller replaces `$PARAM` with the
 * placeholder it allocates. Throws ForbiddenError when the role may not list.
 */
export async function buildCoopPlanListFilter(user) {
  if (user.role === 'STUDENT') {
    // `p.student_id = NULL` matches nothing in SQL, so without this guard a
    // student with no linked student record would see an empty list instead
    // of an error about the broken link.
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

/** Throws ForbiddenError when this caller may not read this already-fetched plan. */
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
