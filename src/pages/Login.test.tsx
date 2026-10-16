import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const loginMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ login: loginMock, status: 'anonymous' }),
}));

const { Login } = await import('./Login');

async function fillAndSubmit(email: string, password: string) {
  await userEvent.type(screen.getByLabelText('อีเมล'), email);
  await userEvent.type(screen.getByLabelText('รหัสผ่าน'), password);
  await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
}

describe('Login page', () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it('calls login with the typed email and password', async () => {
    loginMock.mockResolvedValue(undefined);
    render(<Login />);

    await fillAndSubmit('student1@example.com', 'coop1234');

    expect(loginMock).toHaveBeenCalledWith('student1@example.com', 'coop1234');
  });

  it('shows one generic message when login fails', async () => {
    loginMock.mockRejectedValue(new Error('Incorrect username or password.'));
    render(<Login />);

    await fillAndSubmit('student1@example.com', 'wrong');

    // Deliberately not Cognito's own wording: telling a visitor which half
    // was wrong turns the form into an account-enumeration oracle.
    expect(await screen.findByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')).toBeInTheDocument();
  });

  it('clears a previous error when the next attempt succeeds', async () => {
    loginMock.mockRejectedValueOnce(new Error('nope'));
    render(<Login />);

    await fillAndSubmit('student1@example.com', 'wrong');
    expect(await screen.findByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')).toBeInTheDocument();

    loginMock.mockResolvedValue(undefined);
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

    expect(screen.queryByText('อีเมลหรือรหัสผ่านไม่ถูกต้อง')).not.toBeInTheDocument();
  });

  it('does not submit twice while a request is in flight', async () => {
    let release: () => void = () => {};
    loginMock.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    render(<Login />);

    await fillAndSubmit('student1@example.com', 'coop1234');

    const button = screen.getByRole('button', { name: 'เข้าสู่ระบบ' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(loginMock).toHaveBeenCalledTimes(1);

    release();
  });
});
