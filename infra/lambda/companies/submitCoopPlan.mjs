// POST /coop-plans/{planId}/submit — V3-04.2.
//
// Moves a plan from PREPARING (or RETURNED, for a resubmission) to SUBMITTED and
// stamps submitted_at, once the plan is complete, the student is eligible and
// the submission window is open. Every rule is enforced here, not on the page.
//
// Duplicate and concurrent requests: the checks and the UPDATE run in one
// transaction that first takes a row lock on the plan (SELECT ... FOR UPDATE).
// Two requests for the same plan queue on that lock; the second one then sees
// SUBMITTED and answers 409, so a plan is submitted exactly once. The same lock
// makes a PATCH wait too: an edit cannot slip in between "the plan was
// complete" and "the plan is now submitted" and strip a field the check relied
// on.
//
// The "at most one plan in progress per period" rule needs no code here:
// PREPARING, SUBMITTED and RETURNED all count towards it
// (uq_coop_plans_active_period), so moving between them never adds a plan.
//
// The request body is not read. Everything that decides the outcome comes from
// the database row and the verified token.

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { assertCanSubmitPlan } from './authorize.mjs';
import { SUBMITTABLE_PLAN_STATUSES, isSubmittableStatus } from './planWorkflow.mjs';
import { SELECT_PLAN_BY_ID, isValidPlanId } from './planQueries.mjs';
import { errorResponse, internalError, forbiddenFrom, resolveCaller } from './planHttp.mjs';
import { completenessFailures, windowFailures } from './submissionRules.mjs';
import { checkEligibility } from './eligibility.mjs';

const LABEL = 'submitCoopPlan';

const LOCK_PLAN = `SELECT plan_id, student_id, period_id, position_id, status,
       acknowledged_pre_course, terms_accepted_at
FROM coop_plans
WHERE plan_id = $1
FOR UPDATE`;

// is_open is decided in SQL against today's date in Thailand, the calendar the
// schedule dates are written in.
const SELECT_WINDOWS = `SELECT to_char(start_date, 'YYYY-MM-DD') AS start_date,
       to_char(end_date, 'YYYY-MM-DD') AS end_date,
       ((NOW() AT TIME ZONE 'Asia/Bangkok')::date BETWEEN start_date AND end_date) AS is_open
FROM coop_schedules
WHERE period_id = $1 AND activity_type = 'APPLICATION'
ORDER BY start_date`;

// The status and owner stay in the WHERE as a second guard; under the row lock
// they cannot have changed, so a miss here means something is badly wrong.
const MARK_SUBMITTED = `UPDATE coop_plans
SET status = 'SUBMITTED', submitted_at = NOW()
WHERE plan_id = $1
  AND student_id = $2
  AND status = ANY($3)
RETURNING plan_id`;

function notSubmittable(status) {
  if (status === 'SUBMITTED') {
    return errorResponse(
      409,
      'ALREADY_SUBMITTED',
      'This plan has already been submitted and is waiting for review.',
    );
  }
  return errorResponse(
    409,
    'PLAN_NOT_SUBMITTABLE',
    `A plan in status ${status} cannot be submitted. Only ${SUBMITTABLE_PLAN_STATUSES.join(' or ')} plans can.`,
  );
}

function requirementsNotMet(failures) {
  return jsonResponse(400, {
    error: 'Bad request',
    code: 'SUBMISSION_REQUIREMENTS_NOT_MET',
    message: `The plan cannot be submitted yet: ${failures.length} requirement(s) not met.`,
    failures,
  });
}

/**
 * The locked read, the checks and the write. Returns `{ response }` when the
 * plan was not submitted and `{ submitted: true }` when it was. Anything thrown
 * rolls the transaction back first.
 */
async function submitInTransaction(planId, studentId) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const locked = (await client.query(LOCK_PLAN, [planId])).rows[0];
    if (!locked) {
      await client.query('ROLLBACK');
      return { response: errorResponse(404, 'PLAN_NOT_FOUND', 'Coop plan not found.') };
    }

    // Looked at before the lock, this could be stale; under it, it is final.
    if (!isSubmittableStatus(locked.status)) {
      await client.query('ROLLBACK');
      return { response: notSubmittable(locked.status) };
    }

    const failures = completenessFailures(locked);

    if (locked.period_id) {
      const windows = await client.query(SELECT_WINDOWS, [locked.period_id]);
      failures.push(...windowFailures(windows.rows));
    }

    // The student comes from the plan row (already checked to be the caller's),
    // never from the request.
    failures.push(...(await checkEligibility(client, locked.student_id, locked.period_id,)));

    if (failures.length > 0) {
      await client.query('ROLLBACK');
      return { response: requirementsNotMet(failures) };
    }

    const updated = await client.query(MARK_SUBMITTED, [
      planId,
      studentId,
      [...SUBMITTABLE_PLAN_STATUSES],
    ]);
    if (updated.rowCount === 0) {
      await client.query('ROLLBACK');
      return { response: notSubmittable(locked.status) };
    }

    await client.query('COMMIT');
    return { submitted: true };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection is already gone; the original error is the one to report.
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function submitCoopPlan(event) {
  const rawPlanId = event?.pathParameters?.planId;
  if (!isValidPlanId(rawPlanId)) {
    return errorResponse(400, 'INVALID_PLAN_ID', 'planId must be a positive integer.');
  }
  const planId = Number(rawPlanId.trim());

  const caller = await resolveCaller(event, LABEL);
  if (caller.response) return caller.response;
  const { user } = caller;

  // Unlocked read, for the same answers every plan handler gives in the same
  // order: 404 before 403 before 409. The transaction below repeats the status
  // check under the lock, which is the one that counts.
  let plan;
  try {
    const found = await getPool().query(SELECT_PLAN_BY_ID, [planId]);
    plan = found.rows[0];
  } catch (err) {
    console.error(`${LABEL} read failed`, err);
    return internalError();
  }
  if (!plan) return errorResponse(404, 'PLAN_NOT_FOUND', 'Coop plan not found.');

  try {
    assertCanSubmitPlan(user, plan);
  } catch (err) {
    return forbiddenFrom(err, LABEL);
  }

  if (!isSubmittableStatus(plan.status)) return notSubmittable(plan.status);

  try {
    const outcome = await submitInTransaction(planId, user.studentId);
    if (outcome.response) return outcome.response;

    const result = await getPool().query(SELECT_PLAN_BY_ID, [planId]);
    if (result.rows.length === 0) throw new Error('submitted plan could not be read back');

    return jsonResponse(200, result.rows[0]);
  } catch (err) {
    console.error(`${LABEL} failed`, err);
    return internalError();
  }
}
