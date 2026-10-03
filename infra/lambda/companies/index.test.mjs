import { describe, it, expect, vi, beforeEach } from 'vitest';

const listCompaniesMock = vi.fn();
const getCompanyByIdMock = vi.fn();
const listPositionsMock = vi.fn();
const getPositionByIdMock = vi.fn();

vi.mock('./listCompanies.mjs', () => ({
  listCompanies: listCompaniesMock,
}));

vi.mock('./getCompanyById.mjs', () => ({
  getCompanyById: getCompanyByIdMock,
}));

vi.mock('./listPositions.mjs', () => ({
  listPositions: listPositionsMock,
}));

vi.mock('./getPositionById.mjs', () => ({
  getPositionById: getPositionByIdMock,
}));

const { handler } = await import('./index.mjs');

describe('router (index.mjs handler)', () => {
  beforeEach(() => {
    listCompaniesMock.mockReset();
    getCompanyByIdMock.mockReset();
    listPositionsMock.mockReset();
    getPositionByIdMock.mockReset();
  });

  it('returns 404 for an unknown routeKey', async () => {
    const result = await handler({ routeKey: 'DELETE /companies' });

    expect(result.statusCode).toBe(404);
    expect(listCompaniesMock).not.toHaveBeenCalled();
    expect(getCompanyByIdMock).not.toHaveBeenCalled();
    expect(listPositionsMock).not.toHaveBeenCalled();
    expect(getPositionByIdMock).not.toHaveBeenCalled();
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

  it('dispatches GET /companies to listCompanies', async () => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '[]' };
    listCompaniesMock.mockResolvedValue(handlerResponse);

    const event = { routeKey: 'GET /companies' };
    const result = await handler(event);

    expect(listCompaniesMock).toHaveBeenCalledWith(event);
    expect(result).toBe(handlerResponse);
  });

  it('dispatches GET /positions to listPositions', async () => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '[]' };
    listPositionsMock.mockResolvedValue(handlerResponse);

    const event = { routeKey: 'GET /positions' };
    const result = await handler(event);

    expect(listPositionsMock).toHaveBeenCalledWith(event);
    expect(result).toBe(handlerResponse);
  });

  it('dispatches GET /positions/{positionId} to getPositionById', async () => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '{}' };
    getPositionByIdMock.mockResolvedValue(handlerResponse);

    const event = { routeKey: 'GET /positions/{positionId}', pathParameters: { positionId: 'POS001' } };
    const result = await handler(event);

    expect(getPositionByIdMock).toHaveBeenCalledWith(event);
    expect(result).toBe(handlerResponse);
  });
});
