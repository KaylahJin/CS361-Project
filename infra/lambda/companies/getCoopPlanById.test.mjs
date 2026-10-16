import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
const getAuthenticatedUserMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

// Identity is mocked; the real authorize.mjs is NOT, so the ownership and
// advisor-assignment rules below are the real ones, not a stub's.
vi.mock('./auth.mjs', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

const { getCoopPlanById } = await import('./getCoopPlanById.mjs');

const STAFF = { sub: 'staff-1', role: 'STAFF', studentId: null };

describe('getCoopPlanById', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    // STAFF may view any plan, so every pre-existing case below behaves
    // exactly as it did before authorization was added.
    getAuthenticatedUserMock.mockResolvedValue(STAFF);
  });

  it('returns 200 with the single plan object (not an array) when found', async () => {
    const plan = { plan_id: 101, student_id: '6100000002', status: 'APPROVED' };
    queryMock.mockResolvedValue({ rows: [plan] });

    const result = await getCoopPlanById({ pathParameters: { planId: '101' } });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual(plan);
    expect(Array.isArray(body)).toBe(false);
  });

  it('passes planId as a numeric $1 parameter, never interpolated into SQL', async () => {
    queryMock.mockResolvedValue({ rows: [{ plan_id: 7 }] });

    await getCoopPlanById({ pathParameters: { planId: '7' } });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/WHERE\s+p\.plan_id\s*=\s*\$1/);
    expect(values).toEqual([7]);
  });

  it('returns 404 when no row matches', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const result = await getCoopPlanById({ pathParameters: { planId: '999' } });

    expect(result.statusCode).toBe(404);
  });

  it('returns 400 for empty / whitespace / non-numeric / out-of-range planId and never touches the DB', async () => {
    for (const planId of ['', '   ', 'abc', '1; DROP TABLE coop_plans', '-5', '0', '1.5', '2147483648']) {
      queryMock.mockClear();
      const result = await getCoopPlanById({ pathParameters: { planId } });

      expect(result.statusCode, `planId=${JSON.stringify(planId)}`).toBe(400);
      expect(queryMock).not.toHaveBeenCalled();
    }
  });

  it('returns 400 for a missing planId (no pathParameters) and never touches the DB', async () => {
    const result = await getCoopPlanById({ pathParameters: null });

    expect(result.statusCode).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns 500 with a generic body when the query throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error('connection refused: secret-host'));

    const result = await getCoopPlanById({ pathParameters: { planId: '1' } });

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('secret-host');
  });
});

describe('getCoopPlanById authorization', () => {
  const plan = { plan_id: 1, student_id: 'S001', status: 'SUBMITTED' };

  beforeEach(() => {
    queryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue(STAFF);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns 401 without touching the DB when there is no authenticated user', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const result = await getCoopPlanById({ pathParameters: { planId: '1' } });

    expect(result.statusCode).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid planId with 400 before even resolving the user', async () => {
    const result = await getCoopPlanById({ pathParameters: { planId: 'abc' } });

    expect(result.statusCode).toBe(400);
    expect(getAuthenticatedUserMock).not.toHaveBeenCalled();
  });

  it('STUDENT owner: returns 200 with the plan', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ sub: 'sub-1', role: 'STUDENT', studentId: 'S001' });
    queryMock.mockResolvedValue({ rows: [plan] });

    const result = await getCoopPlanById({ pathParameters: { planId: '1' } });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(plan);
  });

  it("STUDENT non-owner: returns 403 and leaks none of the plan's data", async () => {
    getAuthenticatedUserMock.mockResolvedValue({ sub: 'sub-9', role: 'STUDENT', studentId: 'S999' });
    queryMock.mockResolvedValue({ rows: [plan] });

    const result = await getCoopPlanById({ pathParameters: { planId: '1' } });

    expect(result.statusCode).toBe(403);
    expect(result.body).not.toContain('S001');
    expect(result.body).not.toContain('SUBMITTED');
  });

  it('ADVISOR assigned to the plan owner: returns 200', async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      sub: 'advisor-1',
      role: 'ADVISOR',
      studentId: null,
    });
    queryMock
      .mockResolvedValueOnce({ rows: [plan] })
      .mockResolvedValueOnce({ rows: [{ student_id: 'S001' }] });

    const result = await getCoopPlanById({ pathParameters: { planId: '1' } });

    expect(result.statusCode).toBe(200);
  });

  it('ADVISOR not assigned to the plan owner: returns 403', async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      sub: 'advisor-2',
      role: 'ADVISOR',
      studentId: null,
    });
    queryMock.mockResolvedValueOnce({ rows: [plan] }).mockResolvedValueOnce({ rows: [] });

    const result = await getCoopPlanById({ pathParameters: { planId: '1' } });

    expect(result.statusCode).toBe(403);
  });

  it('ADMIN without a reviewer role: returns 403', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ sub: 'admin-1', role: 'ADMIN', studentId: null });
    queryMock.mockResolvedValue({ rows: [plan] });

    const result = await getCoopPlanById({ pathParameters: { planId: '1' } });

    expect(result.statusCode).toBe(403);
  });

  it('returns 404 for a missing plan even for STAFF, who may view everything', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const result = await getCoopPlanById({ pathParameters: { planId: '999' } });

    expect(result.statusCode).toBe(404);
  });
});
