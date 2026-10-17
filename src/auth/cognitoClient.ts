// Sign-in against Cognito. amazon-cognito-identity-js talks to Cognito
// directly over SRP, so the password never crosses the wire and there is no
// Hosted UI redirect to configure. The library keeps the session in
// localStorage itself, which is what makes a page reload able to pick it back
// up and what refreshes an expired token.
//
// Only the ID token is exposed: the API Gateway authorizer validates that one
// and nothing in the app needs the access token.

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

const pool: CognitoUserPool | null = (() => {
  const userPoolId =
    cognitoConfig.userPoolId ||
    (import.meta.env.MODE === 'test' ? 'us-east-1_test' : '');
  const clientId =
    cognitoConfig.clientId ||
    (import.meta.env.MODE === 'test' ? 'testclient' : '');

  if (!userPoolId || !clientId) {
    return null;
  }

  try {
    return new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
    });
  } catch (err) {
    console.warn('Could not initialize Cognito User Pool:', err);
    return null;
  }
})();

/**
 * Rejects with the raw Cognito error so the caller can tell a wrong password
 * from a network failure. The Login page collapses both into one message.
 */
export function login(email: string, password: string): Promise<Session> {
  if (!pool) {
    return Promise.reject(
      new Error(
        'Cognito User Pool is not configured. Both VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID must be set.'
      )
    );
  }

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

export function logout(): void {
  pool?.getCurrentUser()?.signOut();
}

/**
 * Restores the stored session, refreshing the token when it has expired but
 * the refresh token has not. Resolves null — never rejects — for every
 * unusable case (nobody signed in, refresh token expired, storage cleared),
 * because the caller answers all of them by showing the login form.
 */
export function getCurrentSession(): Promise<Session | null> {
  if (!pool) return Promise.resolve(null);

  const current = pool.getCurrentUser();
  if (!current) return Promise.resolve(null);

  return new Promise((resolve) => {
    current.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) {
        resolve(null);
        return;
      }

      const token = session.getIdToken();
      // Read the email claim, not getUsername(). This pool signs in by email,
      // so the real username is a generated UUID that the library stores
      // during sign-in — getUsername() would show that UUID to the user.
      const email =
        typeof token.payload?.email === 'string' ? token.payload.email : current.getUsername();

      resolve({ idToken: token.getJwtToken(), email });
    });
  });
}
