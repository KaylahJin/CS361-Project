import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeDb, attachmentRow, OWNER, OTHER_STUDENT, KEY, KEY_2 } from './attachmentTestDb.mjs';

const getAuthenticatedUserMock = vi.fn();
const headObjectMock = vi.fn();
let db;

vi.mock('./db.mjs', () => ({ getPool: () => db.pool }));
// Identity and S3 are mocked; authorize.mjs, attachmentGuard.mjs and the
// attachment rules are the real ones.
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));
vi.mock('./s3.mjs', () => ({ headObject: headObjectMock }));

const { confirmAttachment } = await import('./confirmAttachment.mjs');

const VALID_BODY = { key: KEY, fileName: 'transcript.pdf' };
const NO_BODY = Symbol('no body');

const post = (body = VALID_BODY, planId = '7') => ({
  routeKey: 'POST /coop-plans/{planId}/attachments',
  pathParameters: { planId },
  body: body === NO_BODY ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
});

const bodyOf = (r) => JSON.parse(r.body);

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  headObjectMock.mockReset();
  getAuthenticatedUserMock.mockResolvedValue({ user: OWNER, denied: null });
  headObjectMock.mockResolvedValue({ sizeBytes: 2048, contentType: 'application/pdf' });
  db = makeDb();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('confirmAttachment: success', () => {
  it.each(['PREPARING', 'RETURNED'])('201 and a row is recorded for a %s plan', async (status) => {
    db = makeDb({ plan: { plan_id: 7, student_id: 'S001', status } });

    const result = await confirmAttachment(post());

    expect(result.statusCode).toBe(201);
    expect(bodyOf(result)).toMatchObject({
      planId: 7,
      fileName: 'transcript.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
    });
    expect(db.attachments).toHaveLength(1);
    expect(db.events).toEqual(['BEGIN', 'COMMIT']);
    expect(db.released).toBe(1);
  });

  it('records the size S3 reports and the uploader from the token, not from the request', async () => {
    headObjectMock.mockResolvedValue({ sizeBytes: 777, contentType: 'application/pdf' });

    await confirmAttachment(post({ ...VALID_BODY }));

    expect(db.attachments[0]).toMatchObject({ size_bytes: 777, uploaded_by: 'sub-1', s3_key: KEY });
  });

  it('never returns the S3 key', async () => {
    const result = await confirmAttachment(post());

    expect(bodyOf(result)).not.toHaveProperty('s3_key');
    expect(bodyOf(result)).not.toHaveProperty('s3Key');
    expect(result.body).not.toContain('plans/7/');
  });

  it('is safe to repeat: the same key answers 200 with the same row and adds nothing', async () => {
    const first = await confirmAttachment(post());
    const again = await confirmAttachment(post());

    expect(first.statusCode).toBe(201);
    expect(again.statusCode).toBe(200);
    expect(bodyOf(again).attachmentId).toBe(bodyOf(first).attachmentId);
    expect(db.attachments).toHaveLength(1);
  });

  it('cleans the file name before storing it', async () => {
    await confirmAttachment(post({ key: KEY, fileName: '  a\u0000/b.pdf ' }));

    expect(db.attachments[0].file_name).toBe('a_b.pdf');
  });
});

