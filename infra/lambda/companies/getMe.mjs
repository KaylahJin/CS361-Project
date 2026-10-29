// ============================================================
// CS361 V3 — GET /me
// ============================================================
// Behind the API Gateway JWT authorizer: no token never reaches here.
//
// Tells the web app which role the signed-in account has, so it can show only
// the menus and buttons that role may use. The role lives in app_users, not in
// the Cognito token, which is why the page has to ask.
//
// This is for display only. Every route still checks the role itself in
// authorize.mjs; hiding a button never replaces that check.
//
// Response: 200 { role, studentId }. The Cognito sub and is_active stay
// server-side. 401 / 403 come from getAuthenticatedUser.
// ============================================================

import { jsonResponse } from './response.mjs';
import { getAuthenticatedUser } from './auth.mjs';

export async function getMe(event) {
  try {
    const { user, denied } = await getAuthenticatedUser(event);
    if (denied) {
      return jsonResponse(denied.status, { error: denied.error });
    }
    return jsonResponse(200, { role: user.role, studentId: user.studentId });
  } catch (err) {
    console.error('getMe failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}
