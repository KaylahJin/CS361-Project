import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { listStudents } = await import('./listStudents.mjs');

describe('listStudents', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('with no params, queries with no WHERE clause and returns the raw rows as a bare array', async () => {
    const rows = [
      { student_id: '6100000001', first_name: 'เอเอ', gpa: 3.2 },
      { student_id: '6600000001', first_name: 'บีบี', gpa: 2.9 },
    ];
    queryMock.mockResolvedValue({ rows });

    const event = { queryStringParameters: null };
    const result = await listStudents(event);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/FROM students/);
    expect(text).toMatch(/ORDER BY student_id/);
    expect(text).not.toMatch(/WHERE/i);
    expect(values).toEqual([]);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual(rows);
    expect(Array.isArray(body)).toBe(true);
  });

  it('works when the event has no queryStringParameters at all', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const result = await listStudents({});

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
    expect(queryMock.mock.calls[0][1]).toEqual([]);
  });

  it('with search only, queries with ILIKE and wraps the term in %...%', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = { queryStringParameters: { search: 'ใจดี' } };
    await listStudents(event);

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/ILIKE/i);
    expect(values).toEqual(['%ใจดี%']);
    expect(text).not.toMatch(/curriculum\s*=/);
  });

  it('search covers first name, last name, full name and student id', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listStudents({ queryStringParameters: { search: 'x' } });

    const [text] = queryMock.mock.calls[0];
    expect(text).toMatch(/first_name\s+ILIKE/i);
    expect(text).toMatch(/last_name\s+ILIKE/i);
    expect(text).toMatch(/first_name\s*\|\|\s*' '\s*\|\|\s*last_name/i);
    expect(text).toMatch(/student_id\s+ILIKE/i);
  });

  it('search never touches email or phone', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listStudents({ queryStringParameters: { search: 'x' } });

    const [text] = queryMock.mock.calls[0];
    const whereClause = text.slice(text.indexOf('WHERE'));
    expect(whereClause).not.toMatch(/email|phone/i);
  });

  it('with curriculum only, queries with an exact-match condition and the raw (unwrapped) value', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = { queryStringParameters: { curriculum: '66' } };
    await listStudents(event);

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/curriculum\s*=\s*\$\d/);
    expect(text).not.toMatch(/ILIKE/i);
    expect(values).toEqual(['66']);
  });

  it('with both search and curriculum, combines both conditions with AND and passes both values in order', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = { queryStringParameters: { search: 'ใจดี', curriculum: '61' } };
    await listStudents(event);

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/ILIKE/i);
    expect(text).toMatch(/curriculum\s*=\s*\$2/);
    expect(text).toMatch(/\)\s+AND\s+curriculum/i);
    expect(values).toEqual(['%ใจดี%', '61']);
  });

  it('treats empty and whitespace-only params as not provided', async () => {
    for (const queryStringParameters of [
      { search: '', curriculum: '' },
      { search: '   ', curriculum: '   ' },
    ]) {
      queryMock.mockReset();
      queryMock.mockResolvedValue({ rows: [] });

      await listStudents({ queryStringParameters });

      const [text, values] = queryMock.mock.calls[0];
      expect(text).not.toMatch(/WHERE/i);
      expect(values).toEqual([]);
    }
  });

  it('trims surrounding whitespace from search and curriculum values', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listStudents({ queryStringParameters: { search: '  เอเอ ', curriculum: ' 61 ' } });

    expect(queryMock.mock.calls[0][1]).toEqual(['%เอเอ%', '61']);
  });

  it('ignores unknown query params (e.g. gpa) instead of putting them in the SQL', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await listStudents({ queryStringParameters: { gpa: '4', foo: 'bar' } });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).not.toMatch(/WHERE/i);
    expect(values).toEqual([]);
  });

  it('keeps user input out of the SQL text (parameterized, injection-safe)', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const evil = "'; DROP TABLE students; --";
    await listStudents({ queryStringParameters: { search: evil, curriculum: evil } });

    const [text, values] = queryMock.mock.calls[0];
    expect(text).not.toMatch(/DROP TABLE/i);
    expect(text).not.toContain("'; --");
    expect(values).toEqual([`%${evil}%`, evil]);
  });

  it('returns 200 with [] when nothing matches', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const result = await listStudents({ queryStringParameters: { search: 'ไม่มีใคร' } });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual([]);
  });

  it('returns a generic 500 that does not leak the DB error', async () => {
    queryMock.mockRejectedValue(new Error('SENTINEL_SHOULD_NOT_LEAK'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await listStudents({ queryStringParameters: null });

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toMatch(/SENTINEL/);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal server error' });
  });
});