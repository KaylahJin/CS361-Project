import { describe, it, expect, vi, beforeEach } from 'vitest';

const clientQueryMock = vi.fn();
const releaseMock = vi.fn();
const poolQueryMock = vi.fn();
const getAuthenticatedUserMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({
    query: poolQueryMock,
    connect: async () => ({
      query: clientQueryMock,
      release: releaseMock,
    }),
  }),
}));

function signedInAs(user) {
  getAuthenticatedUserMock.mockResolvedValue({ user, denied: null });
}

function deniedWith(status, error) {
  getAuthenticatedUserMock.mockResolvedValue({ user: null, denied: { status, error } });
}

vi.mock('./auth.mjs', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

const { reviewCoopPlan } = await import('./reviewCoopPlan.mjs');

const STAFF = { sub: 'staff-1', role: 'STAFF', studentId: null };
const ADVISOR = { sub: 'advisor-1', role: 'ADVISOR', studentId: null };
const STUDENT = { sub: 'student-1', role: 'STUDENT', studentId: '6600000001' };
const ADMIN = { sub: 'admin-1', role: 'ADMIN', studentId: null };

describe('reviewCoopPlan', () => {
  beforeEach(() => {
    clientQueryMock.mockReset();
    releaseMock.mockReset();
    poolQueryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    signedInAs(STAFF);
  });

  it('STAFF approves a SUBMITTED plan: returns 200 and records decision in both tables', async () => {
    const plan = { plan_id: 10, student_id: '6600000001', status: 'SUBMITTED' };

    clientQueryMock.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
        return { rows: [plan] };
      }
      return { rowCount: 1, rows: [] };
    });

    const event = {
      pathParameters: { planId: '10' },
      body: JSON.stringify({ decision: 'APPROVED', comment: 'All criteria satisfied' }),
      requestContext: {
        authorizer: { jwt: { claims: { name: 'Staff Reviewer' } } },
      },
    };

    const res = await reviewCoopPlan(event);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.status).toBe('APPROVED');
    expect(body.reviewer_name).toBe('Staff Reviewer');

    // Verify commit and queries
    const calls = clientQueryMock.mock.calls.map((c) => c[0]);
    expect(calls).toContain('BEGIN');
    expect(calls).toContain('COMMIT');
    expect(calls.some((c) => typeof c === 'string' && c.includes('UPDATE coop_plans'))).toBe(true);
    expect(calls.some((c) => typeof c === 'string' && c.includes('INSERT INTO plan_reviews'))).toBe(true);
    expect(releaseMock).toHaveBeenCalled();
  });

  it('STAFF returns a SUBMITTED plan with mandatory comment: returns 200', async () => {
    const plan = { plan_id: 10, student_id: '6600000001', status: 'SUBMITTED' };

    clientQueryMock.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
        return { rows: [plan] };
      }
      return { rowCount: 1, rows: [] };
    });

    const event = {
      pathParameters: { planId: '10' },
      body: JSON.stringify({ decision: 'RETURNED', comment: 'Please update company description' }),
    };

    const res = await reviewCoopPlan(event);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('RETURNED');
  });

  it('STAFF rejects a SUBMITTED plan with comment: returns 200', async () => {
    const plan = { plan_id: 10, student_id: '6600000001', status: 'SUBMITTED' };

    clientQueryMock.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
        return { rows: [plan] };
      }
      return { rowCount: 1, rows: [] };
    });

    const event = {
      pathParameters: { planId: '10' },
      body: JSON.stringify({ decision: 'REJECTED', comment: 'Student does not meet prerequisite requirements' }),
    };

    const res = await reviewCoopPlan(event);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('REJECTED');
  });

  it('ADVISOR assigned to the student can review plan: returns 200', async () => {
    signedInAs(ADVISOR);
    const plan = { plan_id: 10, student_id: '6600000001', status: 'SUBMITTED' };

    clientQueryMock.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
        return { rows: [plan] };
      }
      if (typeof sql === 'string' && sql.includes('advisor_student_assignments')) {
        return { rows: [{ student_id: '6600000001' }] };
      }
      return { rowCount: 1, rows: [] };
    });

    const event = {
      pathParameters: { planId: '10' },
      body: JSON.stringify({ decision: 'APPROVED' }),
    };

    const res = await reviewCoopPlan(event);
    expect(res.statusCode).toBe(200);
  });

  it('ADVISOR not assigned to the student is refused with 403 Forbidden', async () => {
    signedInAs(ADVISOR);
    const plan = { plan_id: 10, student_id: '6600000001', status: 'SUBMITTED' };

    clientQueryMock.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
        return { rows: [plan] };
      }
      if (typeof sql === 'string' && sql.includes('advisor_student_assignments')) {
        return { rows: [] }; // not assigned
      }
      return { rowCount: 1, rows: [] };
    });

    const event = {
      pathParameters: { planId: '10' },
      body: JSON.stringify({ decision: 'APPROVED' }),
    };

    const res = await reviewCoopPlan(event);
    expect(res.statusCode).toBe(403);
    const calls = clientQueryMock.mock.calls.map((c) => c[0]);
    expect(calls).toContain('ROLLBACK');
  });

  it('STUDENT role cannot review plans and is refused with 403 Forbidden', async () => {
    signedInAs(STUDENT);
    const plan = { plan_id: 10, student_id: '6600000001', status: 'SUBMITTED' };

    clientQueryMock.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
        return { rows: [plan] };
      }
      return { rowCount: 1, rows: [] };
    });

    const event = {
      pathParameters: { planId: '10' },
      body: JSON.stringify({ decision: 'APPROVED' }),
    };

    const res = await reviewCoopPlan(event);
    expect(res.statusCode).toBe(403);
  });

  it('ADMIN role cannot review plans directly and is refused with 403 Forbidden', async () => {
    signedInAs(ADMIN);
    const plan = { plan_id: 10, student_id: '6600000001', status: 'SUBMITTED' };

    clientQueryMock.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
        return { rows: [plan] };
      }
      return { rowCount: 1, rows: [] };
    });

    const event = {
      pathParameters: { planId: '10' },
      body: JSON.stringify({ decision: 'APPROVED' }),
    };

    const res = await reviewCoopPlan(event);
    expect(res.statusCode).toBe(403);
  });

  it('returns 409 Conflict when the plan is not in SUBMITTED status (Concurrency control)', async () => {
    const alreadyApprovedPlan = { plan_id: 10, student_id: '6600000001', status: 'APPROVED' };

    clientQueryMock.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
        return { rows: [alreadyApprovedPlan] };
      }
      return { rowCount: 1, rows: [] };
    });

    const event = {
      pathParameters: { planId: '10' },
      body: JSON.stringify({ decision: 'APPROVED' }),
    };

    const res = await reviewCoopPlan(event);
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/Conflict/);
    expect(body.currentStatus).toBe('APPROVED');
    const calls = clientQueryMock.mock.calls.map((c) => c[0]);
    expect(calls).toContain('ROLLBACK');
  });

  it('returns 404 when plan is not found', async () => {
    clientQueryMock.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
      if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
        return { rows: [] };
      }
      return { rowCount: 1, rows: [] };
    });

    const event = {
      pathParameters: { planId: '9999' },
      body: JSON.stringify({ decision: 'APPROVED' }),
    };

    const res = await reviewCoopPlan(event);
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when decision is invalid', async () => {
    const event = {
      pathParameters: { planId: '10' },
      body: JSON.stringify({ decision: 'INVALID_STATUS' }),
    };

    const res = await reviewCoopPlan(event);
    expect(res.statusCode).toBe(400);
    expect(clientQueryMock).not.toHaveBeenCalled();
  });

  it('returns 400 when comment is missing for RETURNED or REJECTED', async () => {
    for (const decision of ['RETURNED', 'REJECTED']) {
      const event = {
        pathParameters: { planId: '10' },
        body: JSON.stringify({ decision, comment: '   ' }),
      };

      const res = await reviewCoopPlan(event);
      expect(res.statusCode).toBe(400);
      expect(clientQueryMock).not.toHaveBeenCalled();
    }
  });

  it('returns 400 for non-numeric planId', async () => {
    const event = {
      pathParameters: { planId: 'invalid-id' },
      body: JSON.stringify({ decision: 'APPROVED' }),
    };

    const res = await reviewCoopPlan(event);
    expect(res.statusCode).toBe(400);
    expect(clientQueryMock).not.toHaveBeenCalled();
  });

  it('answers 401 when the caller carries no token at all', async () => {
    deniedWith(401, 'Unauthorized');

    const res = await reviewCoopPlan({
      pathParameters: { planId: '10' },
      body: JSON.stringify({ decision: 'APPROVED' }),
    });

    expect(res.statusCode).toBe(401);
    expect(clientQueryMock).not.toHaveBeenCalled();
  });
});
