// POST /coop-plans/{planId}/endorse — #147 (D2 in #125).
//
// The advisor's step: endorse a submitted plan (ENDORSED), or decline to with a
// reason, which returns it to the student (RETURNED). Endorsing is not
// approving; the plan still goes to screening (#148) and selection (#149).
// Locking and the 409 rule live in planStepDecision.mjs.

import { assertCanEndorsePlan } from './authorize.mjs';
import { recordStepDecision } from './planStepDecision.mjs';

const ENDORSEMENT = {
  label: 'endorseCoopPlan',
  step: 'ENDORSEMENT',
  fromStatus: 'SUBMITTED',
  statusFor: { ENDORSED: 'ENDORSED', NOT_ENDORSED: 'RETURNED' },
  positive: 'ENDORSED',
  reasonMessage: 'A reason is required when not endorsing a plan.',
  authorize: assertCanEndorsePlan,
  notDecidable: {
    code: 'PLAN_NOT_ENDORSABLE',
    message: 'Only a SUBMITTED plan can be endorsed. It may already have been decided.',
  },
};

export function endorseCoopPlan(event) {
  return recordStepDecision(event, ENDORSEMENT);
}
