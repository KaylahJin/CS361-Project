import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeDb, attachmentRow, OWNER, OTHER_STUDENT, KEY } from './attachmentTestDb.mjs';

const getAuthenticatedUserMock = vi.fn();
const deleteObjectMock = vi.fn();
let db;

vi.mock('./db.mjs', () => ({ getPool: () => db.pool }));
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));
vi.mock('./s3.mjs', () => ({ deleteObject: deleteObjectMock }));

const { deleteAttachment } = await import('./deleteAttachment.mjs');

const del = (planId = '7', attachmentId = '1') => ({
  routeKey: 'DELETE /coop-plans/{planId}/attachments/{attachmentId}',
  pathParameters: { planId, attachmentId },
});

const bodyOf = (r) => JSON.parse(r.body);

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
  deleteObjectMock.mockReset();
  getAuthenticatedUserMock.mockResolvedValue({ user: OWNER, denied: null });
  deleteObjectMock.mockResolvedValue(undefined);
  db = makeDb({ attachments: [attachmentRow()] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('deleteAttachment: success', () => {
  it.each(['PREPARING', 'RETURNED'])('200, the row and the S3 object are removed for a %s plan', async (status) => {
    db = makeDb({ plan: { plan_id: 7, student_id: 'S001', status }, attachments: [attachmentRow()] });

    const result = await deleteAttachment(del());

    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toEqual({ deleted: true, attachmentId: 1 });
    expect(db.attachments).toHaveLength(0);
    expect(deleteObjectMock).toHaveBeenCalledWith(KEY);
    expect(db.events).toEqual(['BEGIN', 'COMMIT']);
  });

  it('the S3 object is deleted only after the transaction is committed and released', async () => {
    const order = [];
    deleteObjectMock.mockImplementation(async () => {
      order.push(`s3 (events so far: ${db.events.join(',')}, released: ${db.released})`);
    });

    await deleteAttachment(del());

    expect(order).toEqual(['s3 (events so far: BEGIN,COMMIT, released: 1)']);
  });

  it('still answers 200 when S3 fails: the row is already gone and the failure is only logged', async () => {
    deleteObjectMock.mockRejectedValue(new Error('S3 down'));

    const result = await deleteAttachment(del());

    expect(result.statusCode).toBe(200);
    expect(db.attachments).toHaveLength(0);
    expect(console.error).toHaveBeenCalled();
  });
});

describe('deleteAttachment: status (AC: locked after submit)', () => {
  it.each(['SUBMITTED', 'ENDORSED', 'ELIGIBLE', 'APPROVED', 'REJECTED', 'SELECTED', 'NOT_ELIGIBLE'])(
    '409 PLAN_NOT_EDITABLE for a %s plan; the file stays in the database and in S3',
    async (status) => {
      db = makeDb({ plan: { plan_id: 7, student_id: 'S001', status }, attachments: [attachmentRow()] });

      const result = await deleteAttachment(del());

      expect(result.statusCode).toBe(409);
      expect(bodyOf(result).code).toBe('PLAN_NOT_EDITABLE');
      expect(db.attachments).toHaveLength(1);
      expect(db.wrote()).toBe(false);
      expect(deleteObjectMock).not.toHaveBeenCalled();
      expect(db.events).toEqual(['BEGIN', 'ROLLBACK']);
    },
  );

  it('a plan submitted while delete waits for the lock keeps its file', async () => {
    db.beforeLockAnswers = async (state) => {
      state.plan.status = 'SUBMITTED';
    };

    const result = await deleteAttachment(del());

    expect(result.statusCode).toBe(409);
    expect(db.attachments).toHaveLength(1);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });
});

describe('deleteAttachment: ownership and identity', () => {
  it('401 when there is no identity, without touching the DB', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: null, denied: { status: 401, error: 'Unauthorized' } });

    const result = await deleteAttachment(del());

    expect(result.statusCode).toBe(401);
    expect(db.queries).toHaveLength(0);
  });

  it('403 for a student who does not own the plan; the file stays', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: OTHER_STUDENT, denied: null });

    const result = await deleteAttachment(del());

    expect(result.statusCode).toBe(403);
    expect(db.attachments).toHaveLength(1);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it.each(['ADVISOR', 'STAFF', 'ADMIN'])('403 for role %s: reading a plan is not editing it', async (role) => {
    getAuthenticatedUserMock.mockResolvedValue({ user: { sub: 'x', role, studentId: null }, denied: null });

    const result = await deleteAttachment(del());

    expect(result.statusCode).toBe(403);
    expect(db.attachments).toHaveLength(1);
  });

  it('404 for a plan that does not exist', async () => {
    db = makeDb({ plan: null });

    const result = await deleteAttachment(del());

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result).code).toBe('PLAN_NOT_FOUND');
  });
});

describe('deleteAttachment: which file', () => {
  it('404 ATTACHMENT_NOT_FOUND for an id that does not exist', async () => {
    const result = await deleteAttachment(del('7', '999'));

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result).code).toBe('ATTACHMENT_NOT_FOUND');
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it("404, not a delete, for a file that belongs to someone else's plan", async () => {
    // The caller owns plan 7 and is editable; attachment 5 belongs to plan 8.
    db = makeDb({ attachments: [attachmentRow({ attachment_id: 5, plan_id: 8, s3_key: 'plans/8/x.pdf' })] });

    const result = await deleteAttachment(del('7', '5'));

    expect(result.statusCode).toBe(404);
    expect(db.attachments).toHaveLength(1);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it('the DELETE itself is scoped to the plan: attachment_id AND plan_id, in that parameter order', async () => {
    // The fake database filters by its parameters, so this pins the SQL text:
    // without plan_id in the WHERE, a plan could delete another plan's file.
    await deleteAttachment(del('7', '1'));

    const query = db.queries.find((q) => /^DELETE/.test(q.sql));
    expect(query.sql).toMatch(/WHERE attachment_id = \$1 AND plan_id = \$2/);
    expect(query.params).toEqual([1, 7]);
  });

  it('deleting twice: the second answers 404 and does not touch S3 again', async () => {
    await deleteAttachment(del());
    const again = await deleteAttachment(del());

    expect(again.statusCode).toBe(404);
    expect(deleteObjectMock).toHaveBeenCalledTimes(1);
  });

  it.each(['abc', '0', '-1', '1.5', '99999999999', ' '])('400 for attachmentId %j, without touching the DB', async (id) => {
    const result = await deleteAttachment(del('7', id));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('INVALID_ATTACHMENT_ID');
    expect(db.queries).toHaveLength(0);
  });

  it.each(['abc', '0', '1.5'])('400 for planId %j, without touching the DB', async (id) => {
    const result = await deleteAttachment(del(id, '1'));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('INVALID_PLAN_ID');
    expect(db.queries).toHaveLength(0);
  });
});

describe('deleteAttachment: server faults', () => {
  it('500 without leaking the error when the DELETE fails; rolled back and released', async () => {
    db.failOn = /^DELETE/;

    const result = await deleteAttachment(del());

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('boom');
    expect(db.attachments).toHaveLength(1);
    expect(db.released).toBe(1);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });
});
