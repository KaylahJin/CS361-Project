import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { listCompanies } = await import('./listCompanies.mjs');

describe('listCompanies', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('with no params, queries with no WHERE clause and returns the raw rows as a bare array', async () => {
    const rows = [
      { company_id: 'c1', name: 'Alpha Co' },
      { company_id: 'c2', name: 'Beta Co' },
    ];
    queryMock.mockResolvedValue({ rows });

    const event = { queryStringParameters: null };
    const result = await listCompanies(event);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [text, values] = queryMock.mock.calls[0];
    expect(text).not.toMatch(/WHERE/i);
    expect(values).toEqual([]);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual(rows);
    expect(Array.isArray(body)).toBe(true);
  });

  it('with search only, queries with ILIKE and wraps the term in %...%', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = { queryStringParameters: { search: 'foo' } };
    await listCompanies(event);

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/ILIKE/i);
    expect(values).toContain('%foo%');
    expect(values).toHaveLength(1);
  });

  it('with province only, queries with an exact-match condition and the raw (unwrapped) value', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = { queryStringParameters: { province: 'กรุงเทพมหานคร' } };
    await listCompanies(event);

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/province\s*=\s*\$\d/);
    expect(text).not.toMatch(/ILIKE/i);
    expect(values).toContain('กรุงเทพมหานคร');
    expect(values).not.toContain('%กรุงเทพมหานคร%');
    expect(values).toHaveLength(1);
  });

  it('with both search and province, combines both conditions with AND and passes both values in order', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = {
      queryStringParameters: { search: 'foo', province: 'ชลบุรี' },
    };
    await listCompanies(event);

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/ILIKE/i);
    expect(text).toMatch(/province\s*=\s*\$\d/);
    expect(text).toMatch(/AND/i);
    expect(values).toEqual(['%foo%', 'ชลบุรี']);
  });
});