describe('confirmAttachment: status (AC: locked after submit)', () => {
  it.each(['SUBMITTED', 'ENDORSED', 'ELIGIBLE', 'APPROVED', 'REJECTED', 'SELECTED', 'NOT_ELIGIBLE'])(
    '409 PLAN_NOT_EDITABLE for a %s plan; S3 is not asked and nothing is written',
    async (status) => {
      db = makeDb({ plan: { plan_id: 7, student_id: 'S001', status } });

      const result = await confirmAttachment(post());

      expect(result.statusCode).toBe(409);
      expect(bodyOf(result).code).toBe('PLAN_NOT_EDITABLE');
      expect(headObjectMock).not.toHaveBeenCalled();
      expect(db.wrote()).toBe(false);
      expect(db.attachments).toHaveLength(0);
      expect(db.events).toEqual(['BEGIN', 'ROLLBACK']);
      expect(db.released).toBe(1);
    },
  );

  it('the status is read under a row lock (FOR UPDATE), not before the transaction', async () => {
    await confirmAttachment(post());

    const lock = db.queries.find((q) => /FOR UPDATE/.test(q.sql));
    expect(lock).toBeDefined();
    expect(db.queries.indexOf(lock)).toBeGreaterThan(
      db.queries.findIndex((q) => q.sql === 'BEGIN'),
    );
  });

  it('a plan submitted while confirm waits for the lock is refused, and nothing is written', async () => {
    // The request passed "ask for a URL" while PREPARING; by the time this
    // transaction gets the lock another request has submitted the plan.
    db.beforeLockAnswers = async (state) => {
      state.plan.status = 'SUBMITTED';
    };

    const result = await confirmAttachment(post());

    expect(result.statusCode).toBe(409);
    expect(bodyOf(result).code).toBe('PLAN_NOT_EDITABLE');
    expect(db.attachments).toHaveLength(0);
  });
});

describe('confirmAttachment: ownership and identity', () => {
  it('401 when there is no identity, without touching the DB', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: null, denied: { status: 401, error: 'Unauthorized' } });

    const result = await confirmAttachment(post());

    expect(result.statusCode).toBe(401);
    expect(db.queries).toHaveLength(0);
  });

  it('403 for an account with no access', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: null, denied: { status: 403, error: 'Forbidden' } });

    expect((await confirmAttachment(post())).statusCode).toBe(403);
  });

  it('403 for a student who does not own the plan; nothing is written', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: OTHER_STUDENT, denied: null });

    const result = await confirmAttachment(post());

    expect(result.statusCode).toBe(403);
    expect(headObjectMock).not.toHaveBeenCalled();
    expect(db.wrote()).toBe(false);
  });

  it.each(['ADVISOR', 'STAFF', 'ADMIN'])('403 for role %s', async (role) => {
    getAuthenticatedUserMock.mockResolvedValue({ user: { sub: 'x', role, studentId: null }, denied: null });

    const result = await confirmAttachment(post());

    expect(result.statusCode).toBe(403);
    expect(db.wrote()).toBe(false);
  });

  it('403 comes before 409: a non-owner never learns the plan status', async () => {
    db = makeDb({ plan: { plan_id: 7, student_id: 'S001', status: 'SUBMITTED' } });
    getAuthenticatedUserMock.mockResolvedValue({ user: OTHER_STUDENT, denied: null });

    expect((await confirmAttachment(post())).statusCode).toBe(403);
  });

  it('404 for a plan that does not exist', async () => {
    db = makeDb({ plan: null });

    const result = await confirmAttachment(post());

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result).code).toBe('PLAN_NOT_FOUND');
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999', ''])('400 for planId %j, without touching the DB', async (planId) => {
    const result = await confirmAttachment(post(VALID_BODY, planId));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('INVALID_PLAN_ID');
    expect(db.queries).toHaveLength(0);
  });
});

describe('confirmAttachment: request body', () => {
  it.each([
    ['no body', NO_BODY],
    ['not JSON', '{nope'],
    ['an array', '[]'],
  ])('400 INVALID_BODY for %s', async (_name, body) => {
    const result = await confirmAttachment(post(body));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('INVALID_BODY');
    expect(db.wrote()).toBe(false);
  });

  it('400 UNKNOWN_FIELD for a field that is not accepted (the client cannot send a size)', async () => {
    const result = await confirmAttachment(post({ ...VALID_BODY, sizeBytes: 1 }));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('UNKNOWN_FIELD');
  });

  it('400 INVALID_FIELD when key is missing', async () => {
    const result = await confirmAttachment(post({ fileName: 'a.pdf' }));

    expect(bodyOf(result).code).toBe('INVALID_FIELD');
  });

  it.each([
    ['a key of another plan', 'plans/8/123e4567-e89b-42d3-a456-426614174000.pdf'],
    ['a key with leading zeros', 'plans/007/123e4567-e89b-42d3-a456-426614174000.pdf'],
    ['a path trick', 'plans/7/../8/123e4567-e89b-42d3-a456-426614174000.pdf'],
    ['a key not made by this server', 'plans/7/evil.pdf'],
    ['an unrelated object', 'secrets/passwords.txt'],
    ['a non-string', 42],
  ])('400 INVALID_ATTACHMENT_KEY for %s, and S3 is not asked', async (_name, key) => {
    const result = await confirmAttachment(post({ key, fileName: 'a.pdf' }));

    expect(result.statusCode).toBe(400);
    expect(['INVALID_ATTACHMENT_KEY', 'INVALID_FIELD']).toContain(bodyOf(result).code);
    expect(headObjectMock).not.toHaveBeenCalled();
    expect(db.wrote()).toBe(false);
  });

  it('400 ATTACHMENT_INVALID_TYPE for a file name that is not .pdf', async () => {
    const result = await confirmAttachment(post({ key: KEY, fileName: 'resume.docx' }));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('ATTACHMENT_INVALID_TYPE');
  });
});

