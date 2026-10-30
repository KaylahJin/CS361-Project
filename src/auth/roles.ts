// Which roles see which parts of the web app. Display only: the API checks the
// role again on every request (infra/lambda/companies/authorize.mjs), so a role
// missing here loses a button, never gains access.
//
// STAFF is the Coordinator of D1 in #125 (#147 kept the name: the project
// brief calls them เจ้าหน้าที่สหกิจศึกษา). Change these lists and
// authorize.mjs together.

export type Role = 'STUDENT' | 'ADVISOR' | 'STAFF' | 'COMMITTEE' | 'ADMIN';

/** Roles that open the plan form on a submitted plan: ADVISOR gets the endorse form, STAFF the review form. */
export const REVIEWER_ROLES: readonly string[] = ['ADVISOR', 'STAFF'];

/** Roles that get the student list page (D9 in #125). */
export const STUDENT_LIST_ROLES: readonly string[] = ['ADVISOR', 'STAFF', 'ADMIN'];

export function canReviewPlans(role: string | null | undefined): boolean {
  return role != null && REVIEWER_ROLES.includes(role);
}

/**
 * The plan status each reviewer role acts on (D2 in #125): the advisor
 * endorses SUBMITTED plans, staff reviews only once the advisor has endorsed.
 */
export function reviewableStatusFor(
  role: string | null | undefined
): 'SUBMITTED' | 'ENDORSED' {
  return role === 'STAFF' ? 'ENDORSED' : 'SUBMITTED';
}

/** Advisors endorse instead of approving (#147). */
export function canEndorsePlans(role: string | null | undefined): boolean {
  return role === 'ADVISOR';
}

export function canViewStudentList(role: string | null | undefined): boolean {
  return role != null && STUDENT_LIST_ROLES.includes(role);
}
