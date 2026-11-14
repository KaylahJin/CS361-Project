// #195 (V4-02.3): TC1 in the V4 overview from end to end, student half
// included. reviewAccess.test.mjs (#194) covers the advisor's side and stands
// in for the resubmission by setting the status by hand; here every step goes
// through the real handler (GET, PATCH, submit, endorse) against one shared
// fake plan row, so a step that leaves the plan in the wrong state breaks the
// next one.
//
// Identity is mocked and eligibility is stubbed to "eligible" (eligibility.test.mjs
// and submitCoopPlan.test.mjs cover it); authorize.mjs, planWorkflow.mjs and the
// submission rules are the real ones.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthenticatedUserMock = vi.fn();
let db;

vi.mock('./db.mjs', () => ({ getPool: () => db.pool }));
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));
vi.mock('./eligibility.mjs', () => ({ checkEligibility: async () => [] }));

const { getCoopPlanById } = await import('./getCoopPlanById.mjs');
const { updateCoopPlan } = await import('./updateCoopPlan.mjs');
const { submitCoopPlan } = await import('./submitCoopPlan.mjs');
const { endorseCoopPlan } = await import('./endorseCoopPlan.mjs');

const OWNER = { sub: 'student-sub-1', role: 'STUDENT', studentId: '6600000001' };
const OTHER_STUDENT = { sub: 'student-sub-2', role: 'STUDENT', studentId: '6600000002' };
const ADVISOR = { sub: 'advisor-1', role: 'ADVISOR', studentId: null };
const OTHER_ADVISOR = { sub: 'advisor-2', role: 'ADVISOR', studentId: null };

/**
 * One plan of OWNER, assigned to ADVISOR, already submitted once. Writes are
 * applied only when their own WHERE clause would match, so a handler that
 * forgot to scope its UPDATE to the owner or the status would change the row.
 */
