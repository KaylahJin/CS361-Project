// The write guard shared by "confirm upload" and "delete attachment".
//
// Both change what is attached to a plan, so both must pass the same three
// checks, in the same order, and the third must hold at the moment of the write:
//
//   404 no such plan
//   403 not a student, or not the owner     (authorize.mjs)
//   409 plan status is not PREPARING / RETURNED
//
// The plan row is read with SELECT ... FOR UPDATE inside a transaction, the
// same lock submitCoopPlan takes. That is what closes the gap the header of
// requestAttachmentUpload.mjs warns about: a plan submitted between "ask for a
// URL" and "finish uploading" holds the lock while its status changes, so this
// write either happens first (and the submit sees the file) or waits, then
// sees SUBMITTED and is refused. Looked at without the lock the status could
// be stale; under it, it is final.
//
// `work` runs inside the transaction with the plan locked and returns
//   { response, commit, afterCommit? }
// commit: true keeps what `work` wrote, false rolls it back. afterCommit runs
// once the transaction is over and the connection released, for slow work that
// must not hold the lock (an S3 call). Its failure is logged, never returned:
// by then the database change is already final.

import { getPool } from './db.mjs';
import { assertCanEditPlan } from './authorize.mjs';
import { EDITABLE_PLAN_STATUSES, isEditableStatus } from './planWorkflow.mjs';
import { errorResponse, internalError, forbiddenFrom, resolveCaller } from './planHttp.mjs';

const LOCK_PLAN = `SELECT plan_id, student_id, status
FROM coop_plans
WHERE plan_id = $1
FOR UPDATE`;

export async function withEditablePlan({ event, label, planId, work }) {
  console.log(`[${label}] before resolveCaller`);
  const caller = await resolveCaller(event, label);
  console.log(`[${label}] after resolveCaller`);

  if (caller.response) return caller.response;
  const { user } = caller;

  let client;
  try {
    console.log(`[${label}] before connect`);
    client = await getPool().connect();
    console.log(`[${label}] after connect`);
  } catch (err) {
    console.error(`${label} could not get a connection`, err);
    return internalError();
  }

  let outcome;
  try {
    console.log(`[${label}] before BEGIN`);
    await client.query('BEGIN');
    console.log(`[${label}] after BEGIN`);

    console.log(`[${label}] before LOCK_PLAN`);
    const plan = (await client.query(LOCK_PLAN, [planId])).rows[0];
    console.log(`[${label}] after LOCK_PLAN`);

    if (!plan) {
      await client.query('ROLLBACK');
      return errorResponse(404, 'PLAN_NOT_FOUND', 'Coop plan not found.');
    }

    try {
      assertCanEditPlan(user, plan);
    } catch (err) {
      await client.query('ROLLBACK');
      return forbiddenFrom(err, label);
    }

    // Allow-list, not block-list: SUBMITTED, ENDORSED, ELIGIBLE, SELECTED and
    // any status added later are refused without this file being edited.
    if (!isEditableStatus(plan.status)) {
      await client.query('ROLLBACK');
      return errorResponse(
        409,
        'PLAN_NOT_EDITABLE',
        `The files of a plan in status ${plan.status} cannot be changed. Only ${EDITABLE_PLAN_STATUSES.join(' or ')} plans can.`,
      );
    }

    outcome = await work({ client, user, plan, planId });
    await client.query(outcome.commit ? 'COMMIT' : 'ROLLBACK');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // The connection is already gone; the original error is the one to report.
    }
    console.error(`${label} failed`, err);
    return internalError();
  } finally {
    client.release();
  }

  if (outcome.afterCommit) {
    try {
      await outcome.afterCommit();
    } catch (err) {
      console.error(`${label} cleanup after commit failed`, err);
    }
  }
  return outcome.response;
}
