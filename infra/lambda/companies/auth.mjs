// Maps the verified Cognito `sub` to a row in app_users.
//
// API Gateway's JWT authorizer already checked the token's signature, issuer,
// audience and expiry before this Lambda ran, so nothing here re-validates it.
// The `sub` claim is the only thing trusted as identity — a student_id in a
// query string is caller-supplied data and may only be used as a filter.
//
// Two different denials come out of here, and the distinction is the point:
//
//   401  the request carries no usable identity at all. In practice the
//        authorizer answers this at the edge; reaching here means a route was
//        wired without one.
//   403  the token is valid and the caller is who they say, but the account
//        has no app_users row or has been deactivated. They are authenticated
//        and simply not authorised, which is what 403 means. Required by the
//        acceptance criteria on #100.
//
// The status lives here rather than in each handler so the two cannot drift
// apart, and so a new handler cannot accidentally answer 401 for an account
// that merely lacks a row.

import { getPool } from './db.mjs';

const SELECT_BY_SUB = `SELECT cognito_sub, role, student_id, is_active
FROM app_users
WHERE cognito_sub = $1`;

const UNAUTHENTICATED = { status: 401, error: 'Unauthorized' };
const NOT_AUTHORIZED = { status: 403, error: 'Forbidden' };

/**
 * Resolves the caller against app_users.
 *
 * @returns {Promise<{user: {sub: string, role: string, studentId: string|null}, denied: null}
 *                  | {user: null, denied: {status: number, error: string}}>}
 *   `user` is set on success and `denied` is null. On refusal `user` is null
 *   and `denied` carries the status and body the handler should answer with,
 *   so a handler needs one `if (denied)` check and never picks the code.
 */
export async function getAuthenticatedUser(event) {
  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;

  // No claim, no database round trip.
  if (!sub) return { user: null, denied: UNAUTHENTICATED };

  const result = await getPool().query(SELECT_BY_SUB, [sub]);

  const row = result.rows[0];
  if (!row || !row.is_active) return { user: null, denied: NOT_AUTHORIZED };

  return {
    user: { sub: row.cognito_sub, role: row.role, studentId: row.student_id },
    denied: null,
  };
}
