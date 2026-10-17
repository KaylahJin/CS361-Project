import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

// Auth is mocked, not the app_users query behind it: these suites are about
// the SQL each handler builds, and a real getAuthenticatedUser would add a
// second call to the same pool mock and shift every call index.
//
// Default is STAFF — the role that sees every row and every field — so the
// pre-auth expectations in these tests still describe the unscoped query.
// Role-specific behaviour lives in authorize.test.mjs and in the role suites.
const getAuthenticatedUserMock = vi.fn();

vi.mock('./auth.mjs', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

function signedInAs(role, studentId = null) {
  getAuthenticatedUserMock.mockResolvedValue({
    user: { sub: `${role.toLowerCase()}-sub`, role, studentId },
    denied: null,
  });
}

function deniedWith(status) {
  getAuthenticatedUserMock.mockResolvedValue({
    user: null,
    denied: { status, error: status === 401 ? 'Unauthorized' : 'Forbidden' },
  });
}

const { getStudentById } = await import('./getStudentById.mjs');

describe('getStudentById', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    signedInAs('STAFF');
  });

  it('returns 200 with the single student object (not an array) including its courses array', async () => {
    const student = {
      student_id: '6100000001',
      first_name: 'เอเอ',
      gpa: 3.2,
      courses: [
        { course_code: 'คพ.101', status: 'PASSED', grade_point: 3 },
        { course_code: 'คพ.384', status: 'ENROLLED', grade_point: null },
      ],
    };
    queryMock.mockResolvedValue({ rows: [student] });

    const event = { pathParameters: { studentId: '6100000001' } };
    const result = await getStudentById(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual(student);
    expect(Array.isArray(body)).toBe(false);
    expect(Array.isArray(body.courses)).toBe(true);
  });

  it('passes the trimmed id as a bound parameter (never interpolated into the SQL)', async () => {
    queryMock.mockResolvedValue({ rows: [{ student_id: '6100000001', courses: [] }] });

    await getStudentById({ pathParameters: { studentId: '  6100000001 ' } });

    const [text, values] = queryMock.mock.calls[0];
    expect(values).toEqual(['6100000001']);
    expect(text).toMatch(/\$1/);
    expect(text).not.toMatch(/6100000001/);
  });

  it('returns courses: [] for a student with no course records', async () => {
    queryMock.mockResolvedValue({ rows: [{ student_id: '6100000006', courses: [] }] });

    const result = await getStudentById({ pathParameters: { studentId: '6100000006' } });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).courses).toEqual([]);
  });

  it('returns 404 when no row matches', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = { pathParameters: { studentId: '0000000000' } };
    const result = await getStudentById(event);

    expect(result.statusCode).toBe(404);
  });

  it('returns 400 for an empty/whitespace studentId and never touches the DB', async () => {
    for (const studentId of ['', '   ']) {
      queryMock.mockClear();
      const event = { pathParameters: { studentId } };
      const result = await getStudentById(event);

      expect(result.statusCode).toBe(400);
      expect(queryMock).not.toHaveBeenCalled();
    }
  });

  it('returns 400 for a missing studentId (no pathParameters) and never touches the DB', async () => {
    const result = await getStudentById({ pathParameters: null });

    expect(result.statusCode).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns a generic 500 that does not leak the DB error', async () => {
    queryMock.mockRejectedValue(new Error('SENTINEL_SHOULD_NOT_LEAK'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getStudentById({ pathParameters: { studentId: '6100000001' } });

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toMatch(/SENTINEL/);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal server error' });
  });
});


describe('getStudentById and the role of the caller', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    queryMock.mockResolvedValue({ rows: [] });
  });

  const request = (studentId) => getStudentById({ pathParameters: { studentId } });

  it('answers 401 without touching the database when there is no identity', async () => {
    deniedWith(401);

    const result = await request('6600000001');

    expect(result.statusCode).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('answers 403 for a token with no app_users row', async () => {
    deniedWith(403);

    const result = await request('6600000001');

    expect(result.statusCode).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('STUDENT: reads their own row', async () => {
    signedInAs('STUDENT', '6600000001');
    queryMock.mockResolvedValue({ rows: [{ student_id: '6600000001', courses: [] }] });

    const result = await request('6600000001');

    expect(result.statusCode).toBe(200);
    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/s\.student_id\s*=/);
    expect(values).toEqual(['6600000001', '6600000001']);
  });

  it('STUDENT asking for somebody else: 404, indistinguishable from a missing id', async () => {
    signedInAs('STUDENT', '6600000001');
    queryMock.mockResolvedValue({ rows: [] });

    const result = await request('6100000001');

    expect(result.statusCode).toBe(404);
    // The scope is part of the query, so the other student's row is never read.
    const [, values] = queryMock.mock.calls[0];
    expect(values).toEqual(['6100000001', '6600000001']);
  });

  it('STUDENT with no linked student record: 403, no query', async () => {
    signedInAs('STUDENT', null);

    const result = await request('6600000001');

    expect(result.statusCode).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('ADVISOR: the assignment check is part of the query, not a later if', async () => {
    signedInAs('ADVISOR');

    await request('6600000001');

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/advisor_student_assignments/);
    expect(values).toEqual(['6600000001', 'advisor-sub']);
  });

  it('ADVISOR not assigned to that student: 404', async () => {
    signedInAs('ADVISOR');
    queryMock.mockResolvedValue({ rows: [] });

    const result = await request('6100000001');

    expect(result.statusCode).toBe(404);
  });

  it('STAFF: any student, every field but a birth date', async () => {
    signedInAs('STAFF');
    queryMock.mockResolvedValue({ rows: [{ student_id: '6100000001', courses: [] }] });

    const result = await request('6100000001');

    expect(result.statusCode).toBe(200);
    const [text] = queryMock.mock.calls[0];
    expect(text).toMatch(/s\.email/);
    expect(text).toMatch(/gpa/);
    expect(text).not.toMatch(/birth_date/);
    expect(text).toMatch(/student_courses/);
  });

  it('ADMIN: identity only, and student_courses is not joined at all', async () => {
    signedInAs('ADMIN');
    queryMock.mockResolvedValue({ rows: [{ student_id: '6100000001' }] });

    const result = await request('6100000001');

    expect(result.statusCode).toBe(200);
    const [text] = queryMock.mock.calls[0];
    expect(text).not.toMatch(/student_courses/);
    expect(text).not.toMatch(/email/);
    expect(text).not.toMatch(/gpa/);
    expect(text).not.toMatch(/birth_date/);
    expect(JSON.parse(result.body)).not.toHaveProperty('gpa');
    expect(JSON.parse(result.body)).not.toHaveProperty('courses');
  });

  it('a role the rules do not cover: 403, no query', async () => {
    signedInAs('EMPLOYER_COORDINATOR');

    const result = await request('6100000001');

    expect(result.statusCode).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
