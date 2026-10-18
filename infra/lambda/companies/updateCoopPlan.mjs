// PATCH /coop-plans/{planId} — a student edits their own draft or returned plan.
//
// Order of refusals, and why:
//   400 planId is not a positive integer         (before anything else, as GET does)
//   401/403 identity                              (auth.mjs)
//   404 no such plan
//   403 not a student, or not the owner           (authorize.mjs; plan_id is a
//                                                  surrogate key, so 403 — see
//                                                  docs/permission-matrix.md)
//   409 status is not PREPARING / RETURNED
//   400 body is empty, malformed, or names a field that may not be edited
//
// Ownership comes before status so a non-owner never learns what state
// someone else's plan is in, and both come before body validation so a caller
// with no right to the plan learns nothing about the request shape.
//
// The UPDATE repeats the owner and the status in its WHERE clause. The reads
// above give the specific answers (403 vs 409); the WHERE is what actually
// holds, because the plan can change between the SELECT and the UPDATE — a
// reviewer or a submit in between turns this write into a 409 instead of an
// edit to a plan that is no longer editable.
//
// What this handler cannot touch: `status`, `period_id`, `submitted_at` and
// every review column. Saving a draft is not submitting it (V3-04.2), and a
// RETURNED plan stays RETURNED, with the reviewer's comment still on it, until
// it is submitted again. Those fields are refused by name rather than ignored.
//
// There is no optimistic locking: two tabs editing the same draft are
// last-write-wins. coop_plans.updated_at is set by a trigger, but comparing it
// from JavaScript loses its microseconds, so a lock built on it would reject
// honest edits.

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { assertCanEditPlan } from './authorize.mjs';
import { EDITABLE_PLAN_STATUSES, isEditableStatus } from './planWorkflow.mjs';
import { SELECT_PLAN_BY_ID, isValidPlanId } from './planQueries.mjs';
import { parseJsonObject, findUnknownField } from './requestBody.mjs';
import {
  errorResponse,
  internalError,
  forbiddenFrom,
  mapPlanWriteError,
  resolveCaller,
} from './planHttp.mjs';

const LABEL = 'updateCoopPlan';
const EDITABLE_FIELDS = ['positionId', 'studentNote', 'acknowledgedPreCourse', 'termsAccepted'];

const MAX_POSITION_ID = 10;
// coop_plans.student_note is TEXT, so the database sets no limit. This one
// stops a request from storing megabytes in a note.
export const MAX_STUDENT_NOTE = 2000;

/**
 * @returns {{error: object} | {fields: {positionId?: string|null, studentNote?: string|null,
 *           acknowledgedPreCourse?: boolean, termsAccepted?: boolean}}}
 */
function validate(body) {
  const unknown = findUnknownField(body, EDITABLE_FIELDS);
  if (unknown !== null) {
    return {
      error: errorResponse(
        400,
        'UNKNOWN_FIELD',
        `Field "${unknown}" cannot be edited here. Editable fields: ${EDITABLE_FIELDS.join(', ')}.`,
      ),
    };
  }

  if (Object.keys(body).length === 0) {
    return {
      error: errorResponse(
        400,
        'NO_EDITABLE_FIELDS',
        `Provide at least one of: ${EDITABLE_FIELDS.join(', ')}.`,
      ),
    };
  }

  const bad = (message) => ({ error: errorResponse(400, 'INVALID_FIELD', message) });
  const fields = {};

  if ('positionId' in body) {
    const v = body.positionId;
    if (v === null) {
      fields.positionId = null;
    } else if (typeof v !== 'string' || v.trim() === '') {
      return bad('positionId must be a non-empty string, or null to clear it.');
    } else if (v.trim().length > MAX_POSITION_ID) {
      return bad(`positionId must be at most ${MAX_POSITION_ID} characters.`);
    } else {
      fields.positionId = v.trim();
    }
  }

  if ('studentNote' in body) {
    const v = body.studentNote;
    if (v === null) {
      fields.studentNote = null;
    } else if (typeof v !== 'string') {
      return bad('studentNote must be a string, or null to clear it.');
    } else if (v.length > MAX_STUDENT_NOTE) {
      return bad(`studentNote must be at most ${MAX_STUDENT_NOTE} characters.`);
    } else {
      // A note of only whitespace is no note.
      fields.studentNote = v.trim() === '' ? null : v;
    }
  }

  for (const name of ['acknowledgedPreCourse', 'termsAccepted']) {
    if (name in body) {
      if (typeof body[name] !== 'boolean') return bad(`${name} must be true or false.`);
      fields[name] = body[name];
    }
  }

  return { fields };
}

