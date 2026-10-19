// HTTP plumbing shared by the V3-04 plan write handlers (create, update).
//
// Error bodies follow V3-01-api-spec.md §8, which asks for an error code and a
// message the caller can act on. `error` keeps the short label the existing
// read handlers already return ('Forbidden', 'Unauthorized', ...), so a client
// that only looks at `error` keeps working; `code` is the machine-readable
// reason and `message` the explanation. Internal detail never goes in any of
// them.

import { jsonResponse } from './response.mjs';
import { getAuthenticatedUser } from './auth.mjs';
import { ForbiddenError } from './authorize.mjs';

const LABELS = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  500: 'Internal server error',
};

export function errorResponse(status, code, message) {
  return jsonResponse(status, { error: LABELS[status] ?? 'Error', code, message });
}

export function internalError() {
  return errorResponse(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again later.');
}

export function forbidden(message = 'You do not have permission to perform this action.') {
  return errorResponse(403, 'FORBIDDEN', message);
}

/**
 * Resolves the caller from the verified token. Returns `{ user }` on success
 * or `{ response }` carrying the answer the handler must return as-is.
 *
 * auth.mjs decides between 401 and 403 (see its header); a throw here is a
 * server fault (app_users missing, DB unreachable) and answers 500, never 401,
 * so a signed-in user is not told their credentials were rejected.
 */
export async function resolveCaller(event, label) {
  try {
    const { user, denied } = await getAuthenticatedUser(event);
    if (denied) {
      return denied.status === 401
        ? { response: errorResponse(401, 'UNAUTHORIZED', 'Authentication is required.') }
        : { response: forbidden('This account has not been granted access.') };
    }
    return { user };
  } catch (err) {
    console.error(`${label} auth failed`, err);
    return { response: internalError() };
  }
}

/** Turns a ForbiddenError from authorize.mjs into a 403; rethrows anything else. */
export function forbiddenFrom(err, label) {
  if (err instanceof ForbiddenError) {
    console.error(`${label} forbidden`, err.message);
    return forbidden();
  }
  throw err;
}

/**
 * Maps the PostgreSQL errors a plan write can legitimately raise. Constraint
 * names come from the schema (schema.sql and v3-01-upgrade.sql); anything not
 * recognised returns null so the caller treats it as the 500 it is.
 */
export function mapPlanWriteError(err) {
  if (err?.code === '23505' && err.constraint === 'uq_coop_plans_active_period') {
    return errorResponse(
      409,
      'ACTIVE_PLAN_EXISTS',
      'You already have a plan in progress for this period.',
    );
  }
  if (err?.code === '23503' && err.constraint === 'fk_coop_plans_period') {
    return errorResponse(404, 'PERIOD_NOT_FOUND', 'The requested period does not exist.');
  }
  if (err?.code === '23503' && err.constraint === 'fk_coop_plans_position') {
    return errorResponse(404, 'POSITION_NOT_FOUND', 'The requested position does not exist.');
  }
  // chk_coop_plans_submitted: a plan that has left PREPARING must keep its
  // terms acceptance and pre-course acknowledgement.
  if (err?.code === '23514' && err.constraint === 'chk_coop_plans_submitted') {
    return errorResponse(
      400,
      'SUBMISSION_FIELDS_LOCKED',
      'Terms acceptance and the pre-course acknowledgement cannot be withdrawn once the plan has been submitted.',
    );
  }
  return null;
}
