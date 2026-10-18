import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CoopPlanApiError,
  createCoopPlan,
  getCoopPlans,
  getCoopPlan,
  updateCoopPlan,
} from './coopPlanApi';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, statusText: 'OK', json: async () => body }) as unknown as Response;

const errorResponse = (status: number, statusText: string) =>
  ({ ok: false, status, statusText, json: async () => ({}) }) as unknown as Response;

describe('getCoopPlans', () => {
  it('sends the ID token as a Bearer Authorization header when given one', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await getCoopPlans({}, 'the-id-token');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).toMatchObject({ Authorization: 'Bearer the-id-token' });
  });

  it('sends no Authorization header when there is no token', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await getCoopPlans({});

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers ?? {}).not.toHaveProperty('Authorization');
  });

  it('throws on 401 instead of serving the bundled fallback data', async () => {
    // The fallback JSON holds every student's name, note and review comments,
    // so serving it after a 401 would hand that to an anonymous visitor.
    fetchMock.mockResolvedValue(errorResponse(401, 'Unauthorized'));

    await expect(getCoopPlans({})).rejects.toBeInstanceOf(CoopPlanApiError);
    await expect(getCoopPlans({})).rejects.toMatchObject({ status: 401 });
  });

  it('throws on 403 instead of serving the bundled fallback data', async () => {
    fetchMock.mockResolvedValue(errorResponse(403, 'Forbidden'));

    await expect(getCoopPlans({})).rejects.toMatchObject({ status: 403 });
  });

  it('throws on 500 rather than masking a server fault with stale data', async () => {
    fetchMock.mockResolvedValue(errorResponse(500, 'Internal Server Error'));

    await expect(getCoopPlans({})).rejects.toMatchObject({ status: 500 });
  });

  it('throws when the network fails rather than serving bundled plan data', async () => {
    // The fallback copy was itself the leak: coopPlansData.json carried every
    // student's id, name, note and review comment into the public JS bundle,
    // readable without signing in. An offline dev machine is not worth that.
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getCoopPlans({})).rejects.toThrow();
  });

  it('throws when the network fails on a single plan too', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getCoopPlan(1)).rejects.toThrow();
  });
});

describe('getCoopPlan', () => {
  it('sends the ID token as a Bearer Authorization header when given one', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ plan_id: 1 }));

    await getCoopPlan(1, 'the-id-token');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).toMatchObject({ Authorization: 'Bearer the-id-token' });
  });

  it('throws on 403 instead of serving the bundled plan', async () => {
    fetchMock.mockResolvedValue(errorResponse(403, 'Forbidden'));

    await expect(getCoopPlan(1)).rejects.toMatchObject({ status: 403 });
  });

  it('throws on 401 instead of serving the bundled plan', async () => {
    fetchMock.mockResolvedValue(errorResponse(401, 'Unauthorized'));

    await expect(getCoopPlan(1)).rejects.toMatchObject({ status: 401 });
  });
});

// A failed write answers with the API's { error, code, message } body.
const errorBody = (status: number, statusText: string, body: unknown) =>
  ({ ok: false, status, statusText, json: async () => body }) as unknown as Response;

// A gateway or authorizer error that is not JSON at all.
const errorWithoutBody = (status: number, statusText: string) =>
  ({
    ok: false,
    status,
    statusText,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    },
  }) as unknown as Response;

