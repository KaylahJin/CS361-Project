// #188 (V4-02): regression evidence for the advisor's step, RT1/RT4/RT5 and the
// advisor half of TC1 in the V4 overview. endorseCoopPlan.test.mjs covers each
// answer on its own; these follow one plan through several requests, against a
// fake database whose FOR UPDATE really queues, so a lost race would show.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthenticatedUserMock = vi.fn();
let db;

vi.mock('./db.mjs', () => ({ getPool: () => db.pool }));

// Identity is mocked, authorize.mjs is not, so the assignment rule is the real one.
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));

const { endorseCoopPlan } = await import('./endorseCoopPlan.mjs');

const ADVISOR = { sub: 'advisor-1', role: 'ADVISOR', studentId: null };
const OTHER_ADVISOR = { sub: 'advisor-2', role: 'ADVISOR', studentId: null };

function signedInAs(user) {
  getAuthenticatedUserMock.mockResolvedValue({ user, denied: null });
}

/**
 * One plan row, one advisor assignment, and a row lock that is held from the
 * FOR UPDATE until COMMIT, ROLLBACK or release, the way Postgres holds it.
 */
function makeDb({ status = 'SUBMITTED', assignedTo = 'advisor-1' } = {}) {
  const state = {
    plan: { plan_id: 10, student_id: '6600000001', status, review_comment: null },
    reviews: [],
    updates: 0,
  };
  let lockTail = Promise.resolve();

  function acquire() {
    let unlock;
    const held = new Promise((resolve) => {
      unlock = resolve;
    });
    const ready = lockTail.then(() => unlock);
    lockTail = lockTail.then(() => held);
    return ready;
  }

  async function run(client, sql, params) {
    if (sql === 'COMMIT' || sql === 'ROLLBACK') {
      client.unlock?.();
      client.unlock = null;
      return {};
    }
    if (sql.includes('FOR UPDATE')) {
      client.unlock = await acquire();
      return { rows: [{ ...state.plan }] };
    }
    if (sql.includes('advisor_student_assignments')) {
      return { rows: params[0] === assignedTo ? [{ student_id: params[1] }] : [] };
    }
    if (sql.startsWith('UPDATE coop_plans')) {
      state.updates += 1;
      Object.assign(state.plan, { status: params[0], review_comment: params[2] });
      return { rowCount: 1 };
    }
    if (sql.includes('INSERT INTO plan_reviews')) {
      state.reviews.push({ reviewer_sub: params[1], decision: params[2], comment: params[3] });
      return { rowCount: 1 };
    }
    if (sql.includes('FROM coop_plans p')) return { rows: [{ ...state.plan }] };
    return { rows: [] };
  }

  state.pool = {
    query: (sql, params) => run({}, sql, params),
    connect: async () => {
      const client = { unlock: null };
      return {
        query: (sql, params) => run(client, sql, params),
        release: () => client.unlock?.(),
      };
    },
  };
  return state;
}

function endorse(body) {
  return endorseCoopPlan({
    pathParameters: { planId: '10' },
    body: JSON.stringify(body),
    requestContext: { authorizer: { jwt: { claims: { name: 'Advisor One' } } } },
  });
}

describe('#188 RT1: an advisor decides only plans of students assigned to them', () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    db = makeDb();
  });

  it.each([
    ['ENDORSED', undefined],
    ['NOT_ENDORSED', 'ไม่ผ่าน'],
  ])('an unassigned advisor sending %s gets 403, and the plan and its history stay as they were', async (decision, comment) => {
    signedInAs(OTHER_ADVISOR);
    const res = await endorse({ decision, comment });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).not.toHaveProperty('status');
    expect(db.plan.status).toBe('SUBMITTED');
    expect(db.updates).toBe(0);
    expect(db.reviews).toEqual([]);
  });
});

describe('#188 RT4: only a SUBMITTED plan can be decided', () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    signedInAs(ADVISOR);
  });

  // endorseCoopPlan.test.mjs covers ENDORSED, RETURNED and PREPARING.
  it.each(['APPROVED', 'REJECTED'])('a plan already %s answers 409 and keeps its status', async (status) => {
    db = makeDb({ status });
    const res = await endorse({ decision: 'NOT_ENDORSED', comment: 'ส่งกลับ' });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).currentStatus).toBe(status);
    expect(db.plan.status).toBe(status);
    expect(db.reviews).toEqual([]);
  });
});

describe('#188 RT5: conflicting decisions on one plan', () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    signedInAs(ADVISOR);
    db = makeDb();
  });

  it('two decisions sent at the same time: one wins, the other gets 409, and only the winner is recorded', async () => {
    const results = await Promise.all([
      endorse({ decision: 'ENDORSED' }),
      endorse({ decision: 'NOT_ENDORSED', comment: 'แก้ขอบเขตงาน' }),
    ]);

    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(db.updates).toBe(1);
    expect(db.reviews).toHaveLength(1);

    const winner = JSON.parse(results.find((r) => r.statusCode === 200).body);
    expect(db.plan.status).toBe(winner.status);
    const loser = JSON.parse(results.find((r) => r.statusCode === 409).body);
    expect(loser).toMatchObject({ code: 'PLAN_NOT_ENDORSABLE', currentStatus: winner.status });
  });

  it('a stale request after the plan was returned gets 409 and does not overwrite the reason', async () => {
    const returned = await endorse({ decision: 'NOT_ENDORSED', comment: 'แนบ Transcript' });
    expect(returned.statusCode).toBe(200);

    // Sent from a page opened while the plan was still SUBMITTED.
    const stale = await endorse({ decision: 'ENDORSED' });

    expect(stale.statusCode).toBe(409);
    expect(JSON.parse(stale.body).currentStatus).toBe('RETURNED');
    expect(db.plan).toMatchObject({ status: 'RETURNED', review_comment: 'แนบ Transcript' });
    expect(db.reviews).toHaveLength(1);
  });
});

describe('#188 TC1: return with a reason, then decide the resubmission', () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    signedInAs(ADVISOR);
    db = makeDb();
  });

  it('the advisor can decide the same plan again once the student resubmits it, and both decisions are kept', async () => {
    const first = await endorse({ decision: 'NOT_ENDORSED', comment: 'แนบ Transcript' });
    expect(JSON.parse(first.body)).toMatchObject({ status: 'RETURNED', review_comment: 'แนบ Transcript' });

    // submitCoopPlan moves RETURNED back to SUBMITTED (see submitCoopPlan.test.mjs).
    db.plan.status = 'SUBMITTED';

    const second = await endorse({ decision: 'ENDORSED' });

    expect(second.statusCode).toBe(200);
    expect(db.plan.status).toBe('ENDORSED');
    expect(db.reviews.map((r) => r.decision)).toEqual(['NOT_ENDORSED', 'ENDORSED']);
  });
});
