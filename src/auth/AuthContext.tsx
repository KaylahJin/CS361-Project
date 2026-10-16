// ============================================================
// CS361 V3-02.1 — app-wide auth state
// ============================================================
// Issue: #99 — เข้าสู่ระบบและออกจากระบบ
//
// Three states, not a boolean: 'loading' exists because restoring the
// stored session is async, and a boolean would make the first paint claim
// "anonymous" and flash the login form at an already-signed-in user.
// ProtectedRoute renders nothing while loading for exactly that reason.
// ============================================================

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as cognitoClient from './cognitoClient';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: Status;
  user: { email: string } | null;
  /** ID token for the `Authorization: Bearer` header on protected API calls. */
  idToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    // Same `cancelled` cleanup flag the data fetches in Employers.tsx use —
    // an unmount mid-restore must not set state on a dead component.
    let cancelled = false;

    void cognitoClient.getCurrentSession().then((session) => {
      if (cancelled) return;

      if (session) {
        setUser({ email: session.email });
        setIdToken(session.idToken);
        setStatus('authenticated');
      } else {
        setStatus('anonymous');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Rejections propagate to the caller (the Login page shows the message)
  // and leave status untouched at 'anonymous' — a failed sign-in must not
  // half-apply, or a wrong password would strand the app holding no token
  // while claiming to be authenticated.
  const login = useCallback(async (email: string, password: string) => {
    const session = await cognitoClient.login(email, password);
    setUser({ email: session.email });
    setIdToken(session.idToken);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(() => {
    cognitoClient.logout();
    setUser(null);
    setIdToken(null);
    setStatus('anonymous');
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, idToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
export default AuthProvider;

/**
 * Throws rather than returning a null context: a component reading auth
 * state outside the provider is a wiring bug, and silently reporting
 * "anonymous" would hide it behind a login form that never resolves.
 */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