describe('createCoopPlan', () => {
  it('POSTs the period and position as JSON to /coop-plans', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ plan_id: 9 }));

    const plan = await createCoopPlan({ periodId: 'P2568-1', positionId: 'POS013' }, 'the-id-token');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/coop-plans$/);
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer the-id-token',
    });
    expect(JSON.parse(options.body)).toEqual({ periodId: 'P2568-1', positionId: 'POS013' });
    expect(plan).toEqual({ plan_id: 9 });
  });

  it('sends exactly the fields it is given: no student id is ever added to the body', async () => {
    // The API reads the owner from the token and refuses a body that names one.
    fetchMock.mockResolvedValue(jsonResponse({ plan_id: 9 }));

    await createCoopPlan({ periodId: 'P2568-1' }, 'the-id-token');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.keys(body)).toEqual(['periodId']);
  });

  it('sends no Authorization header when there is no token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ plan_id: 9 }));

    await createCoopPlan({ periodId: 'P2568-1' });

    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('throws with the status and the API reason code on a refusal', async () => {
    fetchMock.mockResolvedValue(
      errorBody(409, 'Conflict', {
        error: 'Conflict',
        code: 'ACTIVE_PLAN_EXISTS',
        message: 'You already have a plan in progress for this period.',
      }),
    );

    const err = await createCoopPlan({ periodId: 'P2568-1' }, 't').catch((e) => e);

    expect(err).toBeInstanceOf(CoopPlanApiError);
    expect(err).toMatchObject({ status: 409, code: 'ACTIVE_PLAN_EXISTS' });
  });

  it("keeps the API's English message out of the error, so it cannot reach the page", async () => {
    fetchMock.mockResolvedValue(
      errorBody(403, 'Forbidden', { error: 'Forbidden', code: 'FORBIDDEN', message: 'role ADVISOR may not create coop plans' }),
    );

    const err = await createCoopPlan({ periodId: 'P2568-1' }, 't').catch((e) => e);

    expect(err.message).not.toContain('ADVISOR');
  });

  it('still throws with the status when the error body is not JSON (gateway or authorizer)', async () => {
    fetchMock.mockResolvedValue(errorWithoutBody(401, 'Unauthorized'));

    const err = await createCoopPlan({ periodId: 'P2568-1' }).catch((e) => e);

    expect(err).toBeInstanceOf(CoopPlanApiError);
    expect(err).toMatchObject({ status: 401 });
    expect(err.code).toBeUndefined();
  });

  it('ignores a non-string code in the error body', async () => {
    fetchMock.mockResolvedValue(errorBody(500, 'Server Error', { code: 123 }));

    const err = await createCoopPlan({ periodId: 'P2568-1' }, 't').catch((e) => e);

    expect(err.code).toBeUndefined();
  });

  it('throws when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(createCoopPlan({ periodId: 'P2568-1' }, 't')).rejects.toThrow('Failed to fetch');
  });
});

describe('updateCoopPlan', () => {
  it('PATCHes only the given fields to /coop-plans/{planId}', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ plan_id: 7, student_note: 'hello' }));

    const plan = await updateCoopPlan(7, { studentNote: 'hello' }, 'the-id-token');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/coop-plans\/7$/);
    expect(options.method).toBe('PATCH');
    expect(options.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer the-id-token',
    });
    expect(JSON.parse(options.body)).toEqual({ studentNote: 'hello' });
    expect(plan).toMatchObject({ plan_id: 7 });
  });

  it('can send null to clear a field and false to uncheck one', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ plan_id: 7 }));

    await updateCoopPlan(7, { positionId: null, studentNote: null, termsAccepted: false }, 't');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      positionId: null,
      studentNote: null,
      termsAccepted: false,
    });
  });

  it.each([
    [400, 'Bad Request', 'SUBMISSION_FIELDS_LOCKED'],
    [403, 'Forbidden', 'FORBIDDEN'],
    [404, 'Not Found', 'POSITION_NOT_FOUND'],
    [409, 'Conflict', 'PLAN_NOT_EDITABLE'],
  ])('throws with status %i and the reason code %s', async (status, statusText, code) => {
    fetchMock.mockResolvedValue(errorBody(status, statusText, { error: statusText, code, message: 'x' }));

    const err = await updateCoopPlan(7, { studentNote: 'x' }, 't').catch((e) => e);

    expect(err).toBeInstanceOf(CoopPlanApiError);
    expect(err).toMatchObject({ status, code });
  });

  it('still throws with the status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(errorWithoutBody(403, 'Forbidden'));

    const err = await updateCoopPlan(7, { studentNote: 'x' }, 't').catch((e) => e);

    expect(err).toMatchObject({ status: 403 });
    expect(err.code).toBeUndefined();
  });

  it('throws when the network fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(updateCoopPlan(7, { studentNote: 'x' }, 't')).rejects.toThrow('Failed to fetch');
  });
});