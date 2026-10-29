import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthenticatedUserMock = vi.fn();
let db;

vi.mock('./db.mjs', () => ({ getPool: () => db.pool }));

// Identity is mocked, authorize.mjs is not, so the role and assignment rules
// below are the real ones.
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));

const { endorseCoopPlan } = await import('./endorseCoopPlan.mjs');

const ADVISOR = { sub: 'advisor-1', role: 'ADVISOR', studentId: null };
const STAFF = { sub: 'staff-1', role: 'STAFF', studentId: null };
const COMMITTEE = { sub: 'committee-1', role: 'COMMITTEE', studentId: null };
const STUDENT = { sub: 'student-1', role: 'STUDENT', studentId: '6600000001' };
const ADMIN = { sub: 'admin-1', role: 'ADMIN', studentId: null };

function signedInAs(user) {
  getAuthenticatedUserMock.mockResolvedValue({ user, denied: null });
}

/** In-memory plan row plus a log of every statement, routed by SQL text. */
function makeDb({ status = 'SUBMITTED', exists = true, assigned = true, failOn = null } = {}) {
  const state = { plan: exists ? { plan_id: 10, student_id: '6600000001', status } : null, log: [] };

  async function run(sql, params) {
    state.log.push({ sql, params });
    if (failOn && sql.includes(failOn)) throw new Error('db down');
    if (sql.includes('FOR UPDATE')) return { rows: state.plan ? [{ ...state.plan }] : [] };
    if (sql.includes('advisor_student_assignments')) {
      return { rows: assigned ? [{ student_id: '6600000001' }] : [] };
    }
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
    requestContext: { authorizer: { jwt: { claims: { name: 'Advisor One' } } } },
  };
}

describe('endorseCoopPlan', () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    signedInAs(ADVISOR);
    db = makeDb();
  });

  it('an assigned advisor endorses a SUBMITTED plan: 200, plan ENDORSED, review recorded', async () => {
    const res = await endorseCoopPlan(request({ decision: 'ENDORSED' }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ plan_id: 10, status: 'ENDORSED', reviewer_name: 'Advisor One' });
    expect(db.find('INSERT INTO plan_reviews').params).toEqual([10, 'advisor-1', 'ENDORSED', null]);
    expect(db.find('INSERT INTO plan_reviews').sql).toContain("'ENDORSEMENT'");
    expect(db.ran('COMMIT')).toBe(true);
    expect(db.ran('RELEASE')).toBe(true);
  });

  it('not endorsing with a reason returns the plan to the student: 200, plan RETURNED', async () => {
    const res = await endorseCoopPlan(request({ decision: 'NOT_ENDORSED', comment: '  ขาดใบรับรองแพทย์  ' }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: 'RETURNED', review_comment: 'ขาดใบรับรองแพทย์' });
    expect(db.find('INSERT INTO plan_reviews').params).toEqual([10, 'advisor-1', 'NOT_ENDORSED', 'ขาดใบรับรองแพทย์']);
  });

  it.each([undefined, '', '   '])('not endorsing without a reason (%j) is refused with 400', async (comment) => {
    const res = await endorseCoopPlan(request({ decision: 'NOT_ENDORSED', comment }));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe('COMMENT_REQUIRED');
    expect(db.log).toHaveLength(0);
  });

  it.each([
    ['STAFF', STAFF],
    ['COMMITTEE', COMMITTEE],
    ['STUDENT', STUDENT],
    ['ADMIN', ADMIN],
  ])('%s is refused with 403 and nothing is written', async (_role, user) => {
    signedInAs(user);
    const res = await endorseCoopPlan(request({ decision: 'ENDORSED' }));

    expect(res.statusCode).toBe(403);
    expect(db.ran('UPDATE coop_plans')).toBe(false);
    expect(db.ran('INSERT INTO plan_reviews')).toBe(false);
    expect(db.ran('ROLLBACK')).toBe(true);
  });

  it('an advisor not assigned to the student is refused with 403', async () => {
    db = makeDb({ assigned: false });
    const res = await endorseCoopPlan(request({ decision: 'ENDORSED' }));

    expect(res.statusCode).toBe(403);
    expect(db.ran('UPDATE coop_plans')).toBe(false);
  });

  it.each(['ENDORSED', 'RETURNED', 'PREPARING'])('a plan already %s answers 409 and is not overwritten', async (status) => {
    db = makeDb({ status });
    const res = await endorseCoopPlan(request({ decision: 'ENDORSED' }));

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toMatchObject({ code: 'PLAN_NOT_ENDORSABLE', currentStatus: status });
    expect(db.ran('UPDATE coop_plans')).toBe(false);
  });

  it('answers 404 for a plan that does not exist', async () => {
    db = makeDb({ exists: false });
    const res = await endorseCoopPlan(request({ decision: 'ENDORSED' }));
    expect(res.statusCode).toBe(404);
  });

  it.each([
    [{ decision: 'APPROVED' }, 'INVALID_DECISION'],
    [{ decision: 'ENDORSED', status: 'SELECTED' }, 'UNKNOWN_FIELD'],
    [{ decision: 'ENDORSED', comment: 5 }, 'INVALID_COMMENT'],
    [{ decision: 'NOT_ENDORSED', comment: 'x'.repeat(2001) }, 'COMMENT_TOO_LONG'],
  ])('refuses body %j with 400 %s', async (body, code) => {
    const res = await endorseCoopPlan(request(body));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).code).toBe(code);
  });

  it('answers 400 for a non-numeric planId', async () => {
    const res = await endorseCoopPlan(request({ decision: 'ENDORSED' }, 'abc'));
    expect(res.statusCode).toBe(400);
  });

  it('answers 401 when the caller carries no token', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: null, denied: { status: 401, error: 'Unauthorized' } });
    const res = await endorseCoopPlan(request({ decision: 'ENDORSED' }));
    expect(res.statusCode).toBe(401);
  });

  it('rolls back and answers 500 when the history insert fails', async () => {
    db = makeDb({ failOn: 'INSERT INTO plan_reviews' });
    const res = await endorseCoopPlan(request({ decision: 'ENDORSED' }));

    expect(res.statusCode).toBe(500);
    expect(db.ran('ROLLBACK')).toBe(true);
    expect(db.ran('COMMIT')).toBe(false);
  });
});
