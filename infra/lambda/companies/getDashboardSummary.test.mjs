import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
const getAuthenticatedUserMock = vi.fn();
vi.mock('./db.mjs', () => ({ getPool: () => ({ query: queryMock }) }));
vi.mock('./auth.mjs', () => ({ getAuthenticatedUser: getAuthenticatedUserMock }));

const { getDashboardSummary } = await import('./getDashboardSummary.mjs');

const signedInAs = (role) => getAuthenticatedUserMock.mockResolvedValue({
  user: { sub: `${role.toLowerCase()}-1`, role, studentId: role === 'STUDENT' ? '66001' : null },
  denied: null,
});

describe('GET /coop-plans/dashboard (#266)', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    signedInAs('STAFF');
  });

  it.each(['STAFF', 'ADMIN'])('allows %s and returns status counts + overdue plans from coop_plans', async (role) => {
    signedInAs(role);
    queryMock
      .mockResolvedValueOnce({ rows: [{ status: 'SUBMITTED', count: 3 }, { status: 'APPROVED', count: 2 }] })
      .mockResolvedValueOnce({ rows: [{
        plan_id: 14, student_id: '6609610001', first_name: 'สมชาย', last_name: 'ใจดี',
        status: 'PREPARING', period_name: '1/2569', company_name: 'บริษัท ตัวอย่าง',
        company_short_name: null, submission_deadline: '2026-11-20', days_overdue: 6,
      }] });

    const res = await getDashboardSummary({ routeKey: 'GET /coop-plans/dashboard' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ totalPlans: 5, overdueCount: 1 });
    expect(body.statusCounts).toMatchObject({ SUBMITTED: 3, APPROVED: 2, PREPARING: 0 });
    expect(body.overduePlans[0].plan_id).toBe(14);

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0][0]).toMatch(/FROM coop_plans GROUP BY status/);
    expect(queryMock.mock.calls[1][0]).toMatch(/p\.status NOT IN \('APPROVED', 'REJECTED'\)/);
    expect(queryMock.mock.calls[1][0]).toMatch(/sch\.end_date < \(NOW\(\) AT TIME ZONE 'Asia\/Bangkok'\)::date/);
  });

  it.each(['STUDENT', 'ADVISOR', 'COMMITTEE', 'UNKNOWN'])('refuses %s with 403 without querying DB', async (role) => {
    signedInAs(role);
    const res = await getDashboardSummary({ routeKey: 'GET /coop-plans/dashboard' });
    expect(res.statusCode).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns auth error status when unauthenticated', async () => {
    getAuthenticatedUserMock.mockResolvedValue({ user: null, denied: { status: 401, error: 'Unauthorized' } });
    const res = await getDashboardSummary({ routeKey: 'GET /coop-plans/dashboard' });
    expect(res.statusCode).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns 500 if database query fails', async () => {
    queryMock.mockRejectedValueOnce(new Error('db down'));
    const res = await getDashboardSummary({ routeKey: 'GET /coop-plans/dashboard' });
    expect(res.statusCode).toBe(500);
  });
});
