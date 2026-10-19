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

// Identity is mocked, authorize.mjs is not, so the ownership rules below are the real ones.
vi.mock('./auth.mjs', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

const { updateCoopPlan, MAX_STUDENT_NOTE } = await import('./updateCoopPlan.mjs');

const STUDENT = { sub: 'sub-1', role: 'STUDENT', studentId: 'S001' };

const planIn = (status, extra = {}) => ({
  plan_id: 7,
  student_id: 'S001',
  period_id: 'P2568-1',
  position_id: null,
  status,
  review_comment: status === 'RETURNED' ? 'please fix the scope' : null,
  ...extra,
});

const patch = (body, planId = '7', extra = {}) => ({
  routeKey: 'PATCH /coop-plans/{planId}',
  pathParameters: { planId },
  body: typeof body === 'string' || body === undefined ? body : JSON.stringify(body),
  ...extra,
});

const bodyOf = (result) => JSON.parse(result.body);

/**
 * Queues the three queries of a successful edit: the SELECT that loads the
 * plan, the UPDATE, then the read-back SELECT.
 */
function planExists(before, after = before, { updateRowCount = 1 } = {}) {
  queryMock
    .mockResolvedValueOnce({ rows: [before] })
    .mockResolvedValueOnce({ rows: [{ plan_id: before.plan_id }], rowCount: updateRowCount })
    .mockResolvedValueOnce({ rows: [after] });
}

const updateCall = () => queryMock.mock.calls[1];
const setClause = (text) => text.split('WHERE')[0];

function dbError(code, constraint) {
  return Object.assign(new Error(`db: ${code} secret-host`), { code, constraint });
}

beforeEach(() => {
  queryMock.mockReset();
  getAuthenticatedUserMock.mockReset();
  signedInAs(STUDENT);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('updateCoopPlan', () => {
  it.each(['PREPARING', 'RETURNED'])('owner edits a %s plan: 200 with the updated plan', async (status) => {
    const after = planIn(status, { student_note: 'hello', position_id: 'POS013' });
    planExists(planIn(status), after);

    const result = await updateCoopPlan(patch({ studentNote: 'hello', positionId: 'POS013' }));

    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toEqual(after);
    expect(queryMock).toHaveBeenCalledTimes(3);
  });

  it('updates exactly the fields sent, with parameters', async () => {
    planExists(planIn('PREPARING'));

    await updateCoopPlan(patch({ positionId: 'POS013', studentNote: 'hello', acknowledgedPreCourse: true }));

    const [text, values] = updateCall();
    expect(setClause(text)).toMatch(/position_id = \$1/);
    expect(setClause(text)).toMatch(/student_note = \$2/);
    expect(setClause(text)).toMatch(/acknowledged_pre_course = \$3/);
    expect(setClause(text)).not.toMatch(/terms_accepted_at/);
    expect(values.slice(0, 3)).toEqual(['POS013', 'hello', true]);
  });

  it('a single-field edit leaves every other column alone', async () => {
    planExists(planIn('PREPARING'));

    await updateCoopPlan(patch({ studentNote: 'only this' }));

    const set = setClause(updateCall()[0]);
    expect(set).toMatch(/student_note/);
    expect(set).not.toMatch(/position_id|acknowledged_pre_course|terms_accepted_at/);
  });

  it('never writes status, period, submission or review columns: saving a draft is not submitting it', async () => {
    planExists(planIn('RETURNED'));

    await updateCoopPlan(patch({ studentNote: 'fixed', positionId: 'POS013', acknowledgedPreCourse: true, termsAccepted: true }));

    const set = setClause(updateCall()[0]);
    expect(set).not.toMatch(
      /status|period_id|submitted_at|reviewer_name|reviewed_at|review_comment|student_id|plan_id/,
    );
  });

  it('scopes the UPDATE to the caller and to editable statuses, so the write itself cannot touch anyone else or a locked plan', async () => {
    planExists(planIn('PREPARING'));

    await updateCoopPlan(patch({ studentNote: 'x' }));

    const [text, values] = updateCall();
    expect(text).toMatch(/WHERE plan_id = \$2\s+AND student_id = \$3\s+AND status = ANY\(\$4\)/);
    expect(values.slice(1)).toEqual([7, 'S001', ['PREPARING', 'RETURNED']]);
  });

  it('termsAccepted: true stamps the time on the server and keeps an earlier acceptance', async () => {
    planExists(planIn('PREPARING'));

    await updateCoopPlan(patch({ termsAccepted: true }));

    const [text, values] = updateCall();
    expect(setClause(text)).toMatch(/terms_accepted_at = COALESCE\(terms_accepted_at, NOW\(\)\)/);
    // No client-supplied timestamp is bound.
    expect(values).toEqual([7, 'S001', ['PREPARING', 'RETURNED']]);
  });

  it('termsAccepted: false clears the acceptance on a draft', async () => {
    planExists(planIn('PREPARING'));

    await updateCoopPlan(patch({ termsAccepted: false, acknowledgedPreCourse: false }));

    expect(setClause(updateCall()[0])).toMatch(/terms_accepted_at = NULL/);
    expect(updateCall()[1][0]).toBe(false);
  });

  it('null clears positionId and studentNote', async () => {
    planExists(planIn('PREPARING', { position_id: 'POS013', student_note: 'old' }));

    await updateCoopPlan(patch({ positionId: null, studentNote: null }));

    expect(updateCall()[1].slice(0, 2)).toEqual([null, null]);
  });

  it('a whitespace-only studentNote is stored as NULL; positionId is trimmed', async () => {
    planExists(planIn('PREPARING'));

    await updateCoopPlan(patch({ studentNote: '   ', positionId: ' POS013 ' }));

    expect(updateCall()[1].slice(0, 2)).toEqual(['POS013', null]);
  });

  it('accepts a note at the maximum length', async () => {
    planExists(planIn('PREPARING'));

    const result = await updateCoopPlan(patch({ studentNote: 'x'.repeat(MAX_STUDENT_NOTE) }));

    expect(result.statusCode).toBe(200);
  });

  it('a RETURNED plan stays RETURNED and keeps the reviewer comment after an edit', async () => {
    const before = planIn('RETURNED');
    planExists(before, { ...before, student_note: 'addressed' });

    const result = await updateCoopPlan(patch({ studentNote: 'addressed' }));

    expect(bodyOf(result)).toMatchObject({ status: 'RETURNED', review_comment: 'please fix the scope' });
  });

  it('reads a base64-encoded body', async () => {
    planExists(planIn('PREPARING'));
    const encoded = Buffer.from(JSON.stringify({ studentNote: 'hi' })).toString('base64');

    const result = await updateCoopPlan(patch(encoded, '7', { isBase64Encoded: true }));

    expect(result.statusCode).toBe(200);
    expect(updateCall()[1][0]).toBe('hi');
  });

  it('accepts a planId with surrounding whitespace and binds it as a number', async () => {
    planExists(planIn('PREPARING'));

    await updateCoopPlan(patch({ studentNote: 'x' }, ' 7 '));

    expect(queryMock.mock.calls[0][1]).toEqual([7]);
  });
});

describe('updateCoopPlan planId', () => {
  it.each(['', '   ', 'abc', '1; DROP TABLE coop_plans', '-5', '0', '1.5', '2147483648'])(
    '400 for planId %j, before identity is resolved and without touching the DB',
    async (planId) => {
      const result = await updateCoopPlan(patch({ studentNote: 'x' }, planId));

      expect(result.statusCode).toBe(400);
      expect(bodyOf(result).code).toBe('INVALID_PLAN_ID');
      expect(getAuthenticatedUserMock).not.toHaveBeenCalled();
      expect(queryMock).not.toHaveBeenCalled();
    },
  );

  it('400 when pathParameters is missing altogether', async () => {
    const result = await updateCoopPlan({ routeKey: 'PATCH /coop-plans/{planId}', pathParameters: null, body: '{}' });

    expect(result.statusCode).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('404 when the plan does not exist, and nothing is written', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const result = await updateCoopPlan(patch({ studentNote: 'x' }, '999'));

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result).code).toBe('PLAN_NOT_FOUND');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe('updateCoopPlan authentication and ownership', () => {
  it('401 without touching the DB when there is no authenticated user', async () => {
    deniedWith(401, 'Unauthorized');

    const result = await updateCoopPlan(patch({ studentNote: 'x' }));

    expect(result.statusCode).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('403 for a valid token whose account has no app_users row or is deactivated', async () => {
    deniedWith(403, 'Forbidden');

    const result = await updateCoopPlan(patch({ studentNote: 'x' }));

    expect(result.statusCode).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('500, never 401, when identity resolution itself fails', async () => {
    getAuthenticatedUserMock.mockRejectedValue(new Error('relation "app_users" does not exist: secret-host'));

    const result = await updateCoopPlan(patch({ studentNote: 'x' }));

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('secret-host');
  });

  it("STUDENT who does not own the plan: 403, nothing written, none of the plan's data in the body", async () => {
    signedInAs({ sub: 'sub-9', role: 'STUDENT', studentId: 'S999' });
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });

    const result = await updateCoopPlan(patch({ studentNote: 'hijack' }));

    expect(result.statusCode).toBe(403);
    expect(result.body).not.toContain('S001');
    expect(result.body).not.toContain('PREPARING');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('a non-owner learns nothing about the status: a SUBMITTED plan of someone else is 403, not 409', async () => {
    signedInAs({ sub: 'sub-9', role: 'STUDENT', studentId: 'S999' });
    queryMock.mockResolvedValueOnce({ rows: [planIn('SUBMITTED')] });

    const result = await updateCoopPlan(patch({ studentNote: 'x' }));

    expect(result.statusCode).toBe(403);
  });

  it('a student_id in the body cannot make someone else the owner: refused, and the UPDATE never runs', async () => {
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });

    const result = await updateCoopPlan(patch({ studentNote: 'x', student_id: 'S999' }));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('UNKNOWN_FIELD');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ADVISOR assigned to the student', { sub: 'a-1', role: 'ADVISOR', studentId: null }],
    ['STAFF', { sub: 's-1', role: 'STAFF', studentId: null }],
    ['ADMIN', { sub: 'ad-1', role: 'ADMIN', studentId: null }],
    ['unknown role with a matching studentId', { sub: 'x', role: 'SUPERUSER', studentId: 'S001' }],
  ])('%s: 403, because only the owning student edits a plan', async (_name, user) => {
    signedInAs(user);
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });

    const result = await updateCoopPlan(patch({ studentNote: 'x' }));

    expect(result.statusCode).toBe(403);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('STUDENT account with no linked student_id: 403', async () => {
    signedInAs({ ...STUDENT, studentId: null });
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });

    const result = await updateCoopPlan(patch({ studentNote: 'x' }));

    expect(result.statusCode).toBe(403);
  });

  it('403 comes before body validation: a non-owner sending garbage is told 403, not what is wrong with the body', async () => {
    signedInAs({ sub: 'sub-9', role: 'STUDENT', studentId: 'S999' });
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });

    const result = await updateCoopPlan(patch('not json'));

    expect(result.statusCode).toBe(403);
  });
});

describe('updateCoopPlan status rules', () => {
  it.each(['SUBMITTED', 'APPROVED', 'REJECTED'])(
    '409 PLAN_NOT_EDITABLE for a %s plan, and the UPDATE never runs',
    async (status) => {
      queryMock.mockResolvedValueOnce({ rows: [planIn(status)] });

      const result = await updateCoopPlan(patch({ studentNote: 'x' }));

      expect(result.statusCode).toBe(409);
      expect(bodyOf(result).code).toBe('PLAN_NOT_EDITABLE');
      expect(bodyOf(result).message).toContain(status);
      expect(queryMock).toHaveBeenCalledTimes(1);
    },
  );

  it('409 when the plan stops being editable between the SELECT and the UPDATE (zero rows updated)', async () => {
    planExists(planIn('PREPARING'), planIn('SUBMITTED'), { updateRowCount: 0 });

    const result = await updateCoopPlan(patch({ studentNote: 'x' }));

    expect(result.statusCode).toBe(409);
    expect(bodyOf(result).code).toBe('PLAN_NOT_EDITABLE');
    // No read-back of a row that was not changed.
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['acknowledgedPreCourse', { acknowledgedPreCourse: false }],
    ['termsAccepted', { termsAccepted: false }],
  ])('400 SUBMISSION_FIELDS_LOCKED when a RETURNED plan tries to withdraw %s', async (_name, body) => {
    queryMock.mockResolvedValueOnce({ rows: [planIn('RETURNED')] });

    const result = await updateCoopPlan(patch(body));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('SUBMISSION_FIELDS_LOCKED');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('a RETURNED plan may re-affirm the acknowledgement and terms (true)', async () => {
    planExists(planIn('RETURNED'));

    const result = await updateCoopPlan(patch({ acknowledgedPreCourse: true, termsAccepted: true }));

    expect(result.statusCode).toBe(200);
  });

  it('chk_coop_plans_submitted raised by the database is still a 400, not a 500 (status raced to RETURNED)', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [planIn('PREPARING')] })
      .mockRejectedValueOnce(dbError('23514', 'chk_coop_plans_submitted'));

    const result = await updateCoopPlan(patch({ termsAccepted: false }));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('SUBMISSION_FIELDS_LOCKED');
  });
});

describe('updateCoopPlan validation', () => {
  beforeEach(() => {
    queryMock.mockResolvedValueOnce({ rows: [planIn('PREPARING')] });
  });

  it.each([
    ['no body', undefined],
    ['empty body', ''],
    ['malformed JSON', '{studentNote:'],
    ['a JSON array', '[]'],
    ['JSON null', 'null'],
  ])('400 INVALID_BODY for %s', async (_name, body) => {
    const result = await updateCoopPlan(patch(body));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('INVALID_BODY');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('400 NO_EDITABLE_FIELDS for an empty object', async () => {
    const result = await updateCoopPlan(patch({}));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('NO_EDITABLE_FIELDS');
  });

  it.each([
    'status',
    'plan_id',
    'planId',
    'studentId',
    'student_id',
    'periodId',
    'period_id',
    'submittedAt',
    'submitted_at',
    'reviewerName',
    'reviewer_name',
    'reviewedAt',
    'reviewComment',
    'review_comment',
    'terms_accepted_at',
    '__proto__',
  ])('400 UNKNOWN_FIELD when the body names %s, and the UPDATE never runs', async (field) => {
    const body = `{"studentNote":"x","${field}":"APPROVED"}`;

    const result = await updateCoopPlan(patch(body));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('UNKNOWN_FIELD');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['positionId is a number', { positionId: 5 }],
    ['positionId is empty', { positionId: '' }],
    ['positionId is longer than VARCHAR(10)', { positionId: 'P'.repeat(11) }],
    ['studentNote is a number', { studentNote: 5 }],
    ['studentNote is over the length limit', { studentNote: 'x'.repeat(MAX_STUDENT_NOTE + 1) }],
    ['acknowledgedPreCourse is a string', { acknowledgedPreCourse: 'true' }],
    ['acknowledgedPreCourse is null', { acknowledgedPreCourse: null }],
    ['termsAccepted is a number', { termsAccepted: 1 }],
    ['termsAccepted is null', { termsAccepted: null }],
  ])('400 INVALID_FIELD when %s', async (_name, body) => {
    const result = await updateCoopPlan(patch(body));

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result).code).toBe('INVALID_FIELD');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe('updateCoopPlan database errors', () => {
  it('404 POSITION_NOT_FOUND when the new position does not exist', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [planIn('PREPARING')] })
      .mockRejectedValueOnce(dbError('23503', 'fk_coop_plans_position'));

    const result = await updateCoopPlan(patch({ positionId: 'NOPE' }));

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result).code).toBe('POSITION_NOT_FOUND');
    expect(result.body).not.toContain('secret-host');
  });

  it('500 with a generic body when loading the plan throws', async () => {
    queryMock.mockRejectedValueOnce(new Error('connection refused: secret-host'));

    const result = await updateCoopPlan(patch({ studentNote: 'x' }));

    expect(result.statusCode).toBe(500);
    expect(bodyOf(result).code).toBe('INTERNAL_ERROR');
    expect(result.body).not.toContain('secret-host');
  });

  it('500 with a generic body when the UPDATE throws', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [planIn('PREPARING')] })
      .mockRejectedValueOnce(new Error('deadlock detected: secret-host'));

    const result = await updateCoopPlan(patch({ studentNote: 'x' }));

    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('secret-host');
  });

  it('500 when the plan cannot be read back after the UPDATE', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [planIn('PREPARING')] })
      .mockResolvedValueOnce({ rows: [{ plan_id: 7 }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] });

    const result = await updateCoopPlan(patch({ studentNote: 'x' }));

    expect(result.statusCode).toBe(500);
  });
});
