import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { getCompanyById } = await import('./getCompanyById.mjs');

describe('getCompanyById', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('returns 200 with the single company object (not an array) when found', async () => {
    const company = { company_id: 'c1', name: 'Alpha Co' };
    queryMock.mockResolvedValue({ rows: [company] });

    const event = { pathParameters: { companyId: 'c1' } };
    const result = await getCompanyById(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual(company);
    expect(Array.isArray(body)).toBe(false);
  });

  it('returns 404 when no row matches', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = { pathParameters: { companyId: 'does-not-exist' } };
    const result = await getCompanyById(event);

    expect(result.statusCode).toBe(404);
  });

  it('returns 400 for an empty/whitespace companyId and never touches the DB', async () => {
    for (const companyId of ['', '   ']) {
      queryMock.mockClear();
      const event = { pathParameters: { companyId } };
      const result = await getCompanyById(event);

      expect(result.statusCode).toBe(400);
      expect(queryMock).not.toHaveBeenCalled();
    }
  });

  it('returns 400 for a missing companyId (no pathParameters) and never touches the DB', async () => {
    const result = await getCompanyById({ pathParameters: null });

    expect(result.statusCode).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
