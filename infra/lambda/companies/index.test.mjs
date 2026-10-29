import { describe, it, expect, vi, beforeEach } from 'vitest';

const listCompaniesMock = vi.fn();
const getCompanyByIdMock = vi.fn();
const listPositionsMock = vi.fn();
const getPositionByIdMock = vi.fn();
const listStudentsMock = vi.fn();
const getStudentByIdMock = vi.fn();
const listCoopPlansMock = vi.fn();
const getCoopPlanByIdMock = vi.fn();
const createCoopPlanMock = vi.fn();
const updateCoopPlanMock = vi.fn();
const submitCoopPlanMock = vi.fn();
const requestAttachmentUploadMock = vi.fn();
const confirmAttachmentMock = vi.fn();
const deleteAttachmentMock = vi.fn();
const listAttachmentsMock = vi.fn();
const downloadAttachmentUrlMock = vi.fn();

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

vi.mock('./createCoopPlan.mjs', () => ({
  createCoopPlan: createCoopPlanMock,
}));

vi.mock('./updateCoopPlan.mjs', () => ({
  updateCoopPlan: updateCoopPlanMock,
}));

vi.mock('./submitCoopPlan.mjs', () => ({
  submitCoopPlan: submitCoopPlanMock,
}));

const endorseCoopPlanMock = vi.fn();
vi.mock('./endorseCoopPlan.mjs', () => ({
  endorseCoopPlan: endorseCoopPlanMock,
}));

vi.mock('./requestAttachmentUpload.mjs', () => ({
  requestAttachmentUpload: requestAttachmentUploadMock,
}));

vi.mock('./confirmAttachment.mjs', () => ({
  confirmAttachment: confirmAttachmentMock,
}));

vi.mock('./deleteAttachment.mjs', () => ({
  deleteAttachment: deleteAttachmentMock,
}));

vi.mock('./listAttachments.mjs', () => ({
  listAttachments: listAttachmentsMock,
}));

