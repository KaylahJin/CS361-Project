import { describe, it, expect, vi, beforeEach } from 'vitest';

const listCompaniesMock = vi.fn();
const getCompanyByIdMock = vi.fn();
const listPositionsMock = vi.fn();
const getPositionByIdMock = vi.fn();
const listStudentsMock = vi.fn();
const getStudentByIdMock = vi.fn();
const listCoopPlansMock = vi.fn();
const getCoopPlanByIdMock = vi.fn();

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

vi.mock('./listStudents.mjs', () => ({
  listStudents: listStudentsMock,
}));

vi.mock('./getStudentById.mjs', () => ({
  getStudentById: getStudentByIdMock,
}));

vi.mock('./listCoopPlans.mjs', () => ({
  listCoopPlans: listCoopPlansMock,
}));

vi.mock('./getCoopPlanById.mjs', () => ({
  getCoopPlanById: getCoopPlanByIdMock,
}));

const { handler } = await import('./index.mjs');

describe('router (index.mjs handler)', () => {
  beforeEach(() => {
    listCompaniesMock.mockReset();
    getCompanyByIdMock.mockReset();
    listPositionsMock.mockReset();
    getPositionByIdMock.mockReset();
    listStudentsMock.mockReset();
    getStudentByIdMock.mockReset();
    listCoopPlansMock.mockReset();
    getCoopPlanByIdMock.mockReset();
  });

  it('returns 404 for an unknown routeKey', async () => {
    const result = await handler({ routeKey: 'DELETE /companies' });

    expect(result.statusCode).toBe(404);
    expect(listCompaniesMock).not.toHaveBeenCalled();
    expect(getCompanyByIdMock).not.toHaveBeenCalled();
    expect(listPositionsMock).not.toHaveBeenCalled();
    expect(getPositionByIdMock).not.toHaveBeenCalled();
    expect(listStudentsMock).not.toHaveBeenCalled();
    expect(getStudentByIdMock).not.toHaveBeenCalled();
    expect(listCoopPlansMock).not.toHaveBeenCalled();
    expect(getCoopPlanByIdMock).not.toHaveBeenCalled();
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

  it('dispatches GET /students to listStudents', async () => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '[]' };
    listStudentsMock.mockResolvedValue(handlerResponse);

    const event = { routeKey: 'GET /students' };
    const result = await handler(event);

    expect(listStudentsMock).toHaveBeenCalledWith(event);
    expect(result).toBe(handlerResponse);
  });

  it('dispatches GET /students/{studentId} to getStudentById', async () => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '{}' };
    getStudentByIdMock.mockResolvedValue(handlerResponse);

    const event = { routeKey: 'GET /students/{studentId}', pathParameters: { studentId: '6100000001' } };
    const result = await handler(event);

    expect(getStudentByIdMock).toHaveBeenCalledWith(event);
    expect(result).toBe(handlerResponse);
  });

  it('dispatches GET /coop-plans to listCoopPlans', async () => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '[]' };
    listCoopPlansMock.mockResolvedValue(handlerResponse);

    const event = { routeKey: 'GET /coop-plans' };
    const result = await handler(event);

    expect(listCoopPlansMock).toHaveBeenCalledWith(event);
    expect(result).toBe(handlerResponse);
  });

  it('dispatches GET /coop-plans/{planId} to getCoopPlanById', async () => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '{}' };
    getCoopPlanByIdMock.mockResolvedValue(handlerResponse);

    const event = { routeKey: 'GET /coop-plans/{planId}', pathParameters: { planId: '101' } };
    const result = await handler(event);

    expect(getCoopPlanByIdMock).toHaveBeenCalledWith(event);
    expect(result).toBe(handlerResponse);
  });
});