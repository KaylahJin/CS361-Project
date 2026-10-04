import { describe, it, expect, vi, beforeEach } from 'vitest';

const listCompaniesMock = vi.fn();
const getCompanyByIdMock = vi.fn();

vi.mock('./listCompanies.mjs', () => ({
  listCompanies: listCompaniesMock,
}));

vi.mock('./getCompanyById.mjs', () => ({
  getCompanyById: getCompanyByIdMock,
}));

const { handler } = await import('./index.mjs');

describe('companies router (index.mjs handler)', () => {
  beforeEach(() => {
    listCompaniesMock.mockReset();
    getCompanyByIdMock.mockReset();
  });

  it('returns 404 for an unknown routeKey', async () => {
    const result = await handler({ routeKey: 'DELETE /companies' });

    expect(result.statusCode).toBe(404);
    expect(listCompaniesMock).not.toHaveBeenCalled();
    expect(getCompanyByIdMock).not.toHaveBeenCalled();
  });

  it('returns 404 for inherited Object.prototype property names used as routeKey', async () => {
    for (const routeKey of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
      const result = await handler({ routeKey });
      expect(result.statusCode).toBe(404);
    }
  });

  it('catches a thrown error from a handler and returns a generic 500 body that does not leak the thrown message', async () => {
    listCompaniesMock.mockImplementation(() => {
      throw new Error('SENTINEL_SHOULD_NOT_LEAK');
    });

    const result = await handler({ routeKey: 'GET /companies' });

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toMatch(/SENTINEL/);

    const body = JSON.parse(result.body);
    expect(body).toEqual({ error: 'Internal server error' });
  });

  it('dispatches a known routeKey to the matching handler and returns its response', async () => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '[]' };
    listCompaniesMock.mockResolvedValue(handlerResponse);

    const event = { routeKey: 'GET /companies' };
    const result = await handler(event);

    expect(listCompaniesMock).toHaveBeenCalledWith(event);
    expect(result).toBe(handlerResponse);
  });
});
