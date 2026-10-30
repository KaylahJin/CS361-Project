// One step of the plan decision (D2 in #125), shared by endorse (#147),
// screen (#148) and select (#149). Each step names the role allowed to act,
// the status a plan must be in, and the plan status each decision leads to.
//
// Concurrency: the plan row is locked and must still be in `fromStatus`, so a
// second decision on the same plan answers 409 and overwrites nothing. The
// status change and the plan_reviews row commit together.

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { SELECT_PLAN_BY_ID, isValidPlanId } from './planQueries.mjs';
import { errorResponse, internalError, forbiddenFrom, resolveCaller } from './planHttp.mjs';
import { parseJsonObject, findUnknownField } from './requestBody.mjs';

const MAX_COMMENT = 2000;

const LOCK_PLAN = `SELECT plan_id, student_id, status FROM coop_plans WHERE plan_id = $1 FOR UPDATE`;

const UPDATE_PLAN = `UPDATE coop_plans
SET status = $1, reviewer_name = $2, reviewed_at = NOW(), review_comment = $3, updated_at = NOW()
WHERE plan_id = $4`;

/**
 * @typedef {object} PlanStep
 * @property {string} label        log prefix
 * @property {'ENDORSEMENT'|'SCREENING'|'SELECTION'} step  plan_reviews.step
 * @property {string} fromStatus   the only plan status this step acts on
 * @property {Record<string, string>} statusFor  decision -> plan status it leads to
 * @property {string} positive     the one decision that needs no reason
 * @property {string} reasonMessage   400 text when a reason is missing
 * @property {(user: object, plan: object, client: object) => Promise<void>} authorize  throws ForbiddenError
 * @property {{code: string, message: string}} notDecidable  409 when the plan is not in fromStatus
 */

/** Returns `{ decision, comment }` or `{ response }` with the 400 to send. */
function readBody(event, step) {
  const parsed = parseJsonObject(event);
  if (!parsed.ok) return { response: errorResponse(400, 'INVALID_BODY', parsed.message) };

  const unknown = findUnknownField(parsed.value, ['decision', 'comment']);
  if (unknown) {
    return { response: errorResponse(400, 'UNKNOWN_FIELD', `Field '${unknown}' is not accepted.`) };
  }

  const { decision, comment } = parsed.value;
  if (!Object.hasOwn(step.statusFor, decision)) {
    const allowed = Object.keys(step.statusFor).map((d) => `'${d}'`).join(', ');
    return { response: errorResponse(400, 'INVALID_DECISION', `decision must be one of ${allowed}.`) };
  }
  if (comment != null && typeof comment !== 'string') {
    return { response: errorResponse(400, 'INVALID_COMMENT', 'comment must be a string.') };
  }

  const trimmed = (comment ?? '').trim();
  if (decision !== step.positive && !trimmed) {
    return { response: errorResponse(400, 'COMMENT_REQUIRED', step.reasonMessage) };
  }
  if (trimmed.length > MAX_COMMENT) {
    return {
      response: errorResponse(400, 'COMMENT_TOO_LONG', `comment must be at most ${MAX_COMMENT} characters.`),
    };
  }
  return { decision, comment: trimmed || null };
}

/** Handles POST /coop-plans/{planId}/<step> for the given step. */
export async function recordStepDecision(event, step) {
  const rawPlanId = event?.pathParameters?.planId;
  if (!isValidPlanId(rawPlanId)) {
    return errorResponse(400, 'INVALID_PLAN_ID', 'planId must be a positive integer.');
  }
  const planId = Number(rawPlanId.trim());

  const caller = await resolveCaller(event, step.label);
  if (caller.response) return caller.response;
  const { user } = caller;

  const body = readBody(event, step);
  if (body.response) return body.response;

  const claims = event?.requestContext?.authorizer?.jwt?.claims;
  const reviewerName = claims?.name || claims?.email || user.sub;

  // step.step is one of three constants from code, never request input.
  const insertReview = `INSERT INTO plan_reviews (plan_id, reviewer_sub, step, decision, comment)
VALUES ($1, $2, '${step.step}', $3, $4)`;

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const plan = (await client.query(LOCK_PLAN, [planId])).rows[0];
    if (!plan) {
      await client.query('ROLLBACK');
      return errorResponse(404, 'PLAN_NOT_FOUND', 'Coop plan not found.');
    }

    try {
      await step.authorize(user, plan, client);
    } catch (err) {
      await client.query('ROLLBACK');
      return forbiddenFrom(err, step.label);
    }

    if (plan.status !== step.fromStatus) {
      await client.query('ROLLBACK');
      return jsonResponse(409, {
        error: 'Conflict',
        ...step.notDecidable,
        currentStatus: plan.status,
      });
    }

    await client.query(UPDATE_PLAN, [step.statusFor[body.decision], reviewerName, body.comment, planId]);
    await client.query(insertReview, [planId, user.sub, body.decision, body.comment]);
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection is already gone; the original error is the one to report.
    }
    console.error(`${step.label} failed`, err);
    return internalError();
  } finally {
    client.release();
  }

  try {
    const result = await getPool().query(SELECT_PLAN_BY_ID, [planId]);
    return jsonResponse(200, result.rows[0]);
  } catch (err) {
    console.error(`${step.label} read-back failed`, err);
    return internalError();
  }
}
