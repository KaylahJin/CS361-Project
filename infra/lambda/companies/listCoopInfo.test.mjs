import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { listCoopInfo } = await import('./listCoopInfo.mjs');

describe('listCoopInfo', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('with no params, queries with no WHERE clause and returns the raw rows as a bare array', async () => {
    const rows = [
      {
        info_id: 1,
        item_number: 1,
        curriculum: 'all',
        category: 'qualification',
        title: 'คุณสมบัติทั่วไป',
      },
      {
        info_id: 2,
        item_number: 2,
        curriculum: '61',
        category: 'required_course',
        title: 'รายวิชาที่ต้องเคยศึกษา',
      },
    ];

    queryMock.mockResolvedValue({ rows });

    const event = { queryStringParameters: null };
    const result = await listCoopInfo(event);

    expect(queryMock).toHaveBeenCalledTimes(1);

    const [text, values] = queryMock.mock.calls[0];

    expect(text).not.toMatch(/WHERE/i);
    expect(values).toEqual([]);

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body).toEqual(rows);
    expect(Array.isArray(body)).toBe(true);
  });

  it('with search only, queries title or description with ILIKE and wraps the term in %...%', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = {
      queryStringParameters: { search: 'GPA' },
    };

    await listCoopInfo(event);

    const [text, values] = queryMock.mock.calls[0];

    expect(text).toMatch(/title\s+ILIKE/i);
    expect(text).toMatch(/description\s+ILIKE/i);
    expect(values).toEqual(['%GPA%']);
  });

  it('with category only, queries with an exact-match condition', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = {
      queryStringParameters: { category: 'gpa' },
    };

    await listCoopInfo(event);

    const [text, values] = queryMock.mock.calls[0];

    expect(text).toMatch(/category\s*=\s*\$\d/i);
    expect(values).toEqual(['gpa']);
  });

  it('with curriculum only, queries with an exact-match condition', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = {
      queryStringParameters: { curriculum: '61' },
    };

    await listCoopInfo(event);

    const [text, values] = queryMock.mock.calls[0];

    expect(text).toMatch(/curriculum\s*=\s*\$\d/i);
    expect(values).toEqual(['61']);
  });

  it('with search, category and curriculum, combines all conditions with AND and passes values in order', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = {
      queryStringParameters: {
        search: 'คพ.251',
        category: 'required_course',
        curriculum: '61',
      },
    };

    await listCoopInfo(event);

    const [text, values] = queryMock.mock.calls[0];

    expect(text).toMatch(/ILIKE/i);
    expect(text).toMatch(/category\s*=\s*\$\d/i);
    expect(text).toMatch(/curriculum\s*=\s*\$\d/i);
    expect(text.match(/AND/g)).toHaveLength(2);

    expect(values).toEqual([
      '%คพ.251%',
      'required_course',
      '61',
    ]);
  });

  it('when there are no matching rows, returns 200 with an empty array', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = {
      queryStringParameters: {
        search: 'ไม่มีข้อมูลนี้',
      },
    };

    const result = await listCoopInfo(event);

    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);

    expect(body).toEqual([]);
    expect(Array.isArray(body)).toBe(true);
  });
});