function makeDb({ status = 'SUBMITTED' } = {}) {
  const state = {
    plan: {
      plan_id: 10,
      student_id: OWNER.studentId,
      period_id: 'P2569-1',
      position_id: 'POS013',
      status,
      acknowledged_pre_course: true,
      terms_accepted_at: '2026-10-01T10:00:00Z',
      student_note: 'first version',
      submitted_at: '2026-10-02T10:00:00Z',
      reviewer_name: null,
      reviewed_at: null,
      review_comment: null,
    },
    reviews: [],
    writes: 0,
  };

  async function run(sql, params = []) {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
    if (sql.includes('FOR UPDATE')) return { rows: [{ ...state.plan }] };
    if (sql.includes('advisor_student_assignments')) {
      const assigned = params[0] === ADVISOR.sub && params[1] === OWNER.studentId;
      return { rows: assigned ? [{ student_id: params[1] }] : [] };
    }
    if (sql.includes('FROM coop_schedules')) {
      return { rows: [{ start_date: '2026-10-01', end_date: '2026-11-30', is_open: true }] };
    }
    if (sql.includes("SET status = 'SUBMITTED'")) {
      const [planId, studentId, allowed] = params;
      const p = state.plan;
      if (p.plan_id !== planId || p.student_id !== studentId || !allowed.includes(p.status)) {
        return { rowCount: 0 };
      }
      state.writes += 1;
      Object.assign(p, { status: 'SUBMITTED', submitted_at: '2026-11-09T10:00:00Z' });
      return { rowCount: 1 };
    }
    if (sql.includes('SET status = $1, reviewer_name')) {
      state.writes += 1;
      Object.assign(state.plan, {
        status: params[0],
        reviewer_name: params[1],
        reviewed_at: '2026-11-09T09:00:00Z',
        review_comment: params[2],
      });
      return { rowCount: 1 };
    }
    if (sql.startsWith('UPDATE coop_plans')) {
      // updateCoopPlan: the last three params are plan_id, student_id, statuses.
      const [planId, studentId, allowed] = params.slice(-3);
      const p = state.plan;
      if (p.plan_id !== planId || p.student_id !== studentId || !allowed.includes(p.status)) {
        return { rowCount: 0 };
      }
      state.writes += 1;
      for (const [, column, n] of sql.matchAll(/(\w+) = \$(\d+)/g)) {
        if (column !== 'plan_id' && column !== 'student_id') p[column] = params[Number(n) - 1];
      }
      return { rowCount: 1 };
    }
    if (sql.includes('INSERT INTO plan_reviews')) {
      state.reviews.push({
        review_id: state.reviews.length + 1,
        reviewer_sub: params[1],
        decision: params[2],
        comment: params[3],
      });
      return { rowCount: 1 };
    }
    if (sql.includes('FROM plan_reviews')) {
      return {
        rows: [...state.reviews].reverse().map(({ review_id, decision, comment }) => ({
          review_id,
          decision,
          comment,
          reviewer_name: 'advisor@example.com',
        })),
      };
    }
    if (sql.includes('FROM coop_plans p')) {
      return { rows: params[0] === state.plan.plan_id ? [{ ...state.plan }] : [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  }

  state.pool = {
    query: run,
    connect: async () => ({ query: run, release: () => {} }),
  };
  return state;
}

function as(user) {
  getAuthenticatedUserMock.mockResolvedValue({ user, denied: null });
}

const path = { pathParameters: { planId: '10' } };
const claims = { requestContext: { authorizer: { jwt: { claims: { name: 'Advisor One' } } } } };

async function view(user) {
  as(user);
  const res = await getCoopPlanById(path);
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

async function edit(user, body) {
  as(user);
  const res = await updateCoopPlan({ ...path, body: JSON.stringify(body) });
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

async function submit(user, body) {
  as(user);
  const res = await submitCoopPlan({ ...path, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

async function endorse(user, body) {
  as(user);
  const res = await endorseCoopPlan({ ...path, ...claims, body: JSON.stringify(body) });
  return { status: res.statusCode, body: JSON.parse(res.body) };
}

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();
});

describe('#195 TC1: return with a reason, student fixes and resubmits, advisor reviews again', () => {
  beforeEach(() => {
    db = makeDb();
  });

  it('runs the whole cycle through the real handlers, with the status matching V4 overview §5.2 at every step', async () => {
    // Steps 1-3: the assigned advisor opens the plan; another advisor cannot.
    expect((await view(ADVISOR)).body.status).toBe('SUBMITTED');
    expect((await view(OTHER_ADVISOR)).status).toBe(403);

    // Step 4: returned with a reason. SUBMITTED -> RETURNED.
    const returned = await endorse(ADVISOR, { decision: 'NOT_ENDORSED', comment: 'แนบ Transcript ล่าสุด' });
    expect(returned.status).toBe(200);
    expect(returned.body.status).toBe('RETURNED');

    // Step 5: the student reads the reason, on the plan and in its history.
    const seen = await view(OWNER);
    expect(seen.status).toBe(200);
    expect(seen.body).toMatchObject({ status: 'RETURNED', review_comment: 'แนบ Transcript ล่าสุด' });
    expect(seen.body.reviews).toEqual([
      expect.objectContaining({ decision: 'NOT_ENDORSED', comment: 'แนบ Transcript ล่าสุด' }),
    ]);

    // Step 6a: the student edits the same plan. Saving is not resubmitting:
    // it stays RETURNED and keeps the reason.
    const edited = await edit(OWNER, { studentNote: 'second version, transcript attached' });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      plan_id: 10,
      status: 'RETURNED',
      student_note: 'second version, transcript attached',
      review_comment: 'แนบ Transcript ล่าสุด',
    });

    // Step 6b: resubmitted. RETURNED -> SUBMITTED, same plan id.
    const resubmitted = await submit(OWNER);
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body).toMatchObject({ plan_id: 10, status: 'SUBMITTED' });

    // Waiting on the advisor again, so the student can no longer edit or resubmit.
    expect((await edit(OWNER, { studentNote: 'third' })).body.code).toBe('PLAN_NOT_EDITABLE');
    expect((await submit(OWNER)).body.code).toBe('ALREADY_SUBMITTED');
    expect(db.plan.student_note).toBe('second version, transcript attached');

    // Step 7: the advisor sees the resubmission, with the first decision still on record,
    // and can decide it again.
    const back = await view(ADVISOR);
    expect(back.body).toMatchObject({ status: 'SUBMITTED', student_note: 'second version, transcript attached' });
    expect(back.body.reviews.map((r) => r.decision)).toEqual(['NOT_ENDORSED']);

    const endorsed = await endorse(ADVISOR, { decision: 'ENDORSED' });
    expect(endorsed.body.status).toBe('ENDORSED');
    expect(db.reviews.map((r) => r.decision)).toEqual(['NOT_ENDORSED', 'ENDORSED']);
  });

  it('the advisor cannot return without a reason (RT2), so the student is never sent back with nothing to fix', async () => {
    const res = await endorse(ADVISOR, { decision: 'NOT_ENDORSED', comment: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('COMMENT_REQUIRED');
    expect(db.plan.status).toBe('SUBMITTED');
    expect(db.writes).toBe(0);
  });
});

describe('#195 the student edits and submits only in PREPARING or RETURNED', () => {
  it.each(['SUBMITTED', 'ENDORSED', 'ELIGIBLE', 'NOT_ELIGIBLE', 'SELECTED', 'NOT_SELECTED', 'APPROVED', 'REJECTED'])(
    'a %s plan: edit and submit both answer 409 and nothing changes',
    async (status) => {
      db = makeDb({ status });

      const edited = await edit(OWNER, { studentNote: 'changed' });
      const submitted = await submit(OWNER);

      expect(edited.status).toBe(409);
      expect(edited.body.code).toBe('PLAN_NOT_EDITABLE');
      expect(submitted.status).toBe(409);
      expect(db.plan).toMatchObject({ status, student_note: 'first version' });
      expect(db.writes).toBe(0);
    },
  );
});

describe('#195 nobody but the owner sees the reason, edits or resubmits a returned plan', () => {
  beforeEach(() => {
    db = makeDb({ status: 'RETURNED' });
    db.plan.review_comment = 'แนบ Transcript ล่าสุด';
  });

  it("another student gets 403 on view, edit and submit, and learns nothing of the plan or the reason", async () => {
    const seen = await view(OTHER_STUDENT);
    const edited = await edit(OTHER_STUDENT, { studentNote: 'hijacked' });
    const submitted = await submit(OTHER_STUDENT);

    for (const res of [seen, edited, submitted]) {
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain('Transcript');
      expect(res.body).not.toHaveProperty('status');
    }
    expect(db.plan).toMatchObject({ status: 'RETURNED', student_note: 'first version' });
    expect(db.writes).toBe(0);
  });

  it("a student_id sent by the client does not make the plan the caller's: identity comes from the token", async () => {
    const edited = await edit(OTHER_STUDENT, { studentNote: 'hijacked', student_id: OWNER.studentId });
    const submitted = await submit(OTHER_STUDENT, { student_id: OWNER.studentId, studentId: OWNER.studentId });

    expect(edited.status).toBe(403);
    expect(submitted.status).toBe(403);
    expect(db.plan.status).toBe('RETURNED');
    expect(db.writes).toBe(0);
  });

  it('the assigned advisor can read the returned plan but cannot edit or resubmit it for the student', async () => {
    expect((await view(ADVISOR)).status).toBe(200);
    expect((await edit(ADVISOR, { studentNote: 'fixed by advisor' })).status).toBe(403);
    expect((await submit(ADVISOR)).status).toBe(403);
    expect(db.plan.status).toBe('RETURNED');
    expect(db.writes).toBe(0);
  });
});
