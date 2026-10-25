// App-wide auth state.
//
// Three states rather than a boolean: restoring the stored session is async,
// and a boolean would make the first paint say "anonymous" and flash the login
// form at a user who is already signed in.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as cognitoClient from './cognitoClient';
import { getMe } from '../data/meApi';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: Status;
  user: { email: string } | null;
  /**
   * Role from GET /me, or null while it loads, after a failed lookup, and when
   * signed out. Treat null as "no role": show only what everyone may see.
   */
  role: string | null;
  /**
   * ID token for the `Authorization: Bearer` header on protected API calls.
   * Call it right before each fetch and never keep the result: the token only
   * lasts an hour, and this reads it back through Cognito, which is what
   * refreshes an expired one.
   */
  getIdToken: () => Promise<string | null>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [role, setRole] = useState<string | null>(null);

  // Mirrors `status` so getIdToken can read it without being rebuilt on every
  // status change. Callers put getIdToken in dependency arrays, where a new
  // function identity would trigger another fetch.
  const statusRef = useRef<Status>('loading');
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // A failed lookup leaves the role null on purpose: the role-only screens stay
  // hidden rather than guessing. The API still decides what each call may do.
  const loadRole = useCallback(async (idToken: string) => {
    try {
      const me = await getMe(idToken);
      setRole(me.role);
    } catch {
      setRole(null);
    }
  }, []);

  useEffect(() => {
    // Unmounting mid-restore must not set state on a dead component.
    let cancelled = false;

    void cognitoClient.getCurrentSession().then((session) => {
      if (cancelled) return;

      if (session) {
        setUser({ email: session.email });
        setStatus('authenticated');
        void loadRole(session.idToken);
      } else {
        setStatus('anonymous');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [loadRole]);

  // Dropping to 'anonymous' on failure matters: once the refresh token is gone
  // the user has to see the login form, not a signed-in UI where every request
  // comes back 401.
  const getIdToken = useCallback(async () => {
    if (statusRef.current !== 'authenticated') return null;

    const session = await cognitoClient.getCurrentSession();
    if (!session) {
      setUser(null);
      setRole(null);
      setStatus('anonymous');
      return null;
    }

    return session.idToken;
  }, []);

  // A rejection propagates to the Login page and leaves status at 'anonymous'.
  // Half-applying it would leave the app claiming to be signed in with no
  // token after a wrong password.
  const login = useCallback(async (email: string, password: string) => {
    const session = await cognitoClient.login(email, password);
    setUser({ email: session.email });
    setStatus('authenticated');
    void loadRole(session.idToken);
  }, [loadRole]);

  const logout = useCallback(() => {
    cognitoClient.logout();
    setUser(null);
    setRole(null);
    setStatus('anonymous');
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, role, getIdToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
export default AuthProvider;

/**
 * Throws instead of returning null: a component reading auth state outside the
 * provider is a wiring bug, and quietly reporting "anonymous" would hide it
 * behind a login form that never goes away.
 */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
