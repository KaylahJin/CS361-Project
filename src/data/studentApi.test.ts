import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStudents, getStudent } from './studentApi';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, statusText: 'OK', json: async () => body }) as unknown as Response;

const errorResponse = (status: number, statusText: string) =>
  ({ ok: false, status, statusText, json: async () => ({}) }) as unknown as Response;

describe('getStudents', () => {
  it('sends the ID token as a Bearer Authorization header when given one', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await getStudents(undefined, 'the-id-token');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).toMatchObject({ Authorization: 'Bearer the-id-token' });
  });

  it('sends no Authorization header when there is no token', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    await getStudents();

    const [, options] = fetchMock.mock.calls[0];
    expect(options?.headers).toBeUndefined();
  });

  it('reports the status so the page can tell 401 from 403', async () => {
    for (const status of [401, 403]) {
      fetchMock.mockResolvedValue(errorResponse(status, 'denied'));

      await expect(getStudents()).rejects.toMatchObject({ status });
    }
  });
});

describe('getStudent', () => {
  it('sends the ID token as a Bearer Authorization header when given one', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ student_id: '6600000001' }));

    await getStudent('6600000001', 'the-id-token');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).toMatchObject({ Authorization: 'Bearer the-id-token' });
  });

  it('reports a 404 so a student outside the caller scope reads as not found', async () => {
    fetchMock.mockResolvedValue(errorResponse(404, 'Not Found'));

    await expect(getStudent('6100000001')).rejects.toMatchObject({ status: 404 });
  });
});
