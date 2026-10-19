// POST /coop-plans/{planId}/review — records a review decision (APPROVED, RETURNED, REJECTED)
// and reviewer comment for a submitted coop plan.
//
// Concurrency control: A plan can only be reviewed if its current status is 'SUBMITTED'.
// If another reviewer acts on the plan concurrently, the second request fails with 409 Conflict.
//
// The update to coop_plans and the audit record in plan_reviews are committed in a
// single database transaction.

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { getAuthenticatedUser } from './auth.mjs';
import { assertCanReviewPlan, ForbiddenError } from './authorize.mjs';

const MAX_INT4 = 2147483647;
const VALID_DECISIONS = new Set(['APPROVED', 'RETURNED', 'REJECTED']);

function isValidPlanId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return false;
  const n = Number(value.trim());
  return n >= 1 && n <= MAX_INT4;
}

export async function reviewCoopPlan(event) {
  const planId = event?.pathParameters?.planId;

  if (!isValidPlanId(planId)) {
    return jsonResponse(400, { error: 'planId must be a positive integer' });
  }
  const planIdNum = Number(planId.trim());

  let user;
  try {
    const resolved = await getAuthenticatedUser(event);
    if (resolved.denied) {
      return jsonResponse(resolved.denied.status, { error: resolved.denied.error });
    }
    user = resolved.user;
  } catch (err) {
    console.error('reviewCoopPlan auth failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }

  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body || {});
  } catch {
    return jsonResponse(400, { error: 'Request body must be valid JSON' });
  }

  const { decision, comment } = body;

  if (!decision || typeof decision !== 'string' || !VALID_DECISIONS.has(decision)) {
    return jsonResponse(400, {
      error: "decision must be one of 'APPROVED', 'RETURNED', 'REJECTED'",
    });
  }

  const trimmedComment = typeof comment === 'string' ? comment.trim() : '';

  if ((decision === 'RETURNED' || decision === 'REJECTED') && !trimmedComment) {
    return jsonResponse(400, {
      error: `comment is required when decision is ${decision}`,
    });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock plan row to check permission and concurrency state
    const selectRes = await client.query(
      `SELECT plan_id, student_id, status FROM coop_plans WHERE plan_id = $1 FOR UPDATE`,
      [planIdNum],
    );

    if (selectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return jsonResponse(404, { error: 'Coop plan not found' });
    }

    const plan = selectRes.rows[0];

    try {
      await assertCanReviewPlan(user, plan, client);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err instanceof ForbiddenError) {
        return jsonResponse(403, { error: 'Forbidden' });
      }
      throw err;
    }

    // Must be in SUBMITTED status
    if (plan.status !== 'SUBMITTED') {
      await client.query('ROLLBACK');
      return jsonResponse(409, {
        error: 'Conflict: plan is not in SUBMITTED status',
        currentStatus: plan.status,
      });
    }

    const claims = event?.requestContext?.authorizer?.jwt?.claims;
    const reviewerName = claims?.name || claims?.email || user.sub;

    // 1. Update latest status and review details on coop_plans
    await client.query(
      `UPDATE coop_plans
       SET status = $1, reviewer_name = $2, reviewed_at = NOW(),
           review_comment = $3, updated_at = NOW()
       WHERE plan_id = $4`,
      [decision, reviewerName, trimmedComment || null, planIdNum],
    );

    // 2. Insert audit record into plan_reviews
    await client.query(
      `INSERT INTO plan_reviews (plan_id, reviewer_sub, decision, comment, reviewed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [planIdNum, user.sub, decision, trimmedComment || null],
    );

    await client.query('COMMIT');

    return jsonResponse(200, {
      success: true,
      plan_id: planIdNum,
      status: decision,
      reviewer_name: reviewerName,
      review_comment: trimmedComment || null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('reviewCoopPlan database transaction failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  } finally {
    client.release();
  }
}
