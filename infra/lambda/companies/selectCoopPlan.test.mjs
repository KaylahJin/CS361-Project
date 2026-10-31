import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthenticatedUserMock = vi.fn();
let db;

vi.mock('./db.mjs', () => ({ getPool: () => db.pool }));

// Identity is mocked, authorize.mjs is not, so the role rule below is the real one.
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));

const { selectCoopPlan } = await import('./selectCoopPlan.mjs');

const COMMITTEE = { sub: 'committee-1', role: 'COMMITTEE', studentId: null };

function signedInAs(user) {
  getAuthenticatedUserMock.mockResolvedValue({ user, denied: null });
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

/**
 * In-memory database with what the capacity rule depends on: row locks held
 * until COMMIT / ROLLBACK, writes visible to others only after COMMIT, and a
 * count that reads committed rows (READ COMMITTED). Each connection is one
 * transaction.
 */
function makeDb({ plans, capacity = 2 }) {
  const committed = new Map(plans.map((p) => [p.plan_id, { period_id: 'P1', ...p }]));
  const locks = new Map();
  const log = [];

  async function lock(key, tx) {
    while (locks.has(key) && locks.get(key).holder !== tx) await locks.get(key).released;
    if (!locks.has(key)) {
      let release;
      const released = new Promise((resolve) => (release = resolve));
      locks.set(key, { holder: tx, released, release });
      tx.held.push(key);
    }
  }

  function end(tx, keep) {
    if (keep) for (const [id, change] of tx.pending) Object.assign(committed.get(id), change);
    tx.pending.clear();
    for (const key of tx.held.splice(0)) {
      const entry = locks.get(key);
      locks.delete(key);
      entry.release();
    }
  }

  function connect() {
    const tx = { pending: new Map(), held: [] };
    const query = async (sql, params = []) => {
      log.push({ sql, params });
      if (sql === 'COMMIT') return end(tx, true);
      if (sql === 'ROLLBACK') return end(tx, false);
      if (sql.includes('FROM coop_plans WHERE plan_id = $1 FOR UPDATE')) {
        await lock(`plan:${params[0]}`, tx);
        const row = committed.get(params[0]);
        return { rows: row ? [{ ...row }] : [] };
      }
      if (sql.includes('FROM periods WHERE period_id = $1 FOR UPDATE')) {
        await lock(`period:${params[0]}`, tx);
        return { rows: [{ capacity }] };
      }
      if (sql.includes('count(*)::int AS taken')) {
        const taken = [...committed.values()].filter(
          (p) => p.period_id === params[0] && ['SELECTED', 'APPROVED'].includes(p.status),
        ).length;
        await tick(); // a slow count: without the period lock, both would read the same seat as free
        return { rows: [{ taken }] };
      }
      if (sql.startsWith('UPDATE coop_plans')) {
        tx.pending.set(params[3], { status: params[0], review_comment: params[2] });
        return { rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    };
    return { query, release: () => {} };
  }

  const readBack = async (sql, params) => {
    log.push({ sql, params });
    const row = committed.get(params[0]);
    return { rows: row ? [{ ...row }] : [] };
  };

  return {
    pool: { connect: async () => connect(), query: readBack },
    status: (id) => committed.get(id).status,
    ran: (text) => log.some((entry) => entry.sql.includes(text)),
  };
}

const request = (body, planId = '10') => ({
  pathParameters: { planId },
  body: JSON.stringify(body),
  requestContext: { authorizer: { jwt: { claims: { name: 'Committee One' } } } },
});

describe('selectCoopPlan', () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    signedInAs(COMMITTEE);
    db = makeDb({ plans: [{ plan_id: 10, student_id: '6600000001', status: 'ELIGIBLE' }] });
  });

  it('the committee selects an ELIGIBLE plan while a seat is free: 200, SELECTED', async () => {
    const res = await selectCoopPlan(request({ decision: 'SELECTED' }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('SELECTED');
    expect(db.ran("'SELECTION'")).toBe(true);
  });

  it('selecting past the capacity answers 409 CAPACITY_REACHED and writes nothing', async () => {
    db = makeDb({
      capacity: 1,
      plans: [
        { plan_id: 10, student_id: '6600000001', status: 'ELIGIBLE' },
        { plan_id: 11, student_id: '6600000002', status: 'SELECTED' },
      ],
    });
    const res = await selectCoopPlan(request({ decision: 'SELECTED' }));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'CAPACITY_REACHED', capacity: 1, selected: 1 });
    expect(db.status(10)).toBe('ELIGIBLE');
    expect(db.ran('INSERT INTO plan_reviews')).toBe(false);
  });

  it('a plan approved in one step before #148 still takes a seat', async () => {
    db = makeDb({
      capacity: 1,
      plans: [
        { plan_id: 10, student_id: '6600000001', status: 'ELIGIBLE' },
        { plan_id: 11, student_id: '6600000002', status: 'APPROVED' },
      ],
    });
    const res = await selectCoopPlan(request({ decision: 'SELECTED' }));
    expect(JSON.parse(res.body).code).toBe('CAPACITY_REACHED');
  });

  it.each([null, 0])('a period with capacity %j answers 409 CAPACITY_NOT_SET', async (capacity) => {
    db = makeDb({ capacity, plans: [{ plan_id: 10, student_id: '6600000001', status: 'ELIGIBLE' }] });
    const res = await selectCoopPlan(request({ decision: 'SELECTED' }));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).code).toBe('CAPACITY_NOT_SET');
  });

  it('two committee members take the last seat at once: one SELECTED, the other 409', async () => {
    db = makeDb({
      capacity: 1,
      plans: [
        { plan_id: 10, student_id: '6600000001', status: 'ELIGIBLE' },
        { plan_id: 11, student_id: '6600000002', status: 'ELIGIBLE' },
      ],
    });
    const results = await Promise.all([
      selectCoopPlan(request({ decision: 'SELECTED' }, '10')),
      selectCoopPlan(request({ decision: 'SELECTED' }, '11')),
    ]);

    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(JSON.parse(results.find((r) => r.statusCode === 409).body).code).toBe('CAPACITY_REACHED');
    expect([db.status(10), db.status(11)].sort()).toEqual(['ELIGIBLE', 'SELECTED']);
  });

  it('two committee members decide the same plan at once: the second gets 409 PLAN_NOT_SELECTABLE', async () => {
    const [first, second] = await Promise.all([
      selectCoopPlan(request({ decision: 'SELECTED' })),
      selectCoopPlan(request({ decision: 'NOT_SELECTED', comment: 'ที่นั่งเต็มตามลำดับคะแนน' })),
    ]);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(409);
    expect(JSON.parse(second.body)).toMatchObject({ code: 'PLAN_NOT_SELECTABLE', currentStatus: 'SELECTED' });
  });

  it('NOT_SELECTED with a reason needs no seat, even when the period is full', async () => {
    db = makeDb({
      capacity: 1,
      plans: [
        { plan_id: 10, student_id: '6600000001', status: 'ELIGIBLE' },
        { plan_id: 11, student_id: '6600000002', status: 'SELECTED' },
      ],
    });
    const res = await selectCoopPlan(request({ decision: 'NOT_SELECTED', comment: 'ที่นั่งเต็ม' }));

    expect(res.statusCode).toBe(200);
    expect(db.status(10)).toBe('NOT_SELECTED');
    expect(db.ran('FROM periods')).toBe(false);
  });

  it('NOT_SELECTED without a reason is refused with 400', async () => {
    const res = await selectCoopPlan(request({ decision: 'NOT_SELECTED' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('COMMENT_REQUIRED');
  });

  it.each(['STAFF', 'ADVISOR', 'STUDENT', 'ADMIN'])('%s is refused with 403 and nothing is written', async (role) => {
    signedInAs({ sub: 'u-1', role, studentId: role === 'STUDENT' ? '6600000001' : null });
    const res = await selectCoopPlan(request({ decision: 'SELECTED' }));

    expect(res.statusCode).toBe(403);
    expect(db.status(10)).toBe('ELIGIBLE');
    expect(db.ran('UPDATE coop_plans')).toBe(false);
  });

  it.each(['ENDORSED', 'SELECTED', 'NOT_SELECTED', 'RETURNED'])('a plan in %s answers 409', async (status) => {
    db = makeDb({ plans: [{ plan_id: 10, student_id: '6600000001', status }] });
    const res = await selectCoopPlan(request({ decision: 'SELECTED' }));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'PLAN_NOT_SELECTABLE', currentStatus: status });
  });

  it.each([{ decision: 'ELIGIBLE' }, { decision: 'APPROVED' }])('refuses %j with 400 INVALID_DECISION', async (body) => {
    const res = await selectCoopPlan(request(body));
    expect(JSON.parse(res.body).code).toBe('INVALID_DECISION');
  });
});
