import { describe, it, expect, vi, beforeEach } from 'vitest';

const authenticateUserMock = vi.fn();
const signOutMock = vi.fn();
const getSessionMock = vi.fn();
const getCurrentUserMock = vi.fn();

vi.mock('amazon-cognito-identity-js', () => {
  class CognitoUserPool {
    getCurrentUser() {
      return getCurrentUserMock();
    }
  }
  class CognitoUser {
    authenticateUser = authenticateUserMock;
    signOut = signOutMock;
    getSession = getSessionMock;
  }
  class AuthenticationDetails {}
  return { CognitoUserPool, CognitoUser, AuthenticationDetails };
});

const { login, logout, getCurrentSession } = await import('./cognitoClient');

describe('login', () => {
  beforeEach(() => {
    authenticateUserMock.mockReset();
  });

  it('resolves with the idToken and email on success', async () => {
    authenticateUserMock.mockImplementation((_details, callbacks) => {
      callbacks.onSuccess({
        getIdToken: () => ({ getJwtToken: () => 'fake-id-token' }),
      });
    });

    const session = await login('student1@example.com', 'coop1234');

    expect(session).toEqual({ idToken: 'fake-id-token', email: 'student1@example.com' });
    expect(authenticateUserMock).toHaveBeenCalledTimes(1);
  });

  it('rejects with the Cognito error on failure', async () => {
    authenticateUserMock.mockImplementation((_details, callbacks) => {
      callbacks.onFailure(new Error('Incorrect username or password.'));
    });

    await expect(login('student1@example.com', 'wrong')).rejects.toThrow(
      'Incorrect username or password.',
    );
  });
});

describe('logout', () => {
  beforeEach(() => {
    signOutMock.mockReset();
    getCurrentUserMock.mockReset();
  });

  it('signs out the current user when there is one', () => {
    getCurrentUserMock.mockReturnValue({ signOut: signOutMock });

    logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no current user', () => {
    getCurrentUserMock.mockReturnValue(null);

    expect(() => logout()).not.toThrow();
    expect(signOutMock).not.toHaveBeenCalled();
  });
});

describe('getCurrentSession', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getCurrentUserMock.mockReset();
  });

  it('resolves null when no user is stored', async () => {
    getCurrentUserMock.mockReturnValue(null);

    await expect(getCurrentSession()).resolves.toBeNull();
  });

  it('resolves the restored session when the stored token is still valid', async () => {
    getCurrentUserMock.mockReturnValue({
      getUsername: () => 'student1@example.com',
      getSession: (cb: (err: Error | null, session: unknown) => void) => {
        cb(null, { getIdToken: () => ({ getJwtToken: () => 'restored-token' }) });
      },
    });

    await expect(getCurrentSession()).resolves.toEqual({
      idToken: 'restored-token',
      email: 'student1@example.com',
    });
  });

  it('resolves null when the stored refresh token has expired', async () => {
    getCurrentUserMock.mockReturnValue({
      getUsername: () => 'student1@example.com',
      getSession: (cb: (err: Error | null, session: unknown) => void) => {
        cb(new Error('Refresh Token has expired'), null);
      },
    });

    await expect(getCurrentSession()).resolves.toBeNull();
  });
});
