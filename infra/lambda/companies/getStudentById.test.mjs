import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { getStudentById } = await import('./getStudentById.mjs');

describe('getStudentById', () => {
  beforeEach(() => {
    queryMock.mockReset();
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