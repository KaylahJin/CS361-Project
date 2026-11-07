// POST /coop-plans/{planId}/select — #149 (D2 in #125).
//
// The committee's step, on a plan that passed screening (ELIGIBLE): SELECTED,
// within the period's capacity (#151), or NOT_SELECTED with a reason. Both
// are final for the period (v3_05). Locking and the 409 rule for the plan
// live in planStepDecision.mjs.
//
// Capacity: the period row is locked (FOR UPDATE) before the seats are
// counted, in the same transaction as the write. Two committee members
// selecting the last seat therefore queue on that row; the second counts
// after the first has committed, sees no seat left and gets 409.

import { assertCanSelectPlan } from './authorize.mjs';
import { recordStepDecision } from './planStepDecision.mjs';
import { jsonResponse } from './response.mjs';

const LOCK_PERIOD = `SELECT capacity FROM periods WHERE period_id = $1 FOR UPDATE`;

// APPROVED is the single-step approval before #148; such a plan took a seat
// in its period just the same.
const COUNT_TAKEN = `SELECT count(*)::int AS taken
FROM coop_plans
WHERE period_id = $1 AND status IN ('SELECTED', 'APPROVED')`;

async function checkCapacity(client, plan, decision) {
  if (decision !== 'SELECTED') return null;

  const period = (await client.query(LOCK_PERIOD, [plan.period_id])).rows[0];
  const capacity = Number(period?.capacity);
  if (period?.capacity == null || !Number.isInteger(capacity) || capacity < 1) {
    return jsonResponse(409, {
      error: 'Conflict',
      code: 'CAPACITY_NOT_SET',
      message: 'This period has no valid capacity, so no one can be selected yet.',
    });
  }

  const { taken } = (await client.query(COUNT_TAKEN, [plan.period_id])).rows[0];
  if (taken >= capacity) {
    return jsonResponse(409, {
      error: 'Conflict',
      code: 'CAPACITY_REACHED',
      message: 'Every seat in this period is already taken.',
      capacity,
      selected: taken,
    });
  }
  return null;
}

const SELECTION = {
  label: 'selectCoopPlan',
  step: 'SELECTION',
  fromStatus: 'ELIGIBLE',
  statusFor: { SELECTED: 'SELECTED', NOT_SELECTED: 'NOT_SELECTED' },
  positive: 'SELECTED',
  reasonMessage: 'A reason is required when a plan is not selected.',
  authorize: assertCanSelectPlan,
  beforeWrite: checkCapacity,
  notDecidable: {
    code: 'PLAN_NOT_SELECTABLE',
    message: 'Only a plan that passed screening can be selected. It may already have been decided.',
  },
};

export function selectCoopPlan(event) {
  return recordStepDecision(event, SELECTION);
}
