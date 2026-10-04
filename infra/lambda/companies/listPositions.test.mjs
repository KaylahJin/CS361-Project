import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { listPositions } = await import('./listPositions.mjs');

describe('listPositions', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('with no params, queries with no WHERE clause and returns bare array of positions', async () => {
    const rows = [
      { position_id: 'POS001', company_id: 'C18', title: 'Programmer', category: 'software_development' },
      { position_id: 'POS003', company_id: 'C76', title: 'AI Developer', category: 'data_ai' },
    ];
    queryMock.mockResolvedValue({ rows });

    const event = { queryStringParameters: null };
    const result = await listPositions(event);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [text, values] = queryMock.mock.calls[0];
    expect(text).not.toMatch(/WHERE/i);
    expect(values).toEqual([]);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual(rows);
    expect(Array.isArray(body)).toBe(true);
  });

  it('with search param, queries with ILIKE on title/company name and wraps search term with %', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = { queryStringParameters: { search: 'developer' } };
    await listPositions(event);

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/ILIKE/i);
    expect(values).toContain('%developer%');
    expect(values).toHaveLength(1);
  });

  it('with category param, filters by exact category', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = { queryStringParameters: { category: 'software_development' } };
    await listPositions(event);

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/p\.category\s*=\s*\$\d/);
    expect(values).toContain('software_development');
    expect(values).toHaveLength(1);
  });

  it('with work_mode, status, and company_id params, combines conditions with AND', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = {
      queryStringParameters: {
        category: 'data_ai',
        work_mode: 'hybrid',
        status: 'open',
        company_id: 'C28',
      },
    };
    await listPositions(event);

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/p\.category\s*=\s*\$\d/);
    expect(text).toMatch(/p\.work_mode\s*=\s*\$\d/);
    expect(text).toMatch(/p\.status\s*=\s*\$\d/);
    expect(text).toMatch(/p\.company_id\s*=\s*\$\d/);
    expect(values).toEqual(['data_ai', 'hybrid', 'open', 'C28']);
  });

  it('handles database error gracefully by returning 500', async () => {
    queryMock.mockRejectedValue(new Error('DB connection failed'));

    const event = { queryStringParameters: null };
    const result = await listPositions(event);

    expect(result.statusCode).toBe(500);
    const body = JSON.parse(result.body);
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
