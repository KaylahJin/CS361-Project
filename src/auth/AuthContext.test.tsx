import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const loginMock = vi.fn();
const logoutMock = vi.fn();
const getCurrentSessionMock = vi.fn();

vi.mock('./cognitoClient', () => ({
  login: loginMock,
  logout: logoutMock,
  getCurrentSession: getCurrentSessionMock,
}));

const { AuthProvider, useAuth } = await import('./AuthContext');

function Probe() {
  const { status, user, idToken, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? ''}</span>
      <span data-testid="token">{idToken ?? ''}</span>
      {/* login() rejects on bad credentials by design — the real caller
          (src/pages/Login.tsx) try/catches it to show a message. Swallowing
          it here keeps the failed-login case from surfacing as an unhandled
          rejection that would taint the whole run. */}
      <button onClick={() => login('a@b.com', 'coop1234').catch(() => {})}>sign in</button>
      <button onClick={logout}>sign out</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    loginMock.mockReset();
    logoutMock.mockReset();
    getCurrentSessionMock.mockReset();
    getCurrentSessionMock.mockResolvedValue(null);
  });

  it('settles on anonymous when there is no stored session', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('token')).toHaveTextContent('');
  });

  it('restores a stored session on mount without a login', async () => {
    getCurrentSessionMock.mockResolvedValue({ idToken: 'restored', email: 'a@b.com' });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.com');
    expect(screen.getByTestId('token')).toHaveTextContent('restored');
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('becomes authenticated after a successful login', async () => {
    loginMock.mockResolvedValue({ idToken: 'tok', email: 'a@b.com' });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));

    await userEvent.click(screen.getByText('sign in'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.com');
    expect(screen.getByTestId('token')).toHaveTextContent('tok');
  });

  it('stays anonymous and keeps no token when login fails', async () => {
    loginMock.mockRejectedValue(new Error('Incorrect username or password.'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));

    await userEvent.click(screen.getByText('sign in'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('token')).toHaveTextContent('');
  });

  it('clears the session on logout', async () => {
    getCurrentSessionMock.mockResolvedValue({ idToken: 'restored', email: 'a@b.com' });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    await userEvent.click(screen.getByText('sign out'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('email')).toHaveTextContent('');
    expect(screen.getByTestId('token')).toHaveTextContent('');
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});

describe('useAuth', () => {
  it('throws outside an AuthProvider rather than returning a null context', () => {
    // React logs the thrown error to console.error on its way up; silence it
    // so a deliberate failure does not look like a broken test run.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAuth must be used within AuthProvider');
    spy.mockRestore();
  });
});