/** Builds the UPDATE. The caller's own identity and the editable statuses go in the WHERE. */
function buildUpdate(fields, planId, studentId) {
  const values = [];
  const add = (v) => {
    values.push(v);
    return `$${values.length}`;
  };

  const sets = [];
  if ('positionId' in fields) sets.push(`position_id = ${add(fields.positionId)}`);
  if ('studentNote' in fields) sets.push(`student_note = ${add(fields.studentNote)}`);
  if ('acknowledgedPreCourse' in fields) {
    sets.push(`acknowledged_pre_course = ${add(fields.acknowledgedPreCourse)}`);
  }
  if ('termsAccepted' in fields) {
    // The client says yes or no; the server owns the timestamp. Accepting
    // again keeps the original moment instead of overwriting it.
    sets.push(
      fields.termsAccepted
        ? 'terms_accepted_at = COALESCE(terms_accepted_at, NOW())'
        : 'terms_accepted_at = NULL',
    );
  }

  const text = `UPDATE coop_plans
SET ${sets.join(', ')}
WHERE plan_id = ${add(planId)}
  AND student_id = ${add(studentId)}
  AND status = ANY(${add([...EDITABLE_PLAN_STATUSES])})
RETURNING plan_id`;

  return { text, values };
}

export async function updateCoopPlan(event) {
  const rawPlanId = event?.pathParameters?.planId;
  if (!isValidPlanId(rawPlanId)) {
    return errorResponse(400, 'INVALID_PLAN_ID', 'planId must be a positive integer.');
  }
  const planId = Number(rawPlanId.trim());

  const caller = await resolveCaller(event, LABEL);
  if (caller.response) return caller.response;
  const { user } = caller;

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
    assertCanEditPlan(user, plan);
  } catch (err) {
    return forbiddenFrom(err, LABEL);
  }

  if (!isEditableStatus(plan.status)) {
    return errorResponse(
      409,
      'PLAN_NOT_EDITABLE',
      `A plan in status ${plan.status} cannot be edited. Only ${EDITABLE_PLAN_STATUSES.join(' or ')} plans can.`,
    );
  }

  const parsed = parseJsonObject(event);
  if (!parsed.ok) return errorResponse(400, 'INVALID_BODY', parsed.message);

  const checked = validate(parsed.value);
  if (checked.error) return checked.error;
  const { fields } = checked;

  // A RETURNED plan has been submitted once, and chk_coop_plans_submitted
  // requires those two fields to stay set from then on. Say so here with a
  // clear message instead of letting the database refuse it.
  if (
    plan.status === 'RETURNED' &&
    (fields.acknowledgedPreCourse === false || fields.termsAccepted === false)
  ) {
    return errorResponse(
      400,
      'SUBMISSION_FIELDS_LOCKED',
      'Terms acceptance and the pre-course acknowledgement cannot be withdrawn once the plan has been submitted.',
    );
  }

  try {
    const { text, values } = buildUpdate(fields, planId, user.studentId);
    const updated = await getPool().query(text, values);

    // Zero rows means the plan stopped being editable between the SELECT above
    // and this UPDATE. Nothing was written.
    if (updated.rowCount === 0) {
      return errorResponse(
        409,
        'PLAN_NOT_EDITABLE',
        'The plan changed status while you were editing it, so nothing was saved. Reload and try again.',
      );
    }

    const result = await getPool().query(SELECT_PLAN_BY_ID, [planId]);
    if (result.rows.length === 0) throw new Error('updated plan could not be read back');

    return jsonResponse(200, result.rows[0]);
  } catch (err) {
    const mapped = mapPlanWriteError(err);
    if (mapped) return mapped;
    console.error(`${LABEL} failed`, err);
    return internalError();
  }
}