vi.mock('./downloadAttachmentUrl.mjs', () => ({
  downloadAttachmentUrl: downloadAttachmentUrlMock,
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
    createCoopPlanMock.mockReset();
    updateCoopPlanMock.mockReset();
    submitCoopPlanMock.mockReset();
    requestAttachmentUploadMock.mockReset();
    confirmAttachmentMock.mockReset();
    deleteAttachmentMock.mockReset();
    listAttachmentsMock.mockReset();
    downloadAttachmentUrlMock.mockReset();
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
    expect(createCoopPlanMock).not.toHaveBeenCalled();
    expect(updateCoopPlanMock).not.toHaveBeenCalled();
    expect(submitCoopPlanMock).not.toHaveBeenCalled();
    expect(requestAttachmentUploadMock).not.toHaveBeenCalled();
    expect(confirmAttachmentMock).not.toHaveBeenCalled();
    expect(deleteAttachmentMock).not.toHaveBeenCalled();
    expect(listAttachmentsMock).not.toHaveBeenCalled();
    expect(downloadAttachmentUrlMock).not.toHaveBeenCalled();
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

  it('dispatches POST /coop-plans to createCoopPlan', async () => {
    const handlerResponse = { statusCode: 201, headers: {}, body: '{}' };
    createCoopPlanMock.mockResolvedValue(handlerResponse);

    const event = { routeKey: 'POST /coop-plans', body: '{"periodId":"P2568-1"}' };
    const result = await handler(event);

    expect(createCoopPlanMock).toHaveBeenCalledWith(event);
    expect(updateCoopPlanMock).not.toHaveBeenCalled();
    expect(result).toBe(handlerResponse);
  });

  it('dispatches PATCH /coop-plans/{planId} to updateCoopPlan', async () => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '{}' };
    updateCoopPlanMock.mockResolvedValue(handlerResponse);

    const event = {
      routeKey: 'PATCH /coop-plans/{planId}',
      pathParameters: { planId: '101' },
      body: '{"studentNote":"x"}',
    };
    const result = await handler(event);

    expect(updateCoopPlanMock).toHaveBeenCalledWith(event);
    expect(createCoopPlanMock).not.toHaveBeenCalled();
    expect(result).toBe(handlerResponse);
  });

  it('dispatches POST /coop-plans/{planId}/endorse to endorseCoopPlan', async () => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '{}' };
    endorseCoopPlanMock.mockResolvedValue(handlerResponse);

    const event = { routeKey: 'POST /coop-plans/{planId}/endorse', pathParameters: { planId: '101' } };

    expect(await handler(event)).toBe(handlerResponse);
    expect(endorseCoopPlanMock).toHaveBeenCalledWith(event);
  });

  it('dispatches POST /coop-plans/{planId}/submit to submitCoopPlan', async () => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '{}' };
    submitCoopPlanMock.mockResolvedValue(handlerResponse);

    const event = { routeKey: 'POST /coop-plans/{planId}/submit', pathParameters: { planId: '101' } };
    const result = await handler(event);

    expect(submitCoopPlanMock).toHaveBeenCalledWith(event);
    expect(createCoopPlanMock).not.toHaveBeenCalled();
    expect(updateCoopPlanMock).not.toHaveBeenCalled();
    expect(result).toBe(handlerResponse);
  });

  it('dispatches POST /coop-plans/{planId}/attachments/upload-url to requestAttachmentUpload', async () => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '{}' };
    requestAttachmentUploadMock.mockResolvedValue(handlerResponse);

    const event = {
      routeKey: 'POST /coop-plans/{planId}/attachments/upload-url',
      pathParameters: { planId: '101' },
      body: '{}',
    };
    const result = await handler(event);

    expect(requestAttachmentUploadMock).toHaveBeenCalledWith(event);
    expect(submitCoopPlanMock).not.toHaveBeenCalled();
    expect(result).toBe(handlerResponse);
  });

  it.each([
    ['POST /coop-plans/{planId}/attachments', confirmAttachmentMock],
    ['GET /coop-plans/{planId}/attachments', listAttachmentsMock],
    ['GET /coop-plans/{planId}/attachments/{attachmentId}/download-url', downloadAttachmentUrlMock],
    ['DELETE /coop-plans/{planId}/attachments/{attachmentId}', deleteAttachmentMock],
  ])('dispatches %s to its own handler and no other', async (routeKey, expected) => {
    const handlerResponse = { statusCode: 200, headers: {}, body: '{}' };
    expected.mockResolvedValue(handlerResponse);
    const all = [
      confirmAttachmentMock,
      listAttachmentsMock,
      downloadAttachmentUrlMock,
      deleteAttachmentMock,
      requestAttachmentUploadMock,
    ];

    const event = { routeKey, pathParameters: { planId: '101', attachmentId: '5' } };
    const result = await handler(event);

    expect(expected).toHaveBeenCalledWith(event);
    for (const other of all.filter((m) => m !== expected)) {
      expect(other).not.toHaveBeenCalled();
    }
    expect(result).toBe(handlerResponse);
  });

  it('does not route attachment methods that have no handler', async () => {
    for (const routeKey of [
      'PUT /coop-plans/{planId}/attachments/{attachmentId}',
      'PATCH /coop-plans/{planId}/attachments/{attachmentId}',
      'GET /coop-plans/{planId}/attachments/{attachmentId}',
      'DELETE /coop-plans/{planId}/attachments',
    ]) {
      expect((await handler({ routeKey })).statusCode).toBe(404);
    }
    expect(deleteAttachmentMock).not.toHaveBeenCalled();
    expect(confirmAttachmentMock).not.toHaveBeenCalled();
  });

  it('does not route methods that have no handler (PUT / DELETE on a plan)', async () => {
    for (const routeKey of ['PUT /coop-plans/{planId}', 'DELETE /coop-plans/{planId}', 'PATCH /coop-plans', 'GET /coop-plans/{planId}/submit', 'PATCH /coop-plans/{planId}/submit']) {
      const result = await handler({ routeKey });
      expect(result.statusCode).toBe(404);
    }
    expect(createCoopPlanMock).not.toHaveBeenCalled();
    expect(updateCoopPlanMock).not.toHaveBeenCalled();
  });
});
