// Plan status rules shared by the V3-04 write handlers.
//
// authorize.mjs answers "may this caller touch this plan at all" (role and
// ownership). This file answers the other half, "is the plan in a status that
// allows this action", which docs/permission-matrix.md leaves to each issue.
// V3-04.2 (submit) and V3-05 (review) add their own status rules next to
// these rather than restating them in a handler.

// docs/overview/V3-01-data-model.md §4: a student edits only PREPARING or
// RETURNED plans. SUBMITTED is waiting on a reviewer; APPROVED and REJECTED
// are final.
export const EDITABLE_PLAN_STATUSES = Object.freeze(['PREPARING', 'RETURNED']);

export function isEditableStatus(status) {
  return EDITABLE_PLAN_STATUSES.includes(status);
}

// docs/overview/V3-01-workflow-permissions.md §3: a student submits from
// PREPARING, and submits again from RETURNED once the plan has been fixed. Every
// other status is either waiting on a reviewer (SUBMITTED) or final (APPROVED,
// REJECTED, which need a new plan instead).
export const SUBMITTABLE_PLAN_STATUSES = Object.freeze(['PREPARING', 'RETURNED']);

export function isSubmittableStatus(status) {
  return SUBMITTABLE_PLAN_STATUSES.includes(status);
}
