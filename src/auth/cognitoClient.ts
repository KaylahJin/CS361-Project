// ============================================================
// CS361 V3-02.1 — Cognito sign-in for the SPA
// ============================================================
// Issue: #99 — เข้าสู่ระบบและออกจากระบบ
//
// amazon-cognito-identity-js speaks to Cognito directly over SRP, so the
// password never crosses the wire and there is no Hosted UI redirect to
// configure (see docs/cognito-setup.md). The library persists the session
// in localStorage itself; getCurrentSession() is how a page reload picks
// it back up, and it also refreshes an expired access token using the
// stored refresh token — the "token หมดอายุ" case issue #99 asks for.
//
// This module deliberately exposes only the ID token. The API Gateway JWT
// authorizer added in V3-02.2 validates it and hands the `sub` claim to
// the Lambda; nothing in the app needs the access token.
// ============================================================

import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { cognitoConfig } from './cognitoConfig';

export interface Session {
  idToken: string;
  email: string;
}

const pool = new CognitoUserPool({
  UserPoolId: cognitoConfig.userPoolId,
  ClientId: cognitoConfig.clientId,
});

/**
 * Sign in with email + password via SRP.
 *
 * Rejects with the raw Cognito error so the caller can tell a wrong
 * password from a network failure; the Login page maps it to one user-facing
 * message rather than leaking which half was wrong.
 */
export function login(email: string, password: string): Promise<Session> {
  const user = new CognitoUser({ Username: email, Pool: pool });
  const details = new AuthenticationDetails({ Username: email, Password: password });

  return new Promise((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: (session) => {
        resolve({ idToken: session.getIdToken().getJwtToken(), email });
      },
      onFailure: (err) => reject(err),
    });
  });
}

/** Clear the stored session. A no-op when nobody is signed in. */
export function logout(): void {
  pool.getCurrentUser()?.signOut();
}

/**
 * Restore the session persisted by the library, refreshing the token if the
 * access token has expired but the refresh token has not.
 *
 * Resolves null — never rejects — for every unusable case: nobody signed
 * in, refresh token expired, storage cleared. The caller treats all of
 * them the same way (show the login form), so collapsing them here is what
 * keeps a stale token from rendering a broken page instead of a login prompt.
 */
export function getCurrentSession(): Promise<Session | null> {
  const current = pool.getCurrentUser();
  if (!current) return Promise.resolve(null);

  return new Promise((resolve) => {
    current.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) {
        resolve(null);
        return;
      }
      resolve({ idToken: session.getIdToken().getJwtToken(), email: current.getUsername() });
    });
  });
}
