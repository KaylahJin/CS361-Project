import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { getAuthenticatedUser } = await import('./auth.mjs');

/** @param {string} sub */
function eventWithSub(sub) {
  return { requestContext: { authorizer: { jwt: { claims: { sub } } } } };
}

describe('getAuthenticatedUser', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('returns null without querying when there is no verified sub claim', async () => {
    expect(await getAuthenticatedUser({ requestContext: {} })).toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns null without querying for a malformed event', async () => {
    for (const event of [undefined, null, {}, { requestContext: { authorizer: {} } }]) {
      queryMock.mockClear();
      expect(await getAuthenticatedUser(event)).toBeNull();
      expect(queryMock).not.toHaveBeenCalled();
    }
  });

  it('returns the mapped user when an active app_users row matches the sub', async () => {
    queryMock.mockResolvedValue({
      rows: [{ cognito_sub: 'sub-1', role: 'STUDENT', student_id: 'S001', is_active: true }],
    });

    const result = await getAuthenticatedUser(eventWithSub('sub-1'));

    expect(result).toEqual({ sub: 'sub-1', role: 'STUDENT', studentId: 'S001' });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('app_users'), ['sub-1']);
  });

  it('returns null when no app_users row matches the sub', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    expect(await getAuthenticatedUser(eventWithSub('unknown'))).toBeNull();
  });

  it('returns null for a matched but deactivated account, so the caller answers 401 not 403', async () => {
    queryMock.mockResolvedValue({
      rows: [{ cognito_sub: 'sub-2', role: 'STAFF', student_id: null, is_active: false }],
    });

    expect(await getAuthenticatedUser(eventWithSub('sub-2'))).toBeNull();
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

    expect(await getAuthenticatedUser(eventWithSub('sub-3'))).toEqual({
      sub: 'sub-3',
      role: 'ADVISOR',
      studentId: null,
    });
  });
});
