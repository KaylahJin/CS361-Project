// An in-memory stand-in for the database, shared by the attachment handler
// tests. Routed by SQL text, so a test does not depend on how many reads a
// handler makes. It is transactional on purpose: BEGIN snapshots the
// attachments, ROLLBACK throws the snapshot away, so "a refusal wrote nothing"
// is a real assertion and not a guess.

export const OWNER = { sub: 'sub-1', role: 'STUDENT', studentId: 'S001' };
export const OTHER_STUDENT = { sub: 'sub-2', role: 'STUDENT', studentId: 'S002' };

export const KEY = 'plans/7/123e4567-e89b-42d3-a456-426614174000.pdf';
export const KEY_2 = 'plans/7/223e4567-e89b-42d3-a456-426614174111.pdf';

export function attachmentRow(overrides = {}) {
  return {
    attachment_id: 1,
    plan_id: 7,
    s3_key: KEY,
    file_name: 'transcript.pdf',
    content_type: 'application/pdf',
    size_bytes: 1000,
    created_at: '2026-10-27T01:00:00.000Z',
    ...overrides,
  };
}

export function makeDb({ plan, attachments = [], assigned = false } = {}) {
  const state = {
    plan: plan === undefined ? { plan_id: 7, student_id: 'S001', status: 'PREPARING' } : plan,
    attachments: attachments.map((a) => ({ ...a })),
    assigned,
    nextId: 100,
    events: [],
    queries: [],
    released: 0,
    // Runs inside the FOR UPDATE read, before it answers: lets a test change
    // the plan the way another request would while this one waits for the lock.
    beforeLockAnswers: null,
    failOn: null,
  };
  let tx = null;
  const rows = () => (tx ? tx.attachments : state.attachments);

  async function exec(sql, params = []) {
    const text = String(sql).trim();
    state.queries.push({ sql: text, params });
    if (state.failOn && state.failOn.test(text)) throw new Error('boom');

    if (/^BEGIN/.test(text)) {
      state.events.push('BEGIN');
      tx = { attachments: state.attachments.map((a) => ({ ...a })) };
      return { rows: [], rowCount: 0 };
    }
    if (/^COMMIT/.test(text)) {
      state.events.push('COMMIT');
      if (tx) state.attachments = tx.attachments;
      tx = null;
      return { rows: [], rowCount: 0 };
    }
    if (/^ROLLBACK/.test(text)) {
      state.events.push('ROLLBACK');
      tx = null;
      return { rows: [], rowCount: 0 };
    }

    if (/FROM coop_plans/.test(text) && /FOR UPDATE/.test(text)) {
      if (state.beforeLockAnswers) await state.beforeLockAnswers(state);
      return { rows: state.plan ? [{ ...state.plan }] : [], rowCount: state.plan ? 1 : 0 };
    }
    if (/FROM coop_plans/.test(text)) {
      // The whole plan row: the read handlers need only the owner, while
      // requestAttachmentUpload also reads the status from the same SELECT.
      return state.plan ? { rows: [{ ...state.plan }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (/FROM advisor_student_assignments/.test(text)) {
      return state.assigned ? { rows: [{ student_id: 'S001' }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    if (/^INSERT INTO plan_attachments/.test(text)) {
      const [planId, key, fileName, contentType, sizeBytes, uploadedBy] = params;
      if (rows().some((r) => r.s3_key === key)) {
        const err = new Error('duplicate key');
        err.code = '23505';
        throw err;
      }
      const row = {
        attachment_id: state.nextId++,
        plan_id: planId,
        s3_key: key,
        file_name: fileName,
        content_type: contentType,
        size_bytes: sizeBytes,
        uploaded_by: uploadedBy,
        created_at: '2026-10-27T02:00:00.000Z',
      };
      rows().push(row);
      return { rows: [row], rowCount: 1 };
    }
    if (/^DELETE FROM plan_attachments/.test(text)) {
      const [attachmentId, planId] = params;
      const hit = rows().filter((r) => r.attachment_id === attachmentId && r.plan_id === planId);
      const list = rows();
      for (const row of hit) list.splice(list.indexOf(row), 1);
      return { rows: hit.map((r) => ({ s3_key: r.s3_key })), rowCount: hit.length };
    }
    if (/FROM plan_attachments/.test(text) && /attachment_id = \$1 AND plan_id = \$2/.test(text)) {
      const [attachmentId, planId] = params;
      const hit = rows().filter((r) => r.attachment_id === attachmentId && r.plan_id === planId);
      return { rows: hit.map((r) => ({ ...r })), rowCount: hit.length };
    }
    if (/FROM plan_attachments/.test(text)) {
      const hit = rows().filter((r) => r.plan_id === params[0]);
      return { rows: hit.map((r) => ({ ...r })), rowCount: hit.length };
    }

    throw new Error(`attachmentTestDb: unrouted SQL: ${text.slice(0, 80)}`);
  }

  state.pool = {
    query: exec,
    connect: async () => ({ query: exec, release: () => (state.released += 1) }),
  };
  state.wrote = () => state.queries.some((q) => /^(INSERT|DELETE)/.test(q.sql));
  return state;
}
