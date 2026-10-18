import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
const getAuthenticatedUserMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

function signedInAs(user) {
  getAuthenticatedUserMock.mockResolvedValue({ user, denied: null });
}

function deniedWith(status, error) {
  getAuthenticatedUserMock.mockResolvedValue({ user: null, denied: { status, error } });
}

// Identity is mocked, authorize.mjs is not, so the role rules below are the real ones.
vi.mock('./auth.mjs', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

const { createCoopPlan } = await import('./createCoopPlan.mjs');

const STUDENT = { sub: 'sub-1', role: 'STUDENT', studentId: 'S001' };
const CREATED = { plan_id: 42, student_id: 'S001', period_id: 'P2568-1', position_id: 'POS013', status: 'PREPARING' };

const post = (body, extra = {}) => ({
  routeKey: 'POST /coop-plans',
  body: typeof body === 'string' || body === undefined ? body : JSON.stringify(body),
  ...extra,
});

const bodyOf = (result) => JSON.parse(result.body);

// INSERT answers first, then the read-back SELECT.
function insertSucceeds(row = CREATED) {
  queryMock
    .mockResolvedValueOnce({ rows: [{ plan_id: row.plan_id }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [row] });
}

function dbError(code, constraint) {
  return Object.assign(new Error(`db: ${code} secret-host`), { code, constraint });
}

describe('createCoopPlan', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    signedInAs(STUDENT);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('creates a PREPARING plan and answers 201 with the joined plan object', async () => {
    insertSucceeds();

    const result = await createCoopPlan(post({ periodId: 'P2568-1', positionId: 'POS013' }));

    expect(result.statusCode).toBe(201);
    expect(bodyOf(result)).toEqual(CREATED);
    expect(queryMock).toHaveBeenCalledTimes(2);
    // The read-back uses the id the INSERT returned.
    expect(queryMock.mock.calls[1][1]).toEqual([42]);
  });

  it('takes the owner from the verified identity, never from the request', async () => {
    insertSucceeds();

    await createCoopPlan(post({ periodId: 'P2568-1', positionId: 'POS013' }));

    const [text, values] = queryMock.mock.calls[0];
    expect(text).toMatch(/INSERT INTO coop_plans/);
    expect(values).toEqual(['S001', 'P2568-1', 'POS013']);
  });

  it('never writes a status: the column default (PREPARING) applies, so creating is not submitting', async () => {
    insertSucceeds();

    await createCoopPlan(post({ periodId: 'P2568-1' }));

    const [text] = queryMock.mock.calls[0];
    expect(text).not.toMatch(/status|submitted_at|terms_accepted_at/);
  });

  it('allows a draft without a position: positionId is stored as NULL', async () => {
    insertSucceeds({ ...CREATED, position_id: null });

    const result = await createCoopPlan(post({ periodId: 'P2568-1' }));

    expect(result.statusCode).toBe(201);
    expect(queryMock.mock.calls[0][1]).toEqual(['S001', 'P2568-1', null]);
  });

  it('treats positionId: null the same as omitting it', async () => {
    insertSucceeds({ ...CREATED, position_id: null });

    await createCoopPlan(post({ periodId: 'P2568-1', positionId: null }));

    expect(queryMock.mock.calls[0][1]).toEqual(['S001', 'P2568-1', null]);
  });

  it('trims ids before storing them', async () => {
    insertSucceeds();

    await createCoopPlan(post({ periodId: '  P2568-1 ', positionId: ' POS013 ' }));

    expect(queryMock.mock.calls[0][1]).toEqual(['S001', 'P2568-1', 'POS013']);
  });

  it('passes values as parameters, never interpolated into the SQL', async () => {
    insertSucceeds();

    await createCoopPlan(post({ periodId: "x';DROP TABLE a;--", positionId: 'POS013' }));

    const [text] = queryMock.mock.calls[0];
    expect(text).not.toContain('DROP TABLE');
    expect(text).toMatch(/VALUES \(\$1, \$2, \$3\)/);
  });

  it('reads a base64-encoded body', async () => {
    insertSucceeds();
    const encoded = Buffer.from(JSON.stringify({ periodId: 'P2568-1' })).toString('base64');

    const result = await createCoopPlan(post(encoded, { isBase64Encoded: true }));

    expect(result.statusCode).toBe(201);
    expect(queryMock.mock.calls[0][1][1]).toBe('P2568-1');
  });
});

describe('createCoopPlan authentication and authorization', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    signedInAs(STUDENT);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('401 without touching the DB when there is no authenticated user', async () => {
    deniedWith(401, 'Unauthorized');

    const result = await createCoopPlan(post({ periodId: 'P2568-1' }));

    expect(result.statusCode).toBe(401);
    expect(bodyOf(result)).toMatchObject({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('403 for a valid token whose account has no app_users row or is deactivated', async () => {
    deniedWith(403, 'Forbidden');

    const result = await createCoopPlan(post({ periodId: 'P2568-1' }));

    expect(result.statusCode).toBe(403);
    expect(bodyOf(result)).toMatchObject({ error: 'Forbidden', code: 'FORBIDDEN' });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('500, never 401, when identity resolution itself fails, and nothing leaks', async () => {
    getAuthenticatedUserMock.mockRejectedValue(new Error('relation "app_users" does not exist: secret-host'));

    const result = await createCoopPlan(post({ periodId: 'P2568-1' }));

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('secret-host');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it.each([
    ['ADVISOR', { sub: 'a-1', role: 'ADVISOR', studentId: null }],
    ['STAFF', { sub: 's-1', role: 'STAFF', studentId: null }],
    ['ADMIN', { sub: 'ad-1', role: 'ADMIN', studentId: null }],
    ['unknown role', { sub: 'x', role: 'SUPERUSER', studentId: 'S001' }],
  ])('%s: 403 and nothing is written', async (_name, user) => {
    signedInAs(user);

    const result = await createCoopPlan(post({ periodId: 'P2568-1' }));

    expect(result.statusCode).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('STUDENT account with no linked student_id: 403, not an ownerless plan', async () => {
    signedInAs({ ...STUDENT, studentId: null });

    const result = await createCoopPlan(post({ periodId: 'P2568-1' }));

    expect(result.statusCode).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('a caller with no right to create gets 403 even when the body is garbage (no validation hints)', async () => {
    signedInAs({ sub: 's-1', role: 'STAFF', studentId: null });

    const result = await createCoopPlan(post('not json'));

    expect(result.statusCode).toBe(403);
  });

  it.each(['studentId', 'student_id', 'ownerId', 'status', 'planId', 'reviewerName'])(
    'refuses a body that names %s: an owner or status is never accepted from the client',
    async (field) => {
      const result = await createCoopPlan(post({ periodId: 'P2568-1', [field]: 'S999' }));

      expect(result.statusCode).toBe(400);
      expect(bodyOf(result).code).toBe('UNKNOWN_FIELD');
      expect(queryMock).not.toHaveBeenCalled();
    },
  );
});

describe('createCoopPlan validation', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    signedInAs(STUDENT);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it.each([
    ['no body', undefined],
    ['empty body', ''],
    ['whitespace body', '   '],
    ['malformed JSON', '{periodId:'],
    ['a JSON array', '[]'],
    ['JSON null', 'null'],
    ['a JSON string', '"P2568-1"'],
    ['a JSON number', '7'],
  ])('400 INVALID_BODY for %s, and the DB is never touched', async (_name, body) => {
    const result = await createCoopPlan(post(body));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('INVALID_BODY');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', {}],
    ['null', { periodId: null }],
    ['empty', { periodId: '' }],
    ['whitespace', { periodId: '   ' }],
    ['a number', { periodId: 2568 }],
    ['an object', { periodId: { a: 1 } }],
    ['longer than VARCHAR(20)', { periodId: 'P'.repeat(21) }],
  ])('400 INVALID_FIELD when periodId is %s', async (_name, body) => {
    const result = await createCoopPlan(post(body));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('INVALID_FIELD');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it.each([
    ['empty', ''],
    ['whitespace', '  '],
    ['a number', 13],
    ['a boolean', true],
    ['longer than VARCHAR(10)', 'P'.repeat(11)],
  ])('400 INVALID_FIELD when positionId is %s', async (_name, positionId) => {
    const result = await createCoopPlan(post({ periodId: 'P2568-1', positionId }));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('INVALID_FIELD');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('every error body carries error, code and message', async () => {
    const result = await createCoopPlan(post({}));

    const body = bodyOf(result);
    expect(typeof body.error).toBe('string');
    expect(typeof body.code).toBe('string');
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);
  });
});

describe('createCoopPlan database errors', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
    signedInAs(STUDENT);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('409 ACTIVE_PLAN_EXISTS when the partial unique index rejects a second in-progress plan', async () => {
    queryMock.mockRejectedValueOnce(dbError('23505', 'uq_coop_plans_active_period'));

    const result = await createCoopPlan(post({ periodId: 'P2568-1' }));

    expect(result.statusCode).toBe(409);
    expect(bodyOf(result).code).toBe('ACTIVE_PLAN_EXISTS');
    expect(result.body).not.toContain('secret-host');
  });

  it('404 PERIOD_NOT_FOUND when the period does not exist', async () => {
    queryMock.mockRejectedValueOnce(dbError('23503', 'fk_coop_plans_period'));

    const result = await createCoopPlan(post({ periodId: 'NOPE' }));

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result).code).toBe('PERIOD_NOT_FOUND');
  });

  it('404 POSITION_NOT_FOUND when the position does not exist', async () => {
    queryMock.mockRejectedValueOnce(dbError('23503', 'fk_coop_plans_position'));

    const result = await createCoopPlan(post({ periodId: 'P2568-1', positionId: 'NOPE' }));

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result).code).toBe('POSITION_NOT_FOUND');
  });

  it('an unrecognised unique violation is a 500, not a mislabelled 409', async () => {
    queryMock.mockRejectedValueOnce(dbError('23505', 'some_other_index'));

    const result = await createCoopPlan(post({ periodId: 'P2568-1' }));

    expect(result.statusCode).toBe(500);
  });

  it('500 with a generic body when the INSERT throws, and nothing leaks', async () => {
    queryMock.mockRejectedValueOnce(new Error('connection refused: secret-host'));

    const result = await createCoopPlan(post({ periodId: 'P2568-1' }));

    expect(result.statusCode).toBe(500);
    expect(bodyOf(result).code).toBe('INTERNAL_ERROR');
    expect(result.body).not.toContain('secret-host');
  });

  it('500 when the plan cannot be read back after the INSERT', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ plan_id: 42 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] });

    const result = await createCoopPlan(post({ periodId: 'P2568-1' }));

    expect(result.statusCode).toBe(500);
  });
});
