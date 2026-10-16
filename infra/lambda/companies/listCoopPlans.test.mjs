import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
const getAuthenticatedUserMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

// Identity is mocked; the real authorize.mjs is NOT, so these cases
// exercise the actual role-filter SQL rather than a stub of it.
vi.mock('./auth.mjs', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

const { listCoopPlans } = await import('./listCoopPlans.mjs');

const STAFF = { sub: 'staff-1', role: 'STAFF', studentId: null };

describe('listCoopPlans', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    // STAFF sees every row and adds no filter, so every pre-existing case
    // below keeps asserting exactly the SQL it always did.
    getAuthenticatedUserMock.mockResolvedValue(STAFF);
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

describe('listCoopPlans authorization', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    getAuthenticatedUserMock.mockResolvedValue(STAFF);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns 401 without touching the DB when there is no authenticated user', async () => {
    getAuthenticatedUserMock.mockResolvedValue(null);

    const result = await listCoopPlans({ queryStringParameters: null });

    expect(result.statusCode).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns 403 without touching the DB for an ADMIN-only account', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ sub: 'admin-1', role: 'ADMIN', studentId: null });

    const result = await listCoopPlans({ queryStringParameters: null });

    expect(result.statusCode).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('STAFF: queries with no role filter', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({ queryStringParameters: null });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).not.toContain('WHERE');
    expect(values).toEqual([]);
  });

  it('STUDENT: scopes the query to their own student_id', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ sub: 'sub-1', role: 'STUDENT', studentId: 'S001' });
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({ queryStringParameters: null });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toContain('p.student_id =');
    expect(values).toEqual(['S001']);
  });

  it('STUDENT: a studentId param for someone else narrows, never widens, their scope', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ sub: 'sub-1', role: 'STUDENT', studentId: 'S001' });
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({ queryStringParameters: { studentId: 'S999' } });

    const [text, values] = queryMock.mock.calls[0];
    // Both conditions survive and are ANDed, so the result set is empty
    // rather than S999's plans. The caller-supplied value never replaces
    // the identity-derived one.
    expect(values).toContain('S001');
    expect(values).toContain('S999');
    expect(text.match(/p\.student_id = \$\d+/g)).toHaveLength(2);
    expect(text).toContain(' AND ');
  });

  it('STUDENT: leaves no unsubstituted $PARAM placeholder in the SQL', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ sub: 'sub-1', role: 'STUDENT', studentId: 'S001' });
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({ queryStringParameters: null });

    expect(queryMock.mock.calls[0][0]).not.toContain('$PARAM');
  });

  it('ADVISOR: scopes the query to assigned students via advisor_student_assignments', async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      sub: 'advisor-1',
      role: 'ADVISOR',
      studentId: null,
    });
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({ queryStringParameters: null });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toContain('advisor_student_assignments');
    expect(text).not.toContain('$PARAM');
    expect(values).toEqual(['advisor-1']);
  });

  it('ADVISOR: the advisor sub is bound as a parameter, not interpolated', async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      sub: "'; DROP TABLE coop_plans; --",
      role: 'ADVISOR',
      studentId: null,
    });
    queryMock.mockResolvedValue({ rows: [] });

    await listCoopPlans({ queryStringParameters: null });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).not.toContain('DROP TABLE');
    expect(values).toEqual(["'; DROP TABLE coop_plans; --"]);
  });
});
