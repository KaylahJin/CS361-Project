import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: useAuthMock }));

const { default: Navbar } = await import('./Navbar');

const logout = vi.fn();

function renderNavbar(activeTab: Parameters<typeof Navbar>[0]['activeTab']) {
  const onTabChange = vi.fn();
  render(<Navbar activeTab={activeTab} onTabChange={onTabChange} />);
  return { onTabChange };
}

describe('Navbar sign-out', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    logout.mockReset();
    useAuthMock.mockReturnValue({ status: 'authenticated', logout });
  });

  it('leaves the account page when signing out', async () => {
    // Pages are chosen by a tab in App state, not by the URL. Clearing the
    // session without moving the tab leaves the user staring at the same
    // screen with a login form swapped into it.
    const { onTabChange } = renderNavbar('account');

    await userEvent.click(screen.getAllByRole('button', { name: /ออกจากระบบ/ })[0]);

    expect(logout).toHaveBeenCalledOnce();
    expect(onTabChange).toHaveBeenCalledWith('home');
  });

  it('leaves the coop-plan page when signing out', async () => {
    const { onTabChange } = renderNavbar('coop-plans');

    await userEvent.click(screen.getAllByRole('button', { name: /ออกจากระบบ/ })[0]);

    expect(onTabChange).toHaveBeenCalledWith('home');
  });

  it('stays put when signing out from a public page', async () => {
    // Someone reading the announcements should keep reading them.
    const { onTabChange } = renderNavbar('requirements');

    await userEvent.click(screen.getAllByRole('button', { name: /ออกจากระบบ/ })[0]);

    expect(logout).toHaveBeenCalledOnce();
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('offers no account entry at all while signed out', async () => {
    useAuthMock.mockReturnValue({ status: 'anonymous', logout });

    renderNavbar('home');

    expect(screen.queryByRole('button', { name: /ออกจากระบบ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /บัญชีของฉัน/ })).not.toBeInTheDocument();
  });
});

describe('Navbar and the student tab', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    logout.mockReset();
  });

  it('hides the student tab from a visitor who is not signed in', () => {
    useAuthMock.mockReturnValue({ status: 'anonymous', logout });

    renderNavbar('home');

    expect(screen.queryByRole('button', { name: /นักศึกษา/ })).not.toBeInTheDocument();
  });

  it('shows the student tab to a signed-in user', () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', logout });

    renderNavbar('home');

    expect(screen.getAllByRole('button', { name: /นักศึกษา/ }).length).toBeGreaterThan(0);
  });

  it('leaves the student page when signing out', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', logout });

    const { onTabChange } = renderNavbar('students');

    await userEvent.click(screen.getAllByRole('button', { name: /ออกจากระบบ/ })[0]);

    expect(onTabChange).toHaveBeenCalledWith('home');
  });
});
