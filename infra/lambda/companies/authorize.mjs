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

// Same assignment lookup as ASSIGNED_STUDENTS, against the students table.
// Both student queries alias it `s`, so the fragment can be qualified: the
// detail query joins student_courses, which also has a student_id column, and
// an unqualified one is ambiguous there.
const ASSIGNED_STUDENT_ROWS = `s.student_id IN (
  SELECT student_id FROM advisor_student_assignments WHERE advisor_sub = ${PARAM}
)`;

const IDENTITY_COLUMNS = ['s.student_id', 's.first_name', 's.last_name', 's.curriculum'];
const CONTACT_COLUMNS = ['s.email', 's.phone'];
// Formatted in SQL so a Date is never shifted by a timezone on the way out.
const BIRTH_DATE_COLUMN = "to_char(s.birth_date, 'YYYY-MM-DD') AS birth_date";
const GPA_COLUMN = 's.gpa::float8 AS gpa';

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

/**
 * Throws ForbiddenError when this caller may not review this plan.
 * Staff may review any plan. Advisors may only review plans belonging
 * to their assigned students. Students and Admins may not review plans.
 */
export async function assertCanReviewPlan(user, plan, queryable = getPool()) {
  if (user.role === 'STAFF') return;

  if (user.role === 'ADVISOR') {
    const result = await queryable.query(IS_ASSIGNED, [user.sub, plan.student_id]);
    if (result.rows.length > 0) return;
    throw new ForbiddenError('advisor is not assigned to this student');
  }

  throw new ForbiddenError(`role ${user.role} may not review coop plans`);
}

/**
 * Row filter for the student routes, same shape as buildCoopPlanListFilter:
 * a SQL fragment with `$PARAM` placeholders plus the params to bind. `sql` is
 * '' when the role may see every student.
 *
 * Out-of-scope rows are excluded here rather than checked after the read, so
 * "no such student" and "not yours" are the same zero-row answer and the row
 * never leaves the database. The handler turns zero rows into 404; see
 * docs/permission-matrix.md for why that is 404 and not 403.
 */
export async function buildStudentScope(user) {
  if (user.role === 'STUDENT') {
    // As in buildCoopPlanListFilter: `s.student_id = NULL` matches nothing, so
    // a broken account link would look like an empty result instead of the
    // configuration fault it is.
    if (!user.studentId) {
      throw new ForbiddenError('student account is not linked to a student record');
    }
    return { sql: `s.student_id = ${PARAM}`, params: [user.studentId] };
  }

  if (user.role === 'ADVISOR') {
    return { sql: ASSIGNED_STUDENT_ROWS, params: [user.sub] };
  }

  // An admin reads every student row. The limit on an admin is which columns,
  // which studentColumnsFor applies: resolving a student id to a person is the
  // account-management job, and nothing beyond that name is part of it.
  if (user.role === 'STAFF' || user.role === 'ADMIN') {
    return { sql: '', params: [] };
  }

  throw new ForbiddenError(`role ${user.role} may not read student records`);
}

/**
 * The student list page is for the people who look after students: Advisor,
 * Staff and Admin (D9 in #125). A student has no use for it and sees their own
 * record through the plan pages, so listing is refused for them and for any
 * role this module does not know. Fetching one student by id is not covered
 * here: buildStudentScope still lets a student read their own row.
 */
export function assertCanListStudents(user) {
  if (user.role === 'ADVISOR' || user.role === 'STAFF' || user.role === 'ADMIN') return;
  throw new ForbiddenError(`role ${user.role} may not list student records`);
}

/**
 * The columns this caller may read, plus whether student_courses should be
 * joined at all.
 *
 * Fields the role may not see are left out of the SELECT, so they are never
 * fetched and cannot be leaked by a later change to the response shape. A
 * role without academic rights does not join the courses table either.
 *
 * `birth_date` goes no further than the student's own row: nothing in V3 reads
 * it — no filter, no test, no verify script — and a field with no consumer has
 * nothing to weigh against handing it out.
 *
 * @returns {{columns: string[], includeCourses: boolean}}
 */
export function studentColumnsFor(user) {
  if (user.role === 'STUDENT') {
    return {
      columns: [...IDENTITY_COLUMNS, ...CONTACT_COLUMNS, BIRTH_DATE_COLUMN, GPA_COLUMN],
      includeCourses: true,
    };
  }

  if (user.role === 'ADVISOR' || user.role === 'STAFF') {
    return {
      columns: [...IDENTITY_COLUMNS, ...CONTACT_COLUMNS, GPA_COLUMN],
      includeCourses: true,
    };
  }

  if (user.role === 'ADMIN') {
    return { columns: [...IDENTITY_COLUMNS], includeCourses: false };
  }

  throw new ForbiddenError(`role ${user.role} may not read student records`);
}

/**
 * Writes are student-only: a plan is created and edited by the student it
 * belongs to, and by nobody else. ADVISOR and STAFF review plans (V3-05) but
 * never author them, and ADMIN has no plan access at all. Anything else,
 * including an unknown role, is refused.
 *
 * This is the role and ownership half only. Whether the plan's current status
 * allows the action is checked next to it, in planWorkflow.mjs.
 */
function assertLinkedStudent(user, action) {
  if (user.role !== 'STUDENT') {
    throw new ForbiddenError(`role ${user.role} may not ${action} coop plans`);
  }
  // Without this, a broken account link would compare against null and look
  // like "not the owner" instead of the configuration fault it is.
  if (!user.studentId) {
    throw new ForbiddenError('student account is not linked to a student record');
  }
}

/** Throws ForbiddenError unless this caller may create a plan for themselves. */
export function assertCanCreatePlan(user) {
  assertLinkedStudent(user, 'create');
}

/** Throws ForbiddenError unless this caller is the student who owns this already-fetched plan. */
export function assertCanEditPlan(user, plan) {
  assertLinkedStudent(user, 'edit');
  if (user.studentId !== plan.student_id) {
    throw new ForbiddenError('student does not own this plan');
  }
}

/**
 * Submitting is the owner's act, like editing: only the student who owns this
 * already-fetched plan may submit it. Reviewers decide a plan after it is
 * submitted, they never submit one.
 */
export function assertCanSubmitPlan(user, plan) {
  assertLinkedStudent(user, 'submit');
  if (user.studentId !== plan.student_id) {
    throw new ForbiddenError('student does not own this plan');
  }
}
