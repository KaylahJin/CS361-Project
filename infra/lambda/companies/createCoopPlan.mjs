// POST /coop-plans — a student starts a new plan for a period.
//
// Identity is the verified token's `sub`, resolved to a student_id by
// auth.mjs. The body never carries an owner: a student_id sent in it is
// refused outright rather than ignored, so a client that tries to name an
// owner finds out instead of silently getting its own plan.
//
// The plan is created as PREPARING, which is a draft — nothing here counts as
// submitting it (that is V3-04.2). Only periodId is required; positionId and
// the other fields can be filled in later through PATCH, because a draft is
// allowed to be incomplete.
//
// One in-progress plan per student per period is enforced by the partial
// unique index uq_coop_plans_active_period. The handler does not pre-check
// it: a SELECT-then-INSERT leaves a gap two requests can both slip through,
// while the index cannot be raced. The violation is mapped to 409.
//
// Missing period/position references are likewise reported from the foreign
// key violation rather than a pre-check.

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { assertCanCreatePlan } from './authorize.mjs';
import { SELECT_PLAN_BY_ID } from './planQueries.mjs';
import { parseJsonObject, findUnknownField } from './requestBody.mjs';
import {
  errorResponse,
  internalError,
  forbiddenFrom,
  mapPlanWriteError,
  resolveCaller,
} from './planHttp.mjs';

const LABEL = 'createCoopPlan';
const ALLOWED_FIELDS = ['periodId', 'positionId'];

// Column widths from schema.sql: periods.period_id VARCHAR(20),
// positions.position_id VARCHAR(10). Longer values cannot exist, and handing
// them to pg would raise 22001 and answer 500 instead of 400.
const MAX_PERIOD_ID = 20;
const MAX_POSITION_ID = 10;

const INSERT_PLAN = `INSERT INTO coop_plans (student_id, period_id, position_id)
VALUES ($1, $2, $3)
RETURNING plan_id`;

function validate(body) {
  const unknown = findUnknownField(body, ALLOWED_FIELDS);
  if (unknown !== null) {
    return errorResponse(
      400,
      'UNKNOWN_FIELD',
      `Field "${unknown}" is not accepted. Allowed fields: ${ALLOWED_FIELDS.join(', ')}.`,
    );
  }

  const { periodId, positionId } = body;

  if (typeof periodId !== 'string' || periodId.trim() === '') {
    return errorResponse(400, 'INVALID_FIELD', 'periodId is required and must be a non-empty string.');
  }
  if (periodId.trim().length > MAX_PERIOD_ID) {
    return errorResponse(400, 'INVALID_FIELD', `periodId must be at most ${MAX_PERIOD_ID} characters.`);
  }

  if (positionId !== undefined && positionId !== null) {
    if (typeof positionId !== 'string' || positionId.trim() === '') {
      return errorResponse(400, 'INVALID_FIELD', 'positionId must be a non-empty string when provided.');
    }
    if (positionId.trim().length > MAX_POSITION_ID) {
      return errorResponse(400, 'INVALID_FIELD', `positionId must be at most ${MAX_POSITION_ID} characters.`);
    }
  }

  return null;
}

export async function createCoopPlan(event) {
  const caller = await resolveCaller(event, LABEL);
  if (caller.response) return caller.response;
  const { user } = caller;

  // Role and account link are checked before the body is even read, so a
  // caller who may not create plans learns nothing about the request shape.
  try {
    assertCanCreatePlan(user);
  } catch (err) {
    return forbiddenFrom(err, LABEL);
  }

  const parsed = parseJsonObject(event);
  if (!parsed.ok) return errorResponse(400, 'INVALID_BODY', parsed.message);

  const invalid = validate(parsed.value);
  if (invalid) return invalid;

  const periodId = parsed.value.periodId.trim();
  const positionId = parsed.value.positionId == null ? null : parsed.value.positionId.trim();

  try {
    const inserted = await getPool().query(INSERT_PLAN, [user.studentId, periodId, positionId]);
    const planId = inserted.rows[0]?.plan_id;
    if (planId == null) throw new Error('INSERT returned no plan_id');

    const result = await getPool().query(SELECT_PLAN_BY_ID, [planId]);
    if (result.rows.length === 0) throw new Error('created plan could not be read back');

    return jsonResponse(201, result.rows[0]);
  } catch (err) {
    const mapped = mapPlanWriteError(err);
    if (mapped) return mapped;
    console.error(`${LABEL} failed`, err);
    return internalError();
  }
}
