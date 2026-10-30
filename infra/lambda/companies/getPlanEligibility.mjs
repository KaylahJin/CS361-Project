// GET /coop-plans/{planId}/eligibility — #148.
//
// The screening form shows staff how the plan's student measures up to the
// criteria of the plan's own period. Same rules as submission
// (checkEligibility); nothing is written. Documents are not part of this:
// staff reads the attachment list and decides INCOMPLETE themselves.

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { assertCanScreenPlan } from './authorize.mjs';
import { checkEligibility } from './eligibility.mjs';
import { isValidPlanId } from './planQueries.mjs';
import { errorResponse, internalError, forbiddenFrom, resolveCaller } from './planHttp.mjs';

const LABEL = 'getPlanEligibility';

const SELECT_PLAN = `SELECT p.plan_id, p.student_id, p.period_id,
       per.min_gpa::float8 AS min_gpa, per.min_group_gpa::float8 AS min_group_gpa
FROM coop_plans p
LEFT JOIN periods per ON per.period_id = p.period_id
WHERE p.plan_id = $1`;

export async function getPlanEligibility(event) {
  const rawPlanId = event?.pathParameters?.planId;
  if (!isValidPlanId(rawPlanId)) {
    return errorResponse(400, 'INVALID_PLAN_ID', 'planId must be a positive integer.');
  }

  const caller = await resolveCaller(event, LABEL);
  if (caller.response) return caller.response;

  // Role only, so a refused caller learns nothing about which plans exist.
  try {
    await assertCanScreenPlan(caller.user);
  } catch (err) {
    return forbiddenFrom(err, LABEL);
  }

  try {
    const pool = getPool();
    const plan = (await pool.query(SELECT_PLAN, [Number(rawPlanId.trim())])).rows[0];
    if (!plan) return errorResponse(404, 'PLAN_NOT_FOUND', 'Coop plan not found.');

    const failures = await checkEligibility(pool, plan.student_id, plan.period_id);
    return jsonResponse(200, {
      plan_id: plan.plan_id,
      period_id: plan.period_id,
      criteria: { min_gpa: plan.min_gpa, min_group_gpa: plan.min_group_gpa },
      eligible: failures.length === 0,
      failures,
    });
  } catch (err) {
    console.error(`${LABEL} failed`, err);
    return internalError();
  }
}
