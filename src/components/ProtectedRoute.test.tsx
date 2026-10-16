import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: useAuthMock }));

const { ProtectedRoute } = await import('./ProtectedRoute');

function renderGate() {
  return render(
    <ProtectedRoute fallback={<div>please login</div>}>
      <div>secret</div>
    </ProtectedRoute>,
  );
}

describe('ProtectedRoute', () => {
  it('renders the fallback when anonymous', () => {
    useAuthMock.mockReturnValue({ status: 'anonymous' });

    renderGate();

    expect(screen.getByText('please login')).toBeInTheDocument();
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    useAuthMock.mockReturnValue({ status: 'authenticated' });

    renderGate();

    expect(screen.getByText('secret')).toBeInTheDocument();
    expect(screen.queryByText('please login')).not.toBeInTheDocument();
  });

  it('renders neither while the session is still being restored', () => {
    useAuthMock.mockReturnValue({ status: 'loading' });

    renderGate();

    // Showing the fallback here would flash a login form at a user who is
    // in fact signed in, every single page load.
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.queryByText('please login')).not.toBeInTheDocument();
  });
});
