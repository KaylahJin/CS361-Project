// #189 (V4-02.1): what an advisor can read before deciding. reviewAccess.test.mjs
// and endorseCoopPlan.test.mjs cover the decision itself; these cover the two
// reads that lead to it, the list and the plan page, from the advisor's side.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
const getAuthenticatedUserMock = vi.fn();

vi.mock('./db.mjs', () => ({ getPool: () => ({ query: queryMock }) }));

// Identity is mocked, authorize.mjs is not, so the assignment rule is the real one.
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));

const { getCoopPlanById } = await import('./getCoopPlanById.mjs');
const { listCoopPlans } = await import('./listCoopPlans.mjs');

const ADVISOR = { sub: 'advisor-1', role: 'ADVISOR', studentId: null };

const PLAN = {
  plan_id: 21,
  student_id: '6600000001',
  status: 'SUBMITTED',
  reviewer_name: 'advisor1@example.com',
  reviewed_at: '2026-10-22T09:00:00Z',
  review_comment: 'กรุณาแนบใบรับรองผลการเรียน',
};

const HISTORY = [
  {
    review_id: 5,
    decision: 'NOT_ENDORSED',
    comment: 'กรุณาแนบใบรับรองผลการเรียน',
    reviewed_at: '2026-10-22T09:00:00Z',
    reviewer_name: 'advisor1@example.com',
  },
];

/** Answers the plan query, the assignment check and the history query by their SQL. */
function fakeDb({ assigned }) {
  queryMock.mockImplementation(async (sql) => {
    if (sql.includes('advisor_student_assignments')) {
      return { rows: assigned ? [{ student_id: PLAN.student_id }] : [] };
    }
    if (sql.includes('FROM plan_reviews')) return { rows: HISTORY };
    if (sql.includes('FROM coop_plans p')) return { rows: [PLAN] };
    return { rows: [] };
  });
}

function ranSql(fragment) {
  return queryMock.mock.calls.some(([sql]) => sql.includes(fragment));
}

beforeEach(() => {
  queryMock.mockReset();
  getAuthenticatedUserMock.mockReset();
  getAuthenticatedUserMock.mockResolvedValue({ user: ADVISOR, denied: null });
});

describe('#189 GET /coop-plans/{planId} for an advisor', () => {
  it('assigned: returns the status, latest comment and history exactly as stored', async () => {
    fakeDb({ assigned: true });

    const res = await getCoopPlanById({ pathParameters: { planId: '21' } });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ...PLAN, reviews: HISTORY });
    const check = queryMock.mock.calls.find(([sql]) => sql.includes('advisor_student_assignments'));
    expect(check[1]).toEqual(['advisor-1', '6600000001']);
  });

  it('not assigned: 403 with no plan field in the body, and the history is never read', async () => {
    fakeDb({ assigned: false });

    const res = await getCoopPlanById({ pathParameters: { planId: '21' } });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({ error: 'Forbidden' });
    expect(res.body).not.toContain('กรุณาแนบ');
    expect(ranSql('FROM plan_reviews')).toBe(false);
  });
});

describe('#189 GET /coop-plans for an advisor', () => {
  it.each([
    ['a student who is not theirs', { studentId: '6699999999' }],
    ['a status', { status: 'SUBMITTED' }],
    ['a name search', { search: 'สมใจ' }],
  ])('filtering by %s narrows the assigned list, never widens it', async (_label, params) => {
    queryMock.mockResolvedValue({ rows: [] });

    const res = await listCoopPlans({ queryStringParameters: params });

    expect(res.statusCode).toBe(200);
    const [sql, values] = queryMock.mock.calls[0];
    const where = sql.slice(sql.indexOf('WHERE'));
    expect(where).toMatch(/ AND p\.student_id IN \(\s*SELECT student_id FROM advisor_student_assignments WHERE advisor_sub = \$\d+/);
    expect(where).not.toMatch(/\bOR p\.student_id IN/);
    expect(values.at(-1)).toBe('advisor-1');
  });
});
