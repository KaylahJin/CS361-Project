// POST /coop-plans/{planId}/endorse — #147 (D2 in #125).
//
// The advisor's step: endorse a submitted plan (ENDORSED), or decline to with a
// reason, which returns it to the student (RETURNED). Endorsing is not
// approving; the plan still goes to screening (#148) and selection (#149).
//
// Same concurrency rule as review: the plan row is locked and must still be
// SUBMITTED, so a second decision on the same plan answers 409 and overwrites
// nothing. The status change and the plan_reviews row commit together.

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { assertCanEndorsePlan } from './authorize.mjs';
import { SELECT_PLAN_BY_ID, isValidPlanId } from './planQueries.mjs';
import { errorResponse, internalError, forbiddenFrom, resolveCaller } from './planHttp.mjs';
import { parseJsonObject, findUnknownField } from './requestBody.mjs';

const LABEL = 'endorseCoopPlan';
const MAX_COMMENT = 2000;

// The decision a caller sends, and the plan status it leads to.
const STATUS_FOR = { ENDORSED: 'ENDORSED', NOT_ENDORSED: 'RETURNED' };

const LOCK_PLAN = `SELECT plan_id, student_id, status FROM coop_plans WHERE plan_id = $1 FOR UPDATE`;

const UPDATE_PLAN = `UPDATE coop_plans
SET status = $1, reviewer_name = $2, reviewed_at = NOW(), review_comment = $3, updated_at = NOW()
WHERE plan_id = $4`;

const INSERT_REVIEW = `INSERT INTO plan_reviews (plan_id, reviewer_sub, step, decision, comment)
VALUES ($1, $2, 'ENDORSEMENT', $3, $4)`;

/** Returns `{ decision, comment }` or `{ response }` with the 400 to send. */
function readBody(event) {
  const parsed = parseJsonObject(event);
  if (!parsed.ok) return { response: errorResponse(400, 'INVALID_BODY', parsed.message) };

  const unknown = findUnknownField(parsed.value, ['decision', 'comment']);
  if (unknown) {
    return { response: errorResponse(400, 'UNKNOWN_FIELD', `Field '${unknown}' is not accepted.`) };
  }

  const { decision, comment } = parsed.value;
  if (!Object.hasOwn(STATUS_FOR, decision)) {
    return {
      response: errorResponse(400, 'INVALID_DECISION', "decision must be 'ENDORSED' or 'NOT_ENDORSED'."),
    };
  }
  if (comment != null && typeof comment !== 'string') {
    return { response: errorResponse(400, 'INVALID_COMMENT', 'comment must be a string.') };
  }

  const trimmed = (comment ?? '').trim();
  if (decision === 'NOT_ENDORSED' && !trimmed) {
    return {
      response: errorResponse(400, 'COMMENT_REQUIRED', 'A reason is required when not endorsing a plan.'),
    };
  }
  if (trimmed.length > MAX_COMMENT) {
    return {
      response: errorResponse(400, 'COMMENT_TOO_LONG', `comment must be at most ${MAX_COMMENT} characters.`),
    };
  }
  return { decision, comment: trimmed || null };
}

export async function endorseCoopPlan(event) {
  const rawPlanId = event?.pathParameters?.planId;
  if (!isValidPlanId(rawPlanId)) {
    return errorResponse(400, 'INVALID_PLAN_ID', 'planId must be a positive integer.');
  }
  const planId = Number(rawPlanId.trim());

  const caller = await resolveCaller(event, LABEL);
  if (caller.response) return caller.response;
  const { user } = caller;

  const body = readBody(event);
  if (body.response) return body.response;

  const claims = event?.requestContext?.authorizer?.jwt?.claims;
  const reviewerName = claims?.name || claims?.email || user.sub;

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const plan = (await client.query(LOCK_PLAN, [planId])).rows[0];
    if (!plan) {
      await client.query('ROLLBACK');
      return errorResponse(404, 'PLAN_NOT_FOUND', 'Coop plan not found.');
    }

    try {
      await assertCanEndorsePlan(user, plan, client);
    } catch (err) {
      await client.query('ROLLBACK');
      return forbiddenFrom(err, LABEL);
    }

    if (plan.status !== 'SUBMITTED') {
      await client.query('ROLLBACK');
      return jsonResponse(409, {
        error: 'Conflict',
        code: 'PLAN_NOT_ENDORSABLE',
        message: 'Only a SUBMITTED plan can be endorsed. It may already have been decided.',
        currentStatus: plan.status,
      });
    }

    await client.query(UPDATE_PLAN, [STATUS_FOR[body.decision], reviewerName, body.comment, planId]);
    await client.query(INSERT_REVIEW, [planId, user.sub, body.decision, body.comment]);
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection is already gone; the original error is the one to report.
    }
    console.error(`${LABEL} failed`, err);
    return internalError();
  } finally {
    client.release();
  }

  try {
    const result = await getPool().query(SELECT_PLAN_BY_ID, [planId]);
    return jsonResponse(200, result.rows[0]);
  } catch (err) {
    console.error(`${LABEL} read-back failed`, err);
    return internalError();
  }
}
