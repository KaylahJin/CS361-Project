import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { getCoopPlanById } = await import('./getCoopPlanById.mjs');

describe('getCoopPlanById', () => {
  beforeEach(() => {
    queryMock.mockReset();
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
