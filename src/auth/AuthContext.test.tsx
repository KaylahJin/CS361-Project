import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const loginMock = vi.fn();
const logoutMock = vi.fn();
const getCurrentSessionMock = vi.fn();
const getMeMock = vi.fn();

vi.mock('./cognitoClient', () => ({
  login: loginMock,
  logout: logoutMock,
  getCurrentSession: getCurrentSessionMock,
}));

vi.mock('../data/meApi', () => ({ getMe: getMeMock }));

const { AuthProvider, useAuth } = await import('./AuthContext');

function Probe() {
  const { status, user, role, getIdToken, login, logout } = useAuth();
  const [token, setToken] = useState('');

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? ''}</span>
      <span data-testid="role">{role ?? 'none'}</span>
      <span data-testid="token">{token}</span>
      <button onClick={() => void getIdToken().then((t) => setToken(t ?? 'null'))}>
        read token
      </button>
      {/* login() rejects on bad credentials by design — the real caller
          (src/pages/Login.tsx) try/catches it to show a message. Swallowing
          it here keeps the failed-login case from surfacing as an unhandled
          rejection that would taint the whole run. */}
      <button onClick={() => login('a@b.com', 'test-password').catch(() => {})}>sign in</button>
      <button onClick={logout}>sign out</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const expectStatus = (value: string) =>
  waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent(value));

describe('AuthProvider', () => {
  beforeEach(() => {
    loginMock.mockReset();
    logoutMock.mockReset();
    getCurrentSessionMock.mockReset();
    getCurrentSessionMock.mockResolvedValue(null);
    getMeMock.mockReset();
    getMeMock.mockResolvedValue({ role: 'STAFF', studentId: null });
  });

  it('settles on anonymous when there is no stored session', async () => {
    renderProbe();

    await expectStatus('anonymous');
  });

  it('restores a stored session on mount without a login', async () => {
    getCurrentSessionMock.mockResolvedValue({ idToken: 'restored', email: 'a@b.com' });

    renderProbe();

    await expectStatus('authenticated');
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.com');
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('becomes authenticated after a successful login', async () => {
    loginMock.mockResolvedValue({ idToken: 'tok', email: 'a@b.com' });

    renderProbe();
    await expectStatus('anonymous');

    await userEvent.click(screen.getByText('sign in'));

    await expectStatus('authenticated');
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.com');
  });

  it('stays anonymous when login fails', async () => {
    loginMock.mockRejectedValue(new Error('Incorrect username or password.'));

    renderProbe();
    await expectStatus('anonymous');

    await userEvent.click(screen.getByText('sign in'));

    await expectStatus('anonymous');
  });

  it('clears the session on logout', async () => {
    getCurrentSessionMock.mockResolvedValue({ idToken: 'restored', email: 'a@b.com' });

    renderProbe();
    await expectStatus('authenticated');

    await userEvent.click(screen.getByText('sign out'));

    await expectStatus('anonymous');
    expect(screen.getByTestId('email')).toHaveTextContent('');
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});

describe('role from GET /me', () => {
  beforeEach(() => {
    loginMock.mockReset();
    logoutMock.mockReset();
    getCurrentSessionMock.mockReset();
    getCurrentSessionMock.mockResolvedValue(null);
    getMeMock.mockReset();
  });

  const expectRole = (value: string) =>
    waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent(value));

  it('loads the role of a restored session using its token', async () => {
    getCurrentSessionMock.mockResolvedValue({ idToken: 'restored', email: 'a@b.com' });
    getMeMock.mockResolvedValue({ role: 'ADVISOR', studentId: null });

    renderProbe();

    await expectRole('ADVISOR');
    expect(getMeMock).toHaveBeenCalledWith('restored');
  });

  it('loads the role after a login', async () => {
    loginMock.mockResolvedValue({ idToken: 'fresh', email: 'a@b.com' });
    getMeMock.mockResolvedValue({ role: 'STUDENT', studentId: '6600000001' });

    renderProbe();
    await expectStatus('anonymous');
    await userEvent.click(screen.getByText('sign in'));

    await expectRole('STUDENT');
    expect(getMeMock).toHaveBeenCalledWith('fresh');
  });

  it('keeps the role null when the lookup fails, so role-only screens stay hidden', async () => {
    getCurrentSessionMock.mockResolvedValue({ idToken: 'restored', email: 'a@b.com' });
    getMeMock.mockRejectedValue(new Error('403'));

    renderProbe();

    await expectStatus('authenticated');
    await waitFor(() => expect(getMeMock).toHaveBeenCalled());
    expect(screen.getByTestId('role')).toHaveTextContent('none');
  });

  it('clears the role on logout', async () => {
    getCurrentSessionMock.mockResolvedValue({ idToken: 'restored', email: 'a@b.com' });
    getMeMock.mockResolvedValue({ role: 'STAFF', studentId: null });

    renderProbe();
    await expectRole('STAFF');
    await userEvent.click(screen.getByText('sign out'));

    await expectRole('none');
  });
});

describe('getIdToken', () => {
  beforeEach(() => {
    loginMock.mockReset();
    logoutMock.mockReset();
    getCurrentSessionMock.mockReset();
    getCurrentSessionMock.mockResolvedValue(null);
  });

  it('re-reads the session on every call rather than returning a mount-time snapshot', async () => {
    // The token only lasts an hour, so a snapshot taken at mount would 401
    // every later call while the UI still claimed the user was signed in.
    getCurrentSessionMock.mockResolvedValue({ idToken: 'first', email: 'a@b.com' });

    renderProbe();
    await expectStatus('authenticated');

    await userEvent.click(screen.getByText('read token'));
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('first'));

    // An hour passes; the library refreshes and yields a new token.
    getCurrentSessionMock.mockResolvedValue({ idToken: 'refreshed', email: 'a@b.com' });

    await userEvent.click(screen.getByText('read token'));
    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('refreshed'));
  });

  it('resolves null and flips status to anonymous when the session can no longer be refreshed', async () => {
    getCurrentSessionMock.mockResolvedValue({ idToken: 'first', email: 'a@b.com' });

    renderProbe();
    await expectStatus('authenticated');

    // Refresh token expired: the user must be told they are signed out
    // rather than left looking signed in while every request fails.
    getCurrentSessionMock.mockResolvedValue(null);

    await userEvent.click(screen.getByText('read token'));

    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('null'));
    await expectStatus('anonymous');
  });

  it('resolves null without calling cognito when nobody is signed in', async () => {
    renderProbe();
    await expectStatus('anonymous');
    getCurrentSessionMock.mockClear();

    await userEvent.click(screen.getByText('read token'));

    await waitFor(() => expect(screen.getByTestId('token')).toHaveTextContent('null'));
    expect(getCurrentSessionMock).not.toHaveBeenCalled();
  });
});

describe('useAuth', () => {
  it('throws outside an AuthProvider rather than returning a null context', () => {
    // React logs the thrown error on its way up; silence it so a deliberate
    // failure does not look like a broken test run.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });
});
