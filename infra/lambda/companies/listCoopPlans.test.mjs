import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { listCoopPlans } = await import('./listCoopPlans.mjs');

describe('listCoopPlans', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('with no params, queries with no WHERE clause and returns the raw rows as a bare array', async () => {
    const rows = [
      { plan_id: 2, status: 'SUBMITTED' },
      { plan_id: 1, status: 'PREPARING' },
    ];
    queryMock.mockResolvedValue({ rows });

    const result = await listCoopPlans({ queryStringParameters: null });

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [text, values] = queryMock.mock.calls[0];
    expect(text).not.toMatch(/WHERE/i);
    expect(text).toMatch(/ORDER BY p\.submitted_at DESC NULLS LAST/);
    expect(values).toEqual([]);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual(rows);
    expect(Array.isArray(body)).toBe(true);
  });

  it('treats empty / whitespace-only params as not provided', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({ queryStringParameters: { status: '', search: '   ', periodId: '' } });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).not.toMatch(/WHERE/i);
    expect(values).toEqual([]);
  });

  it('with status only, filters by exact status', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({ queryStringParameters: { status: 'APPROVED' } });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/p\.status\s*=\s*\$1/);
    expect(values).toEqual(['APPROVED']);
  });

  it('returns 400 for an invalid status and never touches the DB', async () => {
    const result = await listCoopPlans({ queryStringParameters: { status: 'approved' } });

    expect(result.statusCode).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('with search, uses ILIKE over student id / first / last / full name with %...% wrapping', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({ queryStringParameters: { search: 'ใจดี' } });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/s\.first_name ILIKE/);
    expect(text).toMatch(/s\.last_name ILIKE/);
    expect(text).toMatch(/s\.student_id ILIKE/);
    expect(values).toEqual(['%ใจดี%']);
  });

  it('with curriculum, period, company and position, uses exact-match conditions with raw values', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({
      queryStringParameters: { curriculum: '61', periodId: 'P2568-1', companyId: 'C47', positionId: 'POS013' },
    });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/s\.curriculum\s*=\s*\$1/);
    expect(text).toMatch(/p\.period_id\s*=\s*\$2/);
    expect(text).toMatch(/pos\.company_id\s*=\s*\$3/);
    expect(text).toMatch(/p\.position_id\s*=\s*\$4/);
    expect(values).toEqual(['61', 'P2568-1', 'C47', 'POS013']);
  });

  it('with a submitted date range, adds Bangkok-day bounds and passes the raw dates', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({
      queryStringParameters: { submittedFrom: '2025-05-01', submittedTo: '2025-05-31' },
    });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/p\.submitted_at\s*>=/);
    expect(text).toMatch(/p\.submitted_at\s*</);
    expect(text).toMatch(/Asia\/Bangkok/);
    expect(values).toEqual(['2025-05-01', '2025-05-31']);
  });

  it('returns 400 for malformed or impossible dates and never touches the DB', async () => {
    for (const q of [
      { submittedFrom: '01/05/2025' },
      { submittedTo: '2025-02-30' },
      { submittedFrom: 'yesterday' },
    ]) {
      queryMock.mockClear();
      const result = await listCoopPlans({ queryStringParameters: q });

      expect(result.statusCode, JSON.stringify(q)).toBe(400);
      expect(queryMock).not.toHaveBeenCalled();
    }
  });

  it('combines multiple filters with AND and keeps placeholders in order', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({ queryStringParameters: { status: 'REJECTED', curriculum: '66', search: 'foo' } });

    const [text, values] = queryMock.mock.calls[0];
    expect(text.match(/AND/gi).length).toBeGreaterThanOrEqual(2);
    expect(values).toEqual(['REJECTED', '%foo%', '66']);
  });

  it('never interpolates user input into the SQL text', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({ queryStringParameters: { search: "'; DROP TABLE coop_plans; --" } });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).not.toContain('DROP TABLE');
    expect(values[0]).toContain('DROP TABLE');
  });

  it('returns 500 with a generic body when the query throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    queryMock.mockRejectedValue(new Error('connection refused: secret-host'));

    const result = await listCoopPlans({ queryStringParameters: null });

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('secret-host');
  });
});
