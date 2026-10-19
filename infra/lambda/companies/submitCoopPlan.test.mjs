import { describe, it, expect, vi, beforeEach } from 'vitest';

const getAuthenticatedUserMock = vi.fn();

let db;

vi.mock('./db.mjs', () => ({
  getPool: () => db.pool,
}));

// Identity is mocked, authorize.mjs and the submission rules are not, so the
// ownership, status and eligibility rules below are the real ones.
vi.mock('./auth.mjs', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

const { submitCoopPlan } = await import('./submitCoopPlan.mjs');

const STUDENT = { sub: 'sub-1', role: 'STUDENT', studentId: 'S001' };

function signedInAs(user) {
  getAuthenticatedUserMock.mockResolvedValue({ user, denied: null });
}

function deniedWith(status, error) {
  getAuthenticatedUserMock.mockResolvedValue({
    user: null,
    denied: { status, error },
  });
}

const READY_PLAN = {
  plan_id: 7,
  student_id: 'S001',
  period_id: 'P2568-1',
  position_id: 'POS013',
  status: 'PREPARING',
  acknowledged_pre_course: true,
  terms_accepted_at: '2026-10-01T10:00:00Z',
  student_note: null,
  submitted_at: null,
  reviewer_name: null,
  reviewed_at: null,
  review_comment: null,
};

const OPEN_WINDOW = {
  start_date: '2026-10-01',
  end_date: '2026-10-31',
  is_open: true,
};

const CLOSED_WINDOW = {
  start_date: '2026-06-01',
  end_date: '2026-06-15',
  is_open: false,
};

/**
 * An in-memory stand-in for the database, routed by SQL text so the tests do
 * not depend on how many reads the handler makes. FOR UPDATE really queues:
 * the lock is held from that query until COMMIT/ROLLBACK/release, which is what
 * lets the concurrency test mean something.
 */
function makeDb(overrides = {}) {
  const state = {
    plan: { ...READY_PLAN },
    windows: [OPEN_WINDOW],
    student: {
      student_id: 'S001',
      curriculum: '66',
      gpa: 3.4,
    },
    minGpa: 2.75,
    failOn: null,
    updates: 0,
    log: [],
    connects: 0,
    releases: 0,
    ...overrides,
  };

  const passed = (course_code, grade_point = 3) => ({
    course_code,
    status: 'PASSED',
    grade_point,
  });

  // Mock student course records according to curriculum.
  // The actual production checks run through eligibility.mjs.
  state.studentCourses =
    state.student?.curriculum === '61'
      ? [
          passed('คพ.101'),
          passed('คพ.102'),
          passed('คพ.111'),
          passed('คพ.213'),
          passed('คพ.251'),
          passed('คพ.264'),
          {
            course_code: 'คพ.384',
            status: 'ENROLLED',
            grade_point: null,
          },
          passed('คพ.266'),
        ]
      : [
          passed('คพ.100'),
          passed('คพ.101'),
          passed('คพ.102'),
          passed('คพ.111'),
          passed('คพ.213'),
          passed('คพ.251'),
          passed('คพ.261'),
          {
            course_code: 'คพ.180',
            status: 'ENROLLED',
            grade_point: null,
          },
          passed('คพ.262'),
        ];

  let tail = Promise.resolve();

  const acquire = () => {
    let unlock;

    const mine = new Promise((resolve) => {
      unlock = resolve;
    });

    const prev = tail;
    tail = mine;

    return prev.then(() => unlock);
  };

  async function run(text, params, client) {
    const sql = text.trim();

    state.log.push({
      sql,
      params,
      tx: client !== null,
    });

    if (state.failOn && state.failOn.test(sql)) {
      throw new Error('connection to db-host.internal:5432 refused');
    }

    if (sql === 'BEGIN') {
      return { rows: [] };
    }

    if (sql === 'COMMIT' || sql === 'ROLLBACK') {
      client?.unlock?.();
      return { rows: [] };
    }

    if (/FOR UPDATE/.test(sql)) {
      client.unlock = await acquire();

      return {
        rows: state.plan ? [{ ...state.plan }] : [],
      };
    }

    if (/LEFT JOIN positions/.test(sql)) {
      return {
        rows: state.plan
          ? [
              {
                ...state.plan,
                first_name: 'A',
                position_title: 'Dev',
              },
            ]
          : [],
      };
    }

    if (/FROM coop_schedules/.test(sql)) {
      return { rows: state.windows };
    }

    if (/FROM students/.test(sql)) {
      return {
        rows: state.student ? [state.student] : [],
      };
    }

    if (/FROM coop_info/.test(sql)) {
      return {
        rows: [{ min_gpa: state.minGpa }],
      };
    }

    if (/FROM student_courses/.test(sql)) {
      return { rows: state.studentCourses };
    }

    if (/^UPDATE coop_plans/.test(sql)) {
      const [planId, studentId, statuses] = params;

      const matches =
        state.plan &&
        state.plan.plan_id === planId &&
        state.plan.student_id === studentId &&
        statuses.includes(state.plan.status);

      if (!matches) {
        return { rows: [], rowCount: 0 };
      }

      state.plan = {
        ...state.plan,
        status: 'SUBMITTED',
        submitted_at: '2026-10-19T03:00:00Z',
      };

      state.updates += 1;

      return {
        rows: [{ plan_id: planId }],
        rowCount: 1,
      };
    }

    throw new Error(`unexpected query: ${sql}`);
  }

  state.pool = {
    query: (text, params) => run(text, params, null),

    connect: async () => {
      state.connects += 1;

      const client = { unlock: null };

      client.query = (text, params) => run(text, params, client);

      client.release = () => {
        state.releases += 1;
        client.unlock?.();
      };

      return client;
    },
  };

  return state;
}

const post = (planId = '7', extra = {}) => ({
  routeKey: 'POST /coop-plans/{planId}/submit',
  pathParameters: { planId },
  ...extra,
});

const bodyOf = (result) => JSON.parse(result.body);

const txStatements = () =>
  db.log
    .filter((entry) => entry.tx)
    .map((entry) => entry.sql.split('\n')[0]);

const wroteAnything = () =>
  db.log.some((entry) => /^UPDATE/.test(entry.sql));

beforeEach(() => {
  getAuthenticatedUserMock.mockReset();

  db = makeDb();

  signedInAs(STUDENT);

  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('submitCoopPlan: success', () => {
  it.each(['PREPARING', 'RETURNED'])(
    'owner submits a complete %s plan: 200 with the plan now SUBMITTED',
    async (status) => {
      db = makeDb({
        plan: {
          ...READY_PLAN,
          status,
        },
      });

      const result = await submitCoopPlan(post());

      expect(result.statusCode).toBe(200);

      expect(bodyOf(result)).toMatchObject({
        plan_id: 7,
        status: 'SUBMITTED',
      });

      expect(bodyOf(result).submitted_at).toBeTruthy();
      expect(db.updates).toBe(1);
    },
  );

  it('runs the checks and the write in one transaction and commits it', async () => {
    await submitCoopPlan(post());

    const statements = txStatements();

    expect(statements[0]).toBe('BEGIN');
    expect(statements.at(-1)).toBe('COMMIT');

    expect(
      statements.some((s) => /FOR UPDATE|SELECT plan_id/.test(s)),
    ).toBe(true);

    expect(db.connects).toBe(1);
    expect(db.releases).toBe(1);
  });

  it('writes the identity from the token and only the allowed statuses into the UPDATE', async () => {
    await submitCoopPlan(post());

    const update = db.log.find((entry) =>
      /^UPDATE/.test(entry.sql),
    );

    expect(update.params).toEqual([
      7,
      'S001',
      ['PREPARING', 'RETURNED'],
    ]);

    expect(update.sql).toMatch(/status = 'SUBMITTED'/);
    expect(update.sql).toMatch(/submitted_at = NOW\(\)/);
  });

  it('a resubmission keeps the earlier review result: the UPDATE does not touch the review columns', async () => {
    await submitCoopPlan(post());

    const update = db.log.find((entry) =>
      /^UPDATE/.test(entry.sql),
    );

    const setClause = update.sql.split('WHERE')[0];

    expect(setClause).not.toMatch(
      /reviewer_name|reviewed_at|review_comment|student_id|period_id|position_id/,
    );
  });

  it('ignores any body or query: a student id sent in the request changes nothing', async () => {
    const result = await submitCoopPlan(
      post('7', {
        body: JSON.stringify({
          studentId: 'S999',
          student_id: 'S999',
          status: 'APPROVED',
        }),
        queryStringParameters: {
          student_id: 'S999',
        },
      }),
    );

    expect(result.statusCode).toBe(200);

    const update = db.log.find((entry) =>
      /^UPDATE/.test(entry.sql),
    );

    expect(update.params[1]).toBe('S001');

    expect(db.plan?.status ?? 'SUBMITTED').toBe('SUBMITTED');

    expect(
      db.log.every(
        (entry) =>
          !JSON.stringify(entry.params ?? []).includes('S999'),
      ),
    ).toBe(true);
  });
});

describe('submitCoopPlan: requests refused before anything is touched', () => {
  it('rejects a malformed plan id with 400 and no database access or sign-in lookup', async () => {
    const events = [
      ...['abc', '0', '-1', '1.5', '', '99999999999'].map(
        (planId) => post(planId),
      ),

      // post() defaults an undefined id to '7', so build these by hand.
      {
        routeKey: 'POST /coop-plans/{planId}/submit',
        pathParameters: {},
      },
      {
        routeKey: 'POST /coop-plans/{planId}/submit',
      },
    ];

    for (const event of events) {
      const result = await submitCoopPlan(event);

      expect(result.statusCode).toBe(400);
      expect(bodyOf(result).code).toBe('INVALID_PLAN_ID');
    }

    expect(getAuthenticatedUserMock).not.toHaveBeenCalled();
    expect(db.log).toHaveLength(0);
  });

  it('answers 401 when there is no identity', async () => {
    deniedWith(401, 'Unauthorized');

    const result = await submitCoopPlan(post());

    expect(result.statusCode).toBe(401);
    expect(bodyOf(result).code).toBe('UNAUTHORIZED');
    expect(db.log).toHaveLength(0);
  });

  it('answers 403 for an account with no app_users row or a deactivated one', async () => {
    deniedWith(403, 'Forbidden');

    const result = await submitCoopPlan(post());

    expect(result.statusCode).toBe(403);
    expect(db.log).toHaveLength(0);
  });

  it('answers 404 for a plan that does not exist', async () => {
    db = makeDb({ plan: null });

    const result = await submitCoopPlan(post('999'));

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result).code).toBe('PLAN_NOT_FOUND');
    expect(db.connects).toBe(0);
  });

  it("answers 403 for someone else's plan and starts no transaction", async () => {
    signedInAs({
      ...STUDENT,
      studentId: 'S999',
    });

    const result = await submitCoopPlan(post());

    expect(result.statusCode).toBe(403);
    expect(db.connects).toBe(0);
    expect(wroteAnything()).toBe(false);
  });

  it.each(['ADVISOR', 'STAFF', 'ADMIN'])(
    'answers 403 for a %s: reviewers and admins never submit',
    async (role) => {
      signedInAs({
        sub: 'sub-x',
        role,
        studentId: null,
      });

      const result = await submitCoopPlan(post());

      expect(result.statusCode).toBe(403);
      expect(db.connects).toBe(0);
    },
  );

  it('answers 403 for a student account that is not linked to a student record', async () => {
    signedInAs({
      ...STUDENT,
      studentId: null,
    });

    const result = await submitCoopPlan(post());

    expect(result.statusCode).toBe(403);
    expect(db.connects).toBe(0);
  });

  it('answers the plan lookup 404 before the ownership 403, like the other plan routes', async () => {
    db = makeDb({ plan: null });

    signedInAs({
      ...STUDENT,
      studentId: 'S999',
    });

    const result = await submitCoopPlan(post());

    expect(result.statusCode).toBe(404);
  });
});

describe('submitCoopPlan: status', () => {
  it('answers 409 ALREADY_SUBMITTED for a plan that is already waiting for review', async () => {
    db = makeDb({
      plan: {
        ...READY_PLAN,
        status: 'SUBMITTED',
        submitted_at: '2026-10-02T00:00:00Z',
      },
    });

    const result = await submitCoopPlan(post());

    expect(result.statusCode).toBe(409);
    expect(bodyOf(result).code).toBe('ALREADY_SUBMITTED');
    expect(db.connects).toBe(0);
    expect(wroteAnything()).toBe(false);
  });

  it.each(['APPROVED', 'REJECTED'])(
    'answers 409 PLAN_NOT_SUBMITTABLE for a final %s plan',
    async (status) => {
      db = makeDb({
        plan: {
          ...READY_PLAN,
          status,
        },
      });

      const result = await submitCoopPlan(post());

      expect(result.statusCode).toBe(409);
      expect(bodyOf(result).code).toBe('PLAN_NOT_SUBMITTABLE');
      expect(bodyOf(result).message).toContain(status);
      expect(wroteAnything()).toBe(false);
    },
  );

  it('answers 409 when the plan was submitted between the first read and the lock, and writes nothing', async () => {
    // The unlocked read sees PREPARING; by the time the lock is taken another
    // request has already moved the plan on.
    const racing = makeDb();

    const originalConnect = racing.pool.connect;

    racing.pool.connect = async () => {
      racing.plan = {
        ...racing.plan,
        status: 'SUBMITTED',
      };

      return originalConnect();
    };

    db = racing;

    const result = await submitCoopPlan(post());

    expect(result.statusCode).toBe(409);
    expect(bodyOf(result).code).toBe('ALREADY_SUBMITTED');
    expect(racing.updates).toBe(0);
    expect(txStatements().at(-1)).toBe('ROLLBACK');
    expect(racing.releases).toBe(1);
  });

  it('answers 404 when the plan disappears between the first read and the lock', async () => {
    const racing = makeDb();

    const originalConnect = racing.pool.connect;

    racing.pool.connect = async () => {
      racing.plan = null;
      return originalConnect();
    };

    db = racing;

    const result = await submitCoopPlan(post());

    expect(result.statusCode).toBe(404);
    expect(racing.releases).toBe(1);
  });
});

describe('submitCoopPlan: requirements', () => {
  const failureCodes = (result) =>
    bodyOf(result).failures.map((failure) => failure.code);

  async function expectRefused(result) {
    expect(result.statusCode).toBe(400);

    expect(bodyOf(result).code).toBe(
      'SUBMISSION_REQUIREMENTS_NOT_MET',
    );

    expect(bodyOf(result).message).toBeTruthy();
    expect(wroteAnything()).toBe(false);
    expect(txStatements().at(-1)).toBe('ROLLBACK');
    expect(txStatements()).not.toContain('COMMIT');
    expect(db.releases).toBe(1);
  }

  it.each([
    ['position_id', null, 'POSITION_REQUIRED'],
    [
      'acknowledged_pre_course',
      false,
      'PRE_COURSE_NOT_ACKNOWLEDGED',
    ],
    ['terms_accepted_at', null, 'TERMS_NOT_ACCEPTED'],
    ['period_id', null, 'PERIOD_REQUIRED'],
  ])(
    'refuses a plan with %s missing and names the reason',
    async (column, value, code) => {
      db = makeDb({
        plan: {
          ...READY_PLAN,
          [column]: value,
        },
      });

      const result = await submitCoopPlan(post());

      await expectRefused(result);
      expect(failureCodes(result)).toContain(code);
    },
  );

  it('refuses a student below the GPA minimum', async () => {
    db = makeDb({
      student: {
        student_id: 'S001',
        curriculum: '66',
        gpa: 2.6,
      },
    });

    const result = await submitCoopPlan(post());

    await expectRefused(result);

    expect(failureCodes(result)).toEqual([
      'GPA_BELOW_MINIMUM',
    ]);

    expect(bodyOf(result).failures[0]).toMatchObject({
      required: 2.75,
      actual: 2.6,
    });
  });

  it('refuses a student with no GPA on record', async () => {
    db = makeDb({
      student: {
        student_id: 'S001',
        curriculum: '66',
        gpa: null,
      },
    });

    const result = await submitCoopPlan(post());

    await expectRefused(result);

    expect(failureCodes(result)).toEqual([
      'GPA_MISSING',
    ]);
  });

  it('refuses a student whose required curriculum courses are missing', async () => {
    db = makeDb({ studentCourses: [] });

    // Override after makeDb's curriculum-based defaults to simulate
    // a student with no course history.
    db.studentCourses = [];

    const result = await submitCoopPlan(post());

    await expectRefused(result);

    expect(failureCodes(result)).toContain(
      'REQUIRED_COURSES_MISSING',
    );

    expect(failureCodes(result)).toContain(
      'ONGOING_OR_STUDIED_COURSE_MISSING',
    );
  });

  it('refuses outside the submission window', async () => {
    db = makeDb({
      windows: [CLOSED_WINDOW],
    });

    const result = await submitCoopPlan(post());

    await expectRefused(result);

    expect(failureCodes(result)).toEqual([
      'SUBMISSION_WINDOW_CLOSED',
    ]);
  });

  it('refuses when the period has no submission window defined', async () => {
    db = makeDb({
      windows: [],
    });

    const result = await submitCoopPlan(post());

    await expectRefused(result);

    expect(failureCodes(result)).toEqual([
      'SUBMISSION_WINDOW_NOT_DEFINED',
    ]);
  });

  it('reports every failure in one answer: incomplete, ineligible and out of window together', async () => {
    db = makeDb({
      plan: {
        ...READY_PLAN,
        position_id: null,
        terms_accepted_at: null,
      },
      student: {
        student_id: 'S001',
        curriculum: '66',
        gpa: 2.0,
      },
      windows: [CLOSED_WINDOW],
    });

    const result = await submitCoopPlan(post());

    await expectRefused(result);

    expect(failureCodes(result)).toEqual([
      'POSITION_REQUIRED',
      'TERMS_NOT_ACCEPTED',
      'SUBMISSION_WINDOW_CLOSED',
      'GPA_BELOW_MINIMUM',
    ]);
  });

  it('applies the same checks to a resubmission after RETURNED', async () => {
    db = makeDb({
      plan: {
        ...READY_PLAN,
        status: 'RETURNED',
      },
      student: {
        student_id: 'S001',
        curriculum: '66',
        gpa: 2.0,
      },
    });

    const result = await submitCoopPlan(post());

    await expectRefused(result);

    expect(failureCodes(result)).toEqual([
      'GPA_BELOW_MINIMUM',
    ]);
  });

  it('does not look for a window when the plan has no period, and still answers', async () => {
    db = makeDb({
      plan: {
        ...READY_PLAN,
        period_id: null,
      },
    });

    const result = await submitCoopPlan(post());

    await expectRefused(result);

    expect(failureCodes(result)).toEqual([
      'PERIOD_REQUIRED',
    ]);

    expect(
      db.log.some((entry) =>
        /FROM coop_schedules/.test(entry.sql),
      ),
    ).toBe(false);
  });
});

describe('submitCoopPlan: duplicates and concurrency', () => {
  it('a second submit of the same plan after a success is refused with 409', async () => {
    const first = await submitCoopPlan(post());
    const second = await submitCoopPlan(post());

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(409);

    expect(bodyOf(second).code).toBe('ALREADY_SUBMITTED');
    expect(db.updates).toBe(1);
  });

  it('simultaneous submits of one plan: exactly one wins, the rest get 409, one UPDATE runs', async () => {
    const results = await Promise.all(
      Array.from(
        { length: 8 },
        () => submitCoopPlan(post()),
      ),
    );

    const statuses = results
      .map((result) => result.statusCode)
      .sort();

    expect(statuses).toEqual([
      200,
      409,
      409,
      409,
      409,
      409,
      409,
      409,
    ]);

    expect(db.updates).toBe(1);
    expect(db.releases).toBe(db.connects);
    expect(db.plan.status).toBe('SUBMITTED');
  });

  it('simultaneous resubmits after RETURNED behave the same way', async () => {
    db = makeDb({
      plan: {
        ...READY_PLAN,
        status: 'RETURNED',
      },
    });

    const results = await Promise.all([
      submitCoopPlan(post()),
      submitCoopPlan(post()),
    ]);

    expect(
      results.map((result) => result.statusCode).sort(),
    ).toEqual([200, 409]);

    expect(db.updates).toBe(1);
  });
});

describe('submitCoopPlan: failures', () => {
  it('rolls back, releases the connection and answers a generic 500 when a query fails mid-transaction', async () => {
    db = makeDb({
      failOn: /FROM coop_schedules/,
    });

    const result = await submitCoopPlan(post());

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('db-host.internal');

    expect(bodyOf(result).code).toBe('INTERNAL_ERROR');

    expect(txStatements().at(-1)).toBe('ROLLBACK');
    expect(db.releases).toBe(1);
    expect(wroteAnything()).toBe(false);
  });

  it('answers a generic 500 when the first read fails', async () => {
    db = makeDb({
      failOn: /LEFT JOIN positions/,
    });

    const result = await submitCoopPlan(post());

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('db-host.internal');
    expect(db.connects).toBe(0);
  });
});