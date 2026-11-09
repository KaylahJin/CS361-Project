import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthenticatedUserMock = vi.fn();
const checkEligibilityMock = vi.fn();
const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({ getPool: () => ({ query: queryMock }) }));
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));
// The rules themselves are covered in eligibility.test.mjs.
vi.mock('./eligibility.mjs', () => ({ checkEligibility: checkEligibilityMock }));

const { getPlanEligibility } = await import('./getPlanEligibility.mjs');

const PLAN_ROW = { plan_id: 10, student_id: '6600000001', period_id: 'P2568-1', min_gpa: 2, min_group_gpa: 2 };

function signedInAs(role) {
  getAuthenticatedUserMock.mockResolvedValue({ user: { sub: 'u-1', role, studentId: null }, denied: null });
}

const request = (planId = '10') => ({ pathParameters: { planId } });

describe('getPlanEligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInAs('STAFF');
    queryMock.mockResolvedValue({ rows: [PLAN_ROW] });
  });

  it("answers the period's criteria and an empty failure list for an eligible student", async () => {
    checkEligibilityMock.mockResolvedValue([]);
    const res = await getPlanEligibility(request());

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      plan_id: 10,
      period_id: 'P2568-1',
      criteria: { min_gpa: 2, min_group_gpa: 2 },
      eligible: true,
      failures: [],
    });
    expect(checkEligibilityMock).toHaveBeenCalledWith(expect.anything(), '6600000001', 'P2568-1');
  });

  it('passes the failures through and says not eligible', async () => {
    const failure = { code: 'GPA_BELOW_MINIMUM', required: 2, actual: 1.9 };
    checkEligibilityMock.mockResolvedValue([failure]);
    const res = await getPlanEligibility(request());

    expect(JSON.parse(res.body)).toMatchObject({ eligible: false, failures: [failure] });
  });

  it.each(['ADVISOR', 'COMMITTEE', 'STUDENT', 'ADMIN'])('%s is refused with 403 before any lookup', async (role) => {
    signedInAs(role);
    const res = await getPlanEligibility(request());

    expect(res.statusCode).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('answers 404 for a plan that does not exist', async () => {
    queryMock.mockResolvedValue({ rows: [] });
    const res = await getPlanEligibility(request());

    expect(res.statusCode).toBe(404);
    expect(checkEligibilityMock).not.toHaveBeenCalled();
  });

  it('answers 400 for a non-numeric planId', async () => {
    const res = await getPlanEligibility(request('abc'));
    expect(res.statusCode).toBe(400);
  });

  it('answers 500 when the database fails', async () => {
    queryMock.mockRejectedValue(new Error('db down'));
    const res = await getPlanEligibility(request());
    expect(res.statusCode).toBe(500);
  });
});
