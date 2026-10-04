import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { getPositionById } = await import('./getPositionById.mjs');

describe('getPositionById', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('returns 400 if positionId is missing or empty', async () => {
    const event = { pathParameters: { positionId: '' } };
    const result = await getPositionById(event);

    expect(queryMock).not.toHaveBeenCalled();
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ error: 'positionId is required' });
  });

  it('returns 404 if position is not found in database', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    const event = { pathParameters: { positionId: 'POS999' } };
    const result = await getPositionById(event);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({ error: 'Position not found' });
  });

  it('returns 200 with position data when found', async () => {
    const position = {
      position_id: 'POS001',
      company_id: 'C18',
      title: 'Programmer',
      category: 'software_development',
      company_name: 'บริษัท ปูนซิเมนต์ไทย จำกัด (มหาชน)',
    };
    queryMock.mockResolvedValue({ rows: [position] });

    const event = { pathParameters: { positionId: 'POS001' } };
    const result = await getPositionById(event);

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][1]).toEqual(['POS001']);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual(position);
  });

  it('returns 500 when database query throws error', async () => {
    queryMock.mockRejectedValue(new Error('Connection error'));

    const event = { pathParameters: { positionId: 'POS001' } };
    const result = await getPositionById(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({ error: 'Internal server error' });
  });
});
