import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeDb, attachmentRow, OWNER, OTHER_STUDENT } from './attachmentTestDb.mjs';

const getAuthenticatedUserMock = vi.fn();
let db;

vi.mock('./db.mjs', () => ({ getPool: () => db.pool }));
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));

const { listAttachments } = await import('./listAttachments.mjs');

const get = (planId = '7') => ({
  routeKey: 'GET /coop-plans/{planId}/attachments',
  pathParameters: { planId },
});

const bodyOf = (r) => JSON.parse(r.body);

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  getAuthenticatedUserMock.mockResolvedValue({ user: OWNER, denied: null });
  db = makeDb({ attachments: [attachmentRow()] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('listAttachments', () => {
  it('200 with the files of the plan, the limits, and no S3 key', async () => {
    const result = await listAttachments(get());

    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toEqual({
      attachments: [
        {
          attachmentId: 1,
          planId: 7,
          fileName: 'transcript.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1000,
          createdAt: '2026-10-27T01:00:00.000Z',
        },
      ],
      maxFiles: 1,
      maxBytes: 5 * 1024 * 1024,
    });
    expect(result.body).not.toContain('plans/7/');
  });

  it('200 with an empty list for a plan with no files', async () => {
    db = makeDb();

    expect(bodyOf(await listAttachments(get())).attachments).toEqual([]);
  });

  it('only lists the files of this plan', async () => {
    db = makeDb({
      attachments: [attachmentRow(), attachmentRow({ attachment_id: 2, plan_id: 8, s3_key: 'plans/8/x.pdf' })],
    });

    expect(bodyOf(await listAttachments(get())).attachments.map((a) => a.attachmentId)).toEqual([1]);
  });

  it('is two small reads and no transaction, no lock, no S3', async () => {
    await listAttachments(get());

    expect(db.queries).toHaveLength(2);
    expect(db.events).toEqual([]);
    expect(db.queries.some((q) => /FOR UPDATE/.test(q.sql))).toBe(false);
  });

  it('still works once the plan is no longer editable: viewing is not editing', async () => {
    db = makeDb({ plan: { plan_id: 7, student_id: 'S001', status: 'SUBMITTED' }, attachments: [attachmentRow()] });

    expect((await listAttachments(get())).statusCode).toBe(200);
  });
});

describe('listAttachments: who may view', () => {
  it('403 for a student who does not own the plan', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: OTHER_STUDENT, denied: null });

    const result = await listAttachments(get());

    expect(result.statusCode).toBe(403);
    expect(result.body).not.toContain('transcript');
  });

  it('200 for staff', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: { sub: 's', role: 'STAFF', studentId: null }, denied: null });

    expect((await listAttachments(get())).statusCode).toBe(200);
  });

  it('200 for an advisor assigned to the student, 403 for one who is not', async () => {
    const advisor = { sub: 'adv-1', role: 'ADVISOR', studentId: null };
    getAuthenticatedUserMock.mockResolvedValue({ user: advisor, denied: null });

    db = makeDb({ attachments: [attachmentRow()], assigned: true });
    expect((await listAttachments(get())).statusCode).toBe(200);

    db = makeDb({ attachments: [attachmentRow()], assigned: false });
    expect((await listAttachments(get())).statusCode).toBe(403);
  });

  it('403 for ADMIN (deny by default)', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: { sub: 'a', role: 'ADMIN', studentId: null }, denied: null });

    expect((await listAttachments(get())).statusCode).toBe(403);
  });

  it('401 when there is no identity, without touching the DB', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: null, denied: { status: 401, error: 'Unauthorized' } });

    const result = await listAttachments(get());

    expect(result.statusCode).toBe(401);
    expect(db.queries).toHaveLength(0);
  });

  it('404 for a plan that does not exist', async () => {
    db = makeDb({ plan: null });

    const result = await listAttachments(get());

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result).code).toBe('PLAN_NOT_FOUND');
  });

  it.each(['abc', '0', '1.5', '99999999999'])('400 for planId %j, without touching the DB', async (id) => {
    const result = await listAttachments(get(id));

    expect(result.statusCode).toBe(400);
    expect(db.queries).toHaveLength(0);
  });

  it('500 without leaking the error when the read fails', async () => {
    db.failOn = /FROM plan_attachments/;

    const result = await listAttachments(get());

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('boom');
  });
});
