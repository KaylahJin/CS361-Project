import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
const getAuthenticatedUserMock = vi.fn();
const presignUploadMock = vi.fn();

vi.mock('./db.mjs', () => ({ getPool: () => ({ query: queryMock }) }));
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));
vi.mock('./s3.mjs', () => ({ presignUpload: presignUploadMock }));

const { requestAttachmentUpload } = await import('./requestAttachmentUpload.mjs');

const STUDENT = { sub: 'sub-1', role: 'STUDENT', studentId: 'S001' };

const planIn = (status, extra = {}) => ({
  plan_id: 7,
  student_id: 'S001',
  period_id: 'P2568-1',
  status,
  ...extra,
});

const VALID_BODY = {
  fileName: 'transcript.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1000,
};

const NO_BODY = Symbol('no body');

const post = (body = VALID_BODY, planId = '7') => ({
  routeKey: 'POST /coop-plans/{planId}/attachments/upload-url',
  pathParameters: { planId },
  body:
    body === NO_BODY
      ? undefined
      : typeof body === 'string'
        ? body
        : JSON.stringify(body),
});

const bodyOf = (r) => JSON.parse(r.body);

beforeEach(() => {
  queryMock.mockReset();
  getAuthenticatedUserMock.mockReset();
  presignUploadMock.mockReset();
  getAuthenticatedUserMock.mockResolvedValue({ user: STUDENT, denied: null });
  presignUploadMock.mockResolvedValue({
    url: 'https://bucket.s3.amazonaws.com/',
    fields: { key: 'k', 'Content-Type': 'application/pdf' },
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('requestAttachmentUpload: success', () => {
  it.each(['PREPARING', 'RETURNED'])('owner gets a presigned POST for a %s plan', async (status) => {
    queryMock.mockResolvedValueOnce({ rows: [planIn(status)] });

    const result = await requestAttachmentUpload(post());

    expect(result.statusCode).toBe(200);
    const body = bodyOf(result);
    expect(body.url).toContain('s3.amazonaws.com');
    expect(body.maxBytes).toBe(5 * 1024 * 1024);
    expect(body.key).toMatch(/^plans\/7\/[0-9a-f-]{36}\.pdf$/);
  });

  it('asks S3 to enforce the 5 MB limit and the PDF type', async () => {
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });

    await requestAttachmentUpload(post());

    expect(presignUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'application/pdf',
        maxBytes: 5 * 1024 * 1024,
      }),
    );
  });

  it('builds the key from the plan id and a random id, never from the file name', async () => {
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });

    const result = await requestAttachmentUpload(
      post({ ...VALID_BODY, fileName: '../../other/evil.pdf' }),
    );

    expect(result.statusCode).toBe(200);
    const { key } = bodyOf(result);
    expect(key).not.toContain('evil');
    expect(key).not.toContain('..');
  });

  it('writes nothing to the database', async () => {
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });

    await requestAttachmentUpload(post());

    expect(queryMock).toHaveBeenCalledTimes(1); // the plan SELECT only
  });

  it('accepts a file of exactly 5 MB', async () => {
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });

    const result = await requestAttachmentUpload(post({ ...VALID_BODY, sizeBytes: 5 * 1024 * 1024 }));

    expect(result.statusCode).toBe(200);
  });
});

describe('requestAttachmentUpload: status (AC: locked after submit)', () => {
  // ENDORSED / ELIGIBLE / SELECTED are the V3 targets in proposal #125. They are
  // not valid statuses in the database yet, and that is the point: the
  // allow-list refuses every status it does not recognise.
  it.each(['SUBMITTED', 'ENDORSED', 'ELIGIBLE', 'APPROVED', 'REJECTED', 'SELECTED', 'NOT_SELECTED', 'NOT_ELIGIBLE'])(
    '409 PLAN_NOT_EDITABLE for a %s plan, and no URL is issued',
    async (status) => {
      queryMock.mockResolvedValueOnce({ rows: [planIn(status)] });

      const result = await requestAttachmentUpload(post());

      expect(result.statusCode).toBe(409);
      expect(bodyOf(result).code).toBe('PLAN_NOT_EDITABLE');
      expect(presignUploadMock).not.toHaveBeenCalled();
    },
  );
});

