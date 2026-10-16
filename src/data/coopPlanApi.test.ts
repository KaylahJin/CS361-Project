import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CoopPlanApiError, getCoopPlans, getCoopPlan } from './coopPlanApi';

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

  it('still falls back to local data when the network itself fails', async () => {
    // An offline dev machine is what the fallback exists for, and it says
    // nothing about authorization.
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const plans = await getCoopPlans({});

    expect(Array.isArray(plans)).toBe(true);
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
