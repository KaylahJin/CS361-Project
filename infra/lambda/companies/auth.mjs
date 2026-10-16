// ============================================================
// CS361 V3-02.2 — resolve the verified Cognito sub to an app_users row
// ============================================================
// Issue: #100 — ตรวจสอบตัวตนที่ API (JWT Authorizer และการจับคู่บัญชี)
//
// API Gateway's JWT authorizer (infra/terraform/cognito.tf) has already
// verified the token's signature, issuer, audience and expiry before this
// Lambda runs. This module does NOT re-validate the token — it only maps
// the already-verified `sub` claim to our own notion of a user.
//
// Per docs/overview/V3-01-api-spec.md §7 the `sub` claim is the ONLY
// accepted proof of identity. A student_id in the request body or query
// string is caller-supplied data; it may be used as a filter, never as
// evidence of who is calling.
//
// Returns null for every "not a usable identity" case — no claim, no row,
// row present but is_active false. All three must answer 401 to the
// caller, so collapsing them to one return value is what makes a single
// `if (!user) return 401` at the call site correct instead of three
// separate checks that a future handler could forget one of.
//
// The deactivated case is deliberately 401 rather than 403: 403 means
// "we know who you are, you may not do this", which would confirm to an
// attacker that a given Cognito account is registered in this system.
// ============================================================

import { getPool } from './db.mjs';

const SELECT_BY_SUB = `SELECT cognito_sub, role, student_id, is_active
FROM app_users
WHERE cognito_sub = $1`;

/**
 * Resolve the caller from the verified JWT claims.
 *
 * @param {{requestContext?: {authorizer?: {jwt?: {claims?: Record<string, string>}}}} | null | undefined} event
 *   API Gateway HTTP API payload format 2.0 event.
 * @returns {Promise<{sub: string, role: string, studentId: string | null} | null>}
 *   null whenever the request has no usable identity (caller answers 401).
 */
export async function getAuthenticatedUser(event) {
  const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;

  // Short-circuit before touching the pool: an unauthenticated request must
  // not cost a database round trip.
  if (!sub) return null;

  const result = await getPool().query(SELECT_BY_SUB, [sub]);

  const row = result.rows[0];
  if (!row || !row.is_active) return null;

  return { sub: row.cognito_sub, role: row.role, studentId: row.student_id };
}