describe('requestAttachmentUpload: ownership and identity', () => {
  it('401 when there is no identity, without touching the DB', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: null, denied: { status: 401, error: 'Unauthorized' } });

    const result = await requestAttachmentUpload(post());

    expect(result.statusCode).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('403 for a student who does not own the plan, and no URL is issued', async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      user: { sub: 'sub-9', role: 'STUDENT', studentId: 'S999' },
      denied: null,
    });
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });

    const result = await requestAttachmentUpload(post());

    expect(result.statusCode).toBe(403);
    expect(presignUploadMock).not.toHaveBeenCalled();
  });

  it('a non-owner learns nothing about status: someone else\'s SUBMITTED plan is 403, not 409', async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      user: { sub: 'sub-9', role: 'STUDENT', studentId: 'S999' },
      denied: null,
    });
    queryMock.mockResolvedValueOnce({ rows: [planIn('SUBMITTED')] });

    const result = await requestAttachmentUpload(post());

    expect(result.statusCode).toBe(403);
  });

  it.each([
    ['ADVISOR', { sub: 'a', role: 'ADVISOR', studentId: null }],
    ['STAFF', { sub: 's', role: 'STAFF', studentId: null }],
    ['ADMIN', { sub: 'ad', role: 'ADMIN', studentId: null }],
  ])('%s: 403, only the owning student attaches files', async (_n, user) => {
    getAuthenticatedUserMock.mockResolvedValue({ user, denied: null });
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });

    const result = await requestAttachmentUpload(post());

    expect(result.statusCode).toBe(403);
    expect(presignUploadMock).not.toHaveBeenCalled();
  });

  it('404 when the plan does not exist', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const result = await requestAttachmentUpload(post(VALID_BODY, '999'));

    expect(result.statusCode).toBe(404);
  });

  it.each(['abc', '0', '-1', '1.5', ''])('400 for planId %j before identity is resolved', async (planId) => {
    const result = await requestAttachmentUpload(post(VALID_BODY, planId));

    expect(result.statusCode).toBe(400);
    expect(getAuthenticatedUserMock).not.toHaveBeenCalled();
  });
});

describe('requestAttachmentUpload: file validation (AC: wrong type / too big)', () => {
  beforeEach(() => {
    queryMock.mockResolvedValue({ rows: [planIn('PREPARING')] });
  });

  it.each([
    ['not application/pdf', { contentType: 'image/png' }],
    ['a .png name', { fileName: 'scan.png' }],
    ['no extension', { fileName: 'transcript' }],
    ['an exe', { fileName: 'virus.exe', contentType: 'application/x-msdownload' }],
  ])('400 ATTACHMENT_INVALID_TYPE for %s', async (_n, patch) => {
    const result = await requestAttachmentUpload(post({ ...VALID_BODY, ...patch }));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('ATTACHMENT_INVALID_TYPE');
    expect(presignUploadMock).not.toHaveBeenCalled();
  });

  it('400 ATTACHMENT_TOO_LARGE for 5 MB + 1 byte', async () => {
    const result = await requestAttachmentUpload(post({ ...VALID_BODY, sizeBytes: 5 * 1024 * 1024 + 1 }));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('ATTACHMENT_TOO_LARGE');
    expect(presignUploadMock).not.toHaveBeenCalled();
  });

  it.each([0, -5, 1.5, '1000', null])('400 INVALID_FIELD for sizeBytes %j', async (sizeBytes) => {
    const result = await requestAttachmentUpload(post({ ...VALID_BODY, sizeBytes }));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('INVALID_FIELD');
  });

  it.each(['plan_id', 'planId', 'key', 'studentId', 's3_key'])(
    '400 UNKNOWN_FIELD when the body names %s: the client never chooses the key or owner',
    async (field) => {
      const result = await requestAttachmentUpload(post({ ...VALID_BODY, [field]: 'x' }));

      expect(result.statusCode).toBe(400);
      expect(bodyOf(result).code).toBe('UNKNOWN_FIELD');
    },
  );

  it.each([
    ['no body', NO_BODY],
    ['malformed JSON', '{fileName:'],
    ['a JSON array', '[]'],
  ])('400 INVALID_BODY for %s', async (_n, body) => {
    const result = await requestAttachmentUpload(post(body));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('INVALID_BODY');
  });
});

describe('requestAttachmentUpload: failures', () => {
  it('500 with a generic body when S3 signing fails, and nothing leaks', async () => {
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });
    presignUploadMock.mockRejectedValue(new Error('ATTACHMENTS_BUCKET is not set: secret-host'));

    const result = await requestAttachmentUpload(post());

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('secret-host');
  });

  it('500 when loading the plan throws', async () => {
    queryMock.mockRejectedValueOnce(new Error('connection refused: secret-host'));

    const result = await requestAttachmentUpload(post());

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('secret-host');
  });
});