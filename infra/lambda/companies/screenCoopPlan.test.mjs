import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthenticatedUserMock = vi.fn();
let db;

vi.mock('./db.mjs', () => ({ getPool: () => db.pool }));

// Identity is mocked, authorize.mjs is not, so the role rule below is the real one.
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));

const { screenCoopPlan } = await import('./screenCoopPlan.mjs');

const STAFF = { sub: 'staff-1', role: 'STAFF', studentId: null };
const ADVISOR = { sub: 'advisor-1', role: 'ADVISOR', studentId: null };
const COMMITTEE = { sub: 'committee-1', role: 'COMMITTEE', studentId: null };
const STUDENT = { sub: 'student-1', role: 'STUDENT', studentId: '6600000001' };
const ADMIN = { sub: 'admin-1', role: 'ADMIN', studentId: null };

function signedInAs(user) {
  getAuthenticatedUserMock.mockResolvedValue({ user, denied: null });
}

/** In-memory plan row plus a log of every statement, routed by SQL text. */
function makeDb({ status = 'ENDORSED', exists = true, failOn = null } = {}) {
  const state = { plan: exists ? { plan_id: 10, student_id: '6600000001', status } : null, log: [] };

  async function run(sql, params) {
    state.log.push({ sql, params });
    if (failOn && sql.includes(failOn)) throw new Error('db down');
    if (sql.includes('FOR UPDATE')) return { rows: state.plan ? [{ ...state.plan }] : [] };
    if (sql.startsWith('UPDATE coop_plans')) {
      Object.assign(state.plan, { status: params[0], reviewer_name: params[1], review_comment: params[2] });
      return { rowCount: 1 };
    }
    if (sql.includes('FROM coop_plans p')) return { rows: state.plan ? [{ ...state.plan }] : [] };
    return { rows: [], rowCount: 0 };
  }

  state.pool = {
    query: run,
    connect: async () => ({ query: run, release: () => state.log.push({ sql: 'RELEASE' }) }),
  };
  state.ran = (text) => state.log.some((entry) => entry.sql.includes(text));
  state.find = (text) => state.log.find((entry) => entry.sql.includes(text));
  return state;
}

function request(body, planId = '10') {
  return {
    pathParameters: { planId },
    body: JSON.stringify(body),
    requestContext: { authorizer: { jwt: { claims: { name: 'Staff One' } } } },
  };
}

describe('screenCoopPlan', () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    signedInAs(STAFF);
    db = makeDb();
  });

  it('S01: staff records ELIGIBLE on an endorsed plan: 200, plan ELIGIBLE, SCREENING review recorded', async () => {
    const res = await screenCoopPlan(request({ decision: 'ELIGIBLE' }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ plan_id: 10, status: 'ELIGIBLE', reviewer_name: 'Staff One' });
    expect(db.find('INSERT INTO plan_reviews').params).toEqual([10, 'staff-1', 'ELIGIBLE', null]);
    expect(db.find('INSERT INTO plan_reviews').sql).toContain("'SCREENING'");
    expect(db.ran('COMMIT')).toBe(true);
    expect(db.ran('RELEASE')).toBe(true);
  });

  it('S02: no transcript, staff records INCOMPLETE: plan goes back RETURNED, not ELIGIBLE', async () => {
    const res = await screenCoopPlan(request({ decision: 'INCOMPLETE', comment: ' ไม่มี Transcript ' }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: 'RETURNED', review_comment: 'ไม่มี Transcript' });
    expect(db.find('INSERT INTO plan_reviews').params).toEqual([10, 'staff-1', 'INCOMPLETE', 'ไม่มี Transcript']);
  });

  it('NOT_ELIGIBLE with a reason closes the plan as NOT_ELIGIBLE', async () => {
    const res = await screenCoopPlan(request({ decision: 'NOT_ELIGIBLE', comment: 'GPA ไม่ถึงเกณฑ์' }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).status).toBe('NOT_ELIGIBLE');
  });

  it.each([
    ['INCOMPLETE', undefined],
    ['INCOMPLETE', '  '],
    ['NOT_ELIGIBLE', ''],
  ])('%s without a reason (%j) is refused with 400', async (decision, comment) => {
    const res = await screenCoopPlan(request({ decision, comment }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('COMMENT_REQUIRED');
    expect(db.log).toHaveLength(0);
  });

  it.each([
    ['ADVISOR', ADVISOR],
    ['COMMITTEE', COMMITTEE],
    ['STUDENT', STUDENT],
    ['ADMIN', ADMIN],
  ])('%s is refused with 403 and nothing is written', async (_role, user) => {
    signedInAs(user);
    const res = await screenCoopPlan(request({ decision: 'ELIGIBLE' }));

    expect(res.statusCode).toBe(403);
    expect(db.ran('UPDATE coop_plans')).toBe(false);
    expect(db.ran('INSERT INTO plan_reviews')).toBe(false);
    expect(db.ran('ROLLBACK')).toBe(true);
  });

  it.each(['SUBMITTED', 'ELIGIBLE', 'RETURNED', 'NOT_ELIGIBLE'])(
    'a plan in %s answers 409 and is not overwritten',
    async (status) => {
      db = makeDb({ status });
      const res = await screenCoopPlan(request({ decision: 'ELIGIBLE' }));

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body)).toMatchObject({ code: 'PLAN_NOT_SCREENABLE', currentStatus: status });
      expect(db.ran('UPDATE coop_plans')).toBe(false);
    },
  );

  it('answers 404 for a plan that does not exist', async () => {
    db = makeDb({ exists: false });
    const res = await screenCoopPlan(request({ decision: 'ELIGIBLE' }));
    expect(res.statusCode).toBe(404);
  });

  it.each([
    [{ decision: 'ENDORSED' }, 'INVALID_DECISION'],
    [{ decision: 'APPROVED' }, 'INVALID_DECISION'],
    [{ decision: 'ELIGIBLE', status: 'SELECTED' }, 'UNKNOWN_FIELD'],
  ])('refuses body %j with 400 %s', async (body, code) => {
    const res = await screenCoopPlan(request(body));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe(code);
  });

  it('rolls back and answers 500 when the history insert fails', async () => {
    db = makeDb({ failOn: 'INSERT INTO plan_reviews' });
    const res = await screenCoopPlan(request({ decision: 'ELIGIBLE' }));

    expect(res.statusCode).toBe(500);
    expect(db.ran('ROLLBACK')).toBe(true);
    expect(db.ran('COMMIT')).toBe(false);
  });
});
