import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeDb, attachmentRow, OWNER, OTHER_STUDENT, KEY } from './attachmentTestDb.mjs';

const getAuthenticatedUserMock = vi.fn();
const presignDownloadMock = vi.fn();
let db;

vi.mock('./db.mjs', () => ({ getPool: () => db.pool }));
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));
vi.mock('./s3.mjs', () => ({ presignDownload: presignDownloadMock }));

const { downloadAttachmentUrl } = await import('./downloadAttachmentUrl.mjs');

const get = (planId = '7', attachmentId = '1') => ({
  routeKey: 'GET /coop-plans/{planId}/attachments/{attachmentId}/download-url',
  pathParameters: { planId, attachmentId },
});

const bodyOf = (r) => JSON.parse(r.body);

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  presignDownloadMock.mockReset();
  getAuthenticatedUserMock.mockResolvedValue({ user: OWNER, denied: null });
  presignDownloadMock.mockResolvedValue('https://bucket.s3.amazonaws.com/signed');
  db = makeDb({ attachments: [attachmentRow({ file_name: 'ใบรับรอง.pdf' })] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('downloadAttachmentUrl', () => {
  it('200 with a short-lived link and the original file name', async () => {
    const result = await downloadAttachmentUrl(get());

    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toEqual({
      url: 'https://bucket.s3.amazonaws.com/signed',
      fileName: 'ใบรับรอง.pdf',
      expiresInSeconds: 300,
    });
  });

  it('signs the stored key for the stored name, and the key is not in the answer', async () => {
    const result = await downloadAttachmentUrl(get());

    expect(presignDownloadMock).toHaveBeenCalledWith({ key: KEY, fileName: 'ใบรับรอง.pdf', expiresIn: 300 });
    expect(result.body).not.toContain('plans/7/');
  });

  it('still works once the plan is submitted: viewing is not editing', async () => {
    db = makeDb({ plan: { plan_id: 7, student_id: 'S001', status: 'SUBMITTED' }, attachments: [attachmentRow()] });

    expect((await downloadAttachmentUrl(get())).statusCode).toBe(200);
  });

  it('200 for staff, and for an assigned advisor', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: { sub: 's', role: 'STAFF', studentId: null }, denied: null });
    expect((await downloadAttachmentUrl(get())).statusCode).toBe(200);

    getAuthenticatedUserMock.mockResolvedValue({ user: { sub: 'adv', role: 'ADVISOR', studentId: null }, denied: null });
    db = makeDb({ attachments: [attachmentRow()], assigned: true });
    expect((await downloadAttachmentUrl(get())).statusCode).toBe(200);
  });
});

describe('downloadAttachmentUrl: refusals, and no link is ever signed', () => {
  it('403 for a student who does not own the plan', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: OTHER_STUDENT, denied: null });

    const result = await downloadAttachmentUrl(get());

    expect(result.statusCode).toBe(403);
    expect(presignDownloadMock).not.toHaveBeenCalled();
  });

  it('403 for an advisor who is not assigned', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: { sub: 'adv', role: 'ADVISOR', studentId: null }, denied: null });

    expect((await downloadAttachmentUrl(get())).statusCode).toBe(403);
    expect(presignDownloadMock).not.toHaveBeenCalled();
  });

  it("404 for another plan's file, even though the caller owns the plan in the URL", async () => {
    db = makeDb({ attachments: [attachmentRow({ attachment_id: 5, plan_id: 8, s3_key: 'plans/8/x.pdf' })] });

    const result = await downloadAttachmentUrl(get('7', '5'));

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result).code).toBe('ATTACHMENT_NOT_FOUND');
    expect(presignDownloadMock).not.toHaveBeenCalled();
  });

  it('the lookup itself is scoped to the plan: attachment_id AND plan_id, in that parameter order', async () => {
    await downloadAttachmentUrl(get('7', '1'));

    const query = db.queries.find((q) => /FROM plan_attachments/.test(q.sql));
    expect(query.sql).toMatch(/WHERE attachment_id = \$1 AND plan_id = \$2/);
    expect(query.params).toEqual([1, 7]);
  });

  it('404 for a file that does not exist', async () => {
    expect((await downloadAttachmentUrl(get('7', '999'))).statusCode).toBe(404);
  });

  it('404 for a plan that does not exist', async () => {
    db = makeDb({ plan: null });

    expect(bodyOf(await downloadAttachmentUrl(get())).code).toBe('PLAN_NOT_FOUND');
  });

  it('401 when there is no identity, without touching the DB', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: null, denied: { status: 401, error: 'Unauthorized' } });

    const result = await downloadAttachmentUrl(get());

    expect(result.statusCode).toBe(401);
    expect(db.queries).toHaveLength(0);
  });

  it.each([['abc', '1'], ['7', 'abc'], ['0', '1'], ['7', '0'], ['7', '1.5']])(
    '400 for planId %j / attachmentId %j',
    async (planId, attachmentId) => {
      const result = await downloadAttachmentUrl(get(planId, attachmentId));

      expect(result.statusCode).toBe(400);
      expect(db.queries).toHaveLength(0);
    },
  );

  it('500 without leaking the error when signing fails', async () => {
    presignDownloadMock.mockRejectedValue(new Error('no credentials'));

    const result = await downloadAttachmentUrl(get());

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('credentials');
  });
});
