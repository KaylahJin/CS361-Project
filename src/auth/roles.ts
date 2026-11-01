// Which roles see which parts of the web app. Display only: the API checks the
// role again on every request (infra/lambda/companies/authorize.mjs), so a role
// missing here loses a button, never gains access.
//
// When #147 (P4.1) renames STAFF to COORDINATOR and adds COMMITTEE, change
// these lists and authorize.mjs together.

export type Role = 'STUDENT' | 'ADVISOR' | 'STAFF' | 'ADMIN';

/** Roles that open the review form on a submitted plan. */
export const REVIEWER_ROLES: readonly string[] = ['ADVISOR', 'STAFF'];

/** Roles that get the student list page (D9 in #125). */
export const STUDENT_LIST_ROLES: readonly string[] = ['ADVISOR', 'STAFF', 'ADMIN'];

/** Roles with a supported workflow on the coop-plan page. */
export const COOP_PLAN_ROLES: readonly string[] = [
  'STUDENT',
  'ADVISOR',
  'STAFF',
  'COORDINATOR',
  'COMMITTEE',
];

export function canViewCoopPlans(role: string | null | undefined): boolean {
  return role != null && COOP_PLAN_ROLES.includes(role);
}

/** Creating, editing, and submitting plans are student-only actions. */
export function canManageOwnPlan(role: string | null | undefined): boolean {
  return role === 'STUDENT';
}

export function canReviewPlans(role: string | null | undefined): boolean {
  return role != null && REVIEWER_ROLES.includes(role);
}

export function canViewStudentList(role: string | null | undefined): boolean {
  return role != null && STUDENT_LIST_ROLES.includes(role);
}
