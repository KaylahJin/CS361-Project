import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { getAuthenticatedUser } = await import('./auth.mjs');

function eventWithSub(sub) {
  return { requestContext: { authorizer: { jwt: { claims: { sub } } } } };
}

describe('getAuthenticatedUser', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('denies with 401 without querying when there is no verified sub claim', async () => {
    const { user, denied } = await getAuthenticatedUser({ requestContext: {} });

    expect(user).toBeNull();
    expect(denied).toEqual({ status: 401, error: 'Unauthorized' });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('denies with 401 without querying for a malformed event', async () => {
    for (const event of [undefined, null, {}, { requestContext: { authorizer: {} } }]) {
      queryMock.mockClear();
      const { user, denied } = await getAuthenticatedUser(event);

      expect(user).toBeNull();
      expect(denied.status).toBe(401);
      expect(queryMock).not.toHaveBeenCalled();
    }
  });

  it('returns the mapped user when an active app_users row matches the sub', async () => {
    queryMock.mockResolvedValue({
      rows: [{ cognito_sub: 'sub-1', role: 'STUDENT', student_id: 'S001', is_active: true }],
    });

    const { user, denied } = await getAuthenticatedUser(eventWithSub('sub-1'));

    expect(user).toEqual({ sub: 'sub-1', role: 'STUDENT', studentId: 'S001' });
    expect(denied).toBeNull();
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('app_users'), ['sub-1']);
  });

  it('denies with 403 when no app_users row matches the sub', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const { user, denied } = await getAuthenticatedUser(eventWithSub('unknown'));

    // The token was valid, so the caller is authenticated but not authorised.
    // Acceptance criteria on #100 require 403 here, not 401.
    expect(user).toBeNull();
    expect(denied).toEqual({ status: 403, error: 'Forbidden' });
  });

  it('denies with 403 for a matched but deactivated account', async () => {
    queryMock.mockResolvedValue({
      rows: [{ cognito_sub: 'sub-2', role: 'STAFF', student_id: null, is_active: false }],
    });

    const { user, denied } = await getAuthenticatedUser(eventWithSub('sub-2'));

    expect(user).toBeNull();
    expect(denied).toEqual({ status: 403, error: 'Forbidden' });
  });

  it('passes the sub as a bound parameter, never interpolated into the SQL', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await getAuthenticatedUser(eventWithSub("'; DROP TABLE app_users; --"));

    const [text, values] = queryMock.mock.calls[0];
    expect(text).not.toContain('DROP TABLE');
    expect(values).toEqual(["'; DROP TABLE app_users; --"]);
  });

  it('keeps studentId null for a non-student role', async () => {
    queryMock.mockResolvedValue({
      rows: [{ cognito_sub: 'sub-3', role: 'ADVISOR', student_id: null, is_active: true }],
    });

    const { user } = await getAuthenticatedUser(eventWithSub('sub-3'));

    expect(user).toEqual({
      sub: 'sub-3',
      role: 'ADVISOR',
      studentId: null,
    });
  });
});
