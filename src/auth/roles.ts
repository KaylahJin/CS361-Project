// Which roles see which parts of the web app. Display only: the API checks the
// role again on every request (infra/lambda/companies/authorize.mjs), so a role
// missing here loses a button, never gains access.
//
// STAFF is the Coordinator of D1 in #125 (#147 kept the name: the project
// brief calls them เจ้าหน้าที่สหกิจศึกษา). Change these lists and
// authorize.mjs together.

export type Role = 'STUDENT' | 'ADVISOR' | 'STAFF' | 'COMMITTEE' | 'ADMIN';

/**
 * Roles that open the decision form on a plan at their step: ADVISOR gets the
 * endorse form, STAFF the screening form, COMMITTEE the selection form.
 */
export const REVIEWER_ROLES: readonly string[] = ['ADVISOR', 'STAFF', 'COMMITTEE'];

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

/**
 * The search box, filters, status tabs and progress ring on the plan list are
 * for the people who work through many students' plans. A student only ever
 * sees their own, so none of it is shown to them (#203).
 */
export function canUsePlanReviewTools(role: string | null | undefined): boolean {
  return canViewCoopPlans(role) && role !== 'STUDENT';
}

/** Creating, editing, and submitting plans are student-only actions. */
export function canManageOwnPlan(role: string | null | undefined): boolean {
  return role === 'STUDENT';
}

export function canReviewPlans(role: string | null | undefined): boolean {
  return role != null && REVIEWER_ROLES.includes(role);
}

/**
 * The plan status each reviewer role acts on (D2 in #125): the advisor
 * endorses SUBMITTED plans, staff screens once the advisor has endorsed, and
 * the committee selects among the plans that passed screening.
 */
export function reviewableStatusFor(
  role: string | null | undefined
): 'SUBMITTED' | 'ENDORSED' | 'ELIGIBLE' {
  if (role === 'STAFF') return 'ENDORSED';
  if (role === 'COMMITTEE') return 'ELIGIBLE';
  return 'SUBMITTED';
}

/** The committee selects within the period's capacity (#149). */
export function canSelectPlans(role: string | null | undefined): boolean {
  return role === 'COMMITTEE';
}

/** Staff screens documents and criteria instead of approving (#148). */
export function canScreenPlans(role: string | null | undefined): boolean {
  return role === 'STAFF';
}

/** Advisors endorse instead of approving (#147). */
export function canEndorsePlans(role: string | null | undefined): boolean {
  return role === 'ADVISOR';
}

export function canViewStudentList(role: string | null | undefined): boolean {
  return role != null && STUDENT_LIST_ROLES.includes(role);
}