describe('confirmAttachment: limit of files per plan', () => {
  it('409 ATTACHMENT_LIMIT_REACHED when the plan already has a file; nothing is written', async () => {
    db = makeDb({ attachments: [attachmentRow()] });

    const result = await confirmAttachment(post({ key: KEY_2, fileName: 'other.pdf' }));

    expect(result.statusCode).toBe(409);
    expect(bodyOf(result).code).toBe('ATTACHMENT_LIMIT_REACHED');
    expect(headObjectMock).not.toHaveBeenCalled();
    expect(db.attachments).toHaveLength(1);
  });

  it('a file on another plan does not count towards this plan', async () => {
    db = makeDb({ attachments: [attachmentRow({ plan_id: 8, s3_key: 'plans/8/x.pdf' })] });

    expect((await confirmAttachment(post())).statusCode).toBe(201);
  });
});

describe('confirmAttachment: what S3 says', () => {
  it('400 ATTACHMENT_NOT_UPLOADED when S3 has no such object; nothing is written', async () => {
    headObjectMock.mockResolvedValue(null);

    const result = await confirmAttachment(post());

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('ATTACHMENT_NOT_UPLOADED');
    expect(db.wrote()).toBe(false);
  });

  it('400 ATTACHMENT_INVALID_TYPE when the stored object is not a PDF', async () => {
    headObjectMock.mockResolvedValue({ sizeBytes: 100, contentType: 'image/png' });

    const result = await confirmAttachment(post());

    expect(bodyOf(result).code).toBe('ATTACHMENT_INVALID_TYPE');
    expect(db.wrote()).toBe(false);
  });

  it('400 ATTACHMENT_TOO_LARGE when the stored object is over 5 MB', async () => {
    headObjectMock.mockResolvedValue({ sizeBytes: 5 * 1024 * 1024 + 1, contentType: 'application/pdf' });

    const result = await confirmAttachment(post());

    expect(bodyOf(result).code).toBe('ATTACHMENT_TOO_LARGE');
    expect(db.wrote()).toBe(false);
  });

  it('accepts an object of exactly 5 MB', async () => {
    headObjectMock.mockResolvedValue({ sizeBytes: 5 * 1024 * 1024, contentType: 'application/pdf' });

    expect((await confirmAttachment(post())).statusCode).toBe(201);
  });

  it('500 when S3 itself fails, never "not uploaded"; rolled back and connection released', async () => {
    headObjectMock.mockRejectedValue(new Error('AccessDenied'));

    const result = await confirmAttachment(post());

    expect(result.statusCode).toBe(500);
    expect(bodyOf(result).code).toBe('INTERNAL_ERROR');
    expect(result.body).not.toContain('AccessDenied');
    expect(db.events).toEqual(['BEGIN', 'ROLLBACK']);
    expect(db.released).toBe(1);
  });
});

describe('confirmAttachment: server faults', () => {
  it('500 without leaking the error when the INSERT fails', async () => {
    db.failOn = /^INSERT/;

    const result = await confirmAttachment(post());

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('boom');
    expect(db.released).toBe(1);
  });

  it('500 when no connection can be had', async () => {
    db.pool.connect = async () => {
      throw new Error('pool exhausted');
    };

    const result = await confirmAttachment(post());

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('exhausted');
  });
});
