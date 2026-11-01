import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useAuthMock = vi.fn();

// AuthProvider is replaced by a pass-through: these tests drive the session
// through useAuth directly, and the real provider would try to restore one
// from storage.
vi.mock('./auth/AuthContext', () => ({
  useAuth: useAuthMock,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

const getStudentsMock = vi.fn();

vi.mock('./data/studentApi', async () => {
  const actual = await vi.importActual<typeof import('./data/studentApi')>(
    './data/studentApi',
  );
  return { ...actual, getStudents: getStudentsMock, getStudent: vi.fn() };
});

const { default: App } = await import('./App');

function signedIn() {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
    user: { email: 'staff1@example.ac.th' },
    role: 'STAFF',
    getIdToken: async () => 'a-token',
    logout: vi.fn(),
    login: vi.fn(),
  });
}

function signedOut() {
  useAuthMock.mockReturnValue({
    status: 'anonymous',
    user: null,
    getIdToken: async () => null,
    logout: vi.fn(),
    login: vi.fn(),
  });
}

describe('reaching the student page', () => {
  beforeEach(() => {
    window.location.hash = '';
    useAuthMock.mockReset();
    getStudentsMock.mockReset();
    getStudentsMock.mockResolvedValue([]);
  });

  it('a signed-in user can open it from the navbar', async () => {
    signedIn();

    render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: /นักศึกษา/ })[0]);

    expect(await screen.findByText(/ไม่พบข้อมูลนักศึกษา/)).toBeInTheDocument();
  });

  it('shows the login form instead of the page when the session ends', async () => {
    // Defence in depth behind the hidden navbar tab: the page is chosen by a
    // tab in App state, so a session that ends while it is open has to be
    // caught by the gate around the page itself.
    signedIn();

    const { rerender } = render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: /นักศึกษา/ })[0]);
    await screen.findByText(/ไม่พบข้อมูลนักศึกษา/);

    signedOut();
    rerender(<App />);

    expect(await screen.findByLabelText(/อีเมล/)).toBeInTheDocument();
    expect(screen.queryByText(/ไม่พบข้อมูลนักศึกษา/)).not.toBeInTheDocument();
  });
});

describe('keeping the page on refresh (#200)', () => {
  beforeEach(() => {
    window.location.hash = '';
    useAuthMock.mockReset();
    getStudentsMock.mockReset();
    getStudentsMock.mockResolvedValue([]);
  });

  it('opens the page named by the URL hash instead of the home page', async () => {
    // What F5 does: the app is built again from scratch, and the only thing
    // left from before is the URL.
    window.location.hash = '#students';
    signedIn();

    render(<App />);

    expect(await screen.findByText(/ไม่พบข้อมูลนักศึกษา/)).toBeInTheDocument();
  });

  it('falls back to the home page for a hash it does not know', async () => {
    window.location.hash = '#no-such-page';
    signedIn();

    render(<App />);

    expect(screen.queryByText(/ไม่พบข้อมูลนักศึกษา/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /นักศึกษา/ }).length).toBeGreaterThan(0);
  });

  it('writes the page into the URL hash when a tab is chosen', async () => {
    signedIn();

    render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: /นักศึกษา/ })[0]);
    await screen.findByText(/ไม่พบข้อมูลนักศึกษา/);

    expect(window.location.hash).toBe('#students');
  });

  it('follows the browser Back and Forward buttons', async () => {
    signedIn();

    render(<App />);
    await userEvent.click(screen.getAllByRole('button', { name: /นักศึกษา/ })[0]);
    await screen.findByText(/ไม่พบข้อมูลนักศึกษา/);

    // Back/Forward change the hash without a click on the navbar.
    act(() => {
      window.location.hash = '#home';
    });

    await waitFor(() => {
      expect(screen.queryByText(/ไม่พบข้อมูลนักศึกษา/)).not.toBeInTheDocument();
    });
  });
});
