import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const { buildCoopPlanListFilter, assertCanViewPlan, ForbiddenError } =
  await import('./authorize.mjs');

const STUDENT = { sub: 'sub-1', role: 'STUDENT', studentId: 'S001' };
const ADVISOR = { sub: 'advisor-1', role: 'ADVISOR', studentId: null };
const STAFF = { sub: 'staff-1', role: 'STAFF', studentId: null };
const ADMIN = { sub: 'admin-1', role: 'ADMIN', studentId: null };

describe('buildCoopPlanListFilter', () => {
  beforeEach(() => queryMock.mockReset());

  it('STUDENT: filters to their own student_id', async () => {
    const filter = await buildCoopPlanListFilter(STUDENT);

    expect(filter.sql).toContain('p.student_id =');
    expect(filter.params).toEqual(['S001']);
  });

  it('ADVISOR: filters to the students assigned to their sub', async () => {
    const filter = await buildCoopPlanListFilter(ADVISOR);

    expect(filter.sql).toContain('advisor_student_assignments');
    expect(filter.params).toEqual(['advisor-1']);
  });

  it('STAFF: no filter at all', async () => {
    const filter = await buildCoopPlanListFilter(STAFF);

    expect(filter.sql).toBe('');
    expect(filter.params).toEqual([]);
  });

  it('ADMIN: throws ForbiddenError rather than falling through to a permissive default', async () => {
    await expect(buildCoopPlanListFilter(ADMIN)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('unknown role: throws ForbiddenError (deny by default)', async () => {
    await expect(
      buildCoopPlanListFilter({ sub: 'x', role: 'SUPERUSER', studentId: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('STUDENT with no linked student_id: throws rather than filtering on null', async () => {
    // A null student_id would make `p.student_id = NULL` match no rows in
    // SQL, which looks like "an empty list" instead of the misconfigured
    // account it actually is.
    await expect(
      buildCoopPlanListFilter({ sub: 'sub-9', role: 'STUDENT', studentId: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('assertCanViewPlan', () => {
  beforeEach(() => queryMock.mockReset());

  it('STUDENT owner: resolves', async () => {
    await expect(assertCanViewPlan(STUDENT, { student_id: 'S001' })).resolves.toBeUndefined();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('STUDENT non-owner: throws ForbiddenError', async () => {
    await expect(assertCanViewPlan(STUDENT, { student_id: 'S999' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('ADVISOR assigned to that student: resolves', async () => {
    queryMock.mockResolvedValue({ rows: [{ student_id: 'S002' }] });

    await expect(assertCanViewPlan(ADVISOR, { student_id: 'S002' })).resolves.toBeUndefined();
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('advisor_student_assignments'), [
      'advisor-1',
      'S002',
    ]);
  });

  it('ADVISOR not assigned: throws ForbiddenError', async () => {
    queryMock.mockResolvedValue({ rows: [] });

    await expect(assertCanViewPlan(ADVISOR, { student_id: 'S999' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('ADVISOR: re-queries the assignment on every call, never caching a revoked one', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ student_id: 'S002' }] });
    await assertCanViewPlan(ADVISOR, { student_id: 'S002' });

    // Assignment revoked between requests.
    queryMock.mockResolvedValueOnce({ rows: [] });
    await expect(assertCanViewPlan(ADVISOR, { student_id: 'S002' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('STAFF: resolves for any student without querying', async () => {
    await expect(assertCanViewPlan(STAFF, { student_id: 'anyone' })).resolves.toBeUndefined();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('ADMIN without a reviewer role: throws ForbiddenError', async () => {
    await expect(assertCanViewPlan(ADMIN, { student_id: 'S001' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('unknown role: throws ForbiddenError (deny by default)', async () => {
    await expect(
      assertCanViewPlan({ sub: 'x', role: 'SUPERUSER', studentId: null }, { student_id: 'S001' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
