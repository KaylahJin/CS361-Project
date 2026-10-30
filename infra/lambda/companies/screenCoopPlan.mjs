// POST /coop-plans/{planId}/screen — #148 (D2 in #125).
//
// Staff's step, after the advisor endorsed: check the documents and the
// period's criteria, then record ELIGIBLE, INCOMPLETE (documents missing, the
// plan goes back to the student as RETURNED) or NOT_ELIGIBLE. The last two
// need a reason. Only an ELIGIBLE plan goes on to selection (#149).
// Locking and the 409 rule live in planStepDecision.mjs.

import { assertCanScreenPlan } from './authorize.mjs';
import { recordStepDecision } from './planStepDecision.mjs';

const SCREENING = {
  label: 'screenCoopPlan',
  step: 'SCREENING',
  fromStatus: 'ENDORSED',
  statusFor: { ELIGIBLE: 'ELIGIBLE', INCOMPLETE: 'RETURNED', NOT_ELIGIBLE: 'NOT_ELIGIBLE' },
  positive: 'ELIGIBLE',
  reasonMessage: 'A reason is required when a plan is incomplete or not eligible.',
  authorize: assertCanScreenPlan,
  notDecidable: {
    code: 'PLAN_NOT_SCREENABLE',
    message: 'Only a plan the advisor endorsed can be screened. It may already have been decided.',
  },
};

export function screenCoopPlan(event) {
  return recordStepDecision(event, SCREENING);
}
