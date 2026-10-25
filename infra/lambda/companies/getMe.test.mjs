import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthenticatedUserMock = vi.fn();

vi.mock('./auth.mjs', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

const { getMe } = await import('./getMe.mjs');

describe('getMe', () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
  });

  it('returns only role and studentId, not the Cognito sub', async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      user: { sub: 'secret-sub', role: 'STUDENT', studentId: '6600000001' },
      denied: null,
    });

    const res = await getMe({});

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ role: 'STUDENT', studentId: '6600000001' });
  });

  it.each(['ADVISOR', 'STAFF', 'ADMIN'])('returns the %s role with a null studentId', async (role) => {
    getAuthenticatedUserMock.mockResolvedValue({
      user: { sub: 's', role, studentId: null },
      denied: null,
    });

    const res = await getMe({});

    expect(JSON.parse(res.body)).toEqual({ role, studentId: null });
  });

  it.each([401, 403])('passes through %i from the auth check', async (status) => {
    getAuthenticatedUserMock.mockResolvedValue({
      user: null,
      denied: { status, error: 'denied' },
    });

    const res = await getMe({});

    expect(res.statusCode).toBe(status);
    expect(JSON.parse(res.body)).toEqual({ error: 'denied' });
  });

  it('answers 500 without leaking the error when the lookup throws', async () => {
    getAuthenticatedUserMock.mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await getMe({});

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('db down');
  });
});
