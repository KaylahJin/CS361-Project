import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));

const {
  buildCoopPlanListFilter,
  assertCanViewPlan,
  buildStudentScope,
  studentColumnsFor,
  assertCanCreatePlan,
  assertCanEditPlan,
  ForbiddenError,
} = await import('./authorize.mjs');

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

describe('buildStudentScope', () => {
  beforeEach(() => queryMock.mockReset());

  it('STUDENT: narrows to their own student_id', async () => {
    const scope = await buildStudentScope(STUDENT);

    expect(scope.sql).toContain('s.student_id =');
    expect(scope.params).toEqual(['S001']);
  });

  it('STUDENT with no linked student record: refused, not silently empty', async () => {
    const orphan = { sub: 'sub-9', role: 'STUDENT', studentId: null };

    await expect(buildStudentScope(orphan)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('ADVISOR: narrows to the students assigned to their sub', async () => {
    const scope = await buildStudentScope(ADVISOR);

    expect(scope.sql).toContain('advisor_student_assignments');
    expect(scope.params).toEqual(['advisor-1']);
  });

  it('STAFF: no narrowing', async () => {
    const scope = await buildStudentScope(STAFF);

    expect(scope.sql).toBe('');
    expect(scope.params).toEqual([]);
  });

  it('ADMIN: no narrowing — the limit on an admin is which fields, not which rows', async () => {
    const scope = await buildStudentScope(ADMIN);

    expect(scope.sql).toBe('');
    expect(scope.params).toEqual([]);
  });

  it('a role this module has never heard of is refused', async () => {
    const stranger = { sub: 'sub-x', role: 'EMPLOYER_COORDINATOR', studentId: null };

    await expect(buildStudentScope(stranger)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('studentColumnsFor', () => {
  const sql = (user) => studentColumnsFor(user).columns.join(', ');

  it('STUDENT: their own row, every field', () => {
    const text = sql(STUDENT);

    expect(text).toContain('s.email');
    expect(text).toContain('birth_date');
    expect(text).toContain('gpa');
    expect(studentColumnsFor(STUDENT).includeCourses).toBe(true);
  });

  it('ADVISOR: contact and grades, but not a birth date', () => {
    const text = sql(ADVISOR);

    expect(text).toContain('s.email');
    expect(text).toContain('s.phone');
    expect(text).toContain('gpa');
    expect(text).not.toContain('birth_date');
    expect(studentColumnsFor(ADVISOR).includeCourses).toBe(true);
  });

  it('STAFF: contact and grades, but not a birth date either', () => {
    const text = sql(STAFF);

    expect(text).toContain('s.email');
    expect(text).toContain('gpa');
    expect(text).not.toContain('birth_date');
    expect(studentColumnsFor(STAFF).includeCourses).toBe(true);
  });

  it('ADMIN: identity only — no contact, no birth date, no grades', () => {
    const text = sql(ADMIN);

    expect(text).toContain('s.student_id');
    expect(text).toContain('s.first_name');
    expect(text).toContain('s.curriculum');
    expect(text).not.toContain('email');
    expect(text).not.toContain('phone');
    expect(text).not.toContain('birth_date');
    expect(text).not.toContain('gpa');
  });

  it('ADMIN: the courses table is not joined at all', () => {
    expect(studentColumnsFor(ADMIN).includeCourses).toBe(false);
  });

  it('every role gets the identity columns', () => {
    for (const user of [STUDENT, ADVISOR, STAFF, ADMIN]) {
      const text = sql(user);
      expect(text).toContain('s.student_id');
      expect(text).toContain('s.first_name');
      expect(text).toContain('s.last_name');
      expect(text).toContain('s.curriculum');
    }
  });

  it('a role this module has never heard of is refused', () => {
    const stranger = { sub: 'sub-x', role: 'EMPLOYER_COORDINATOR', studentId: null };

    expect(() => studentColumnsFor(stranger)).toThrow(ForbiddenError);
  });
});

describe('assertCanCreatePlan', () => {
  it('STUDENT linked to a student record: allowed', () => {
    expect(() => assertCanCreatePlan(STUDENT)).not.toThrow();
  });

  it.each([
    ['ADVISOR', ADVISOR],
    ['STAFF', STAFF],
    ['ADMIN', ADMIN],
    ['unknown role', { sub: 'x', role: 'SUPERUSER', studentId: 'S001' }],
  ])('%s: refused, even when a student_id is attached', (_name, user) => {
    expect(() => assertCanCreatePlan(user)).toThrow(ForbiddenError);
  });

  it('STUDENT with no linked student_id: refused rather than creating an ownerless plan', () => {
    expect(() => assertCanCreatePlan({ ...STUDENT, studentId: null })).toThrow(ForbiddenError);
  });
});

describe('assertCanEditPlan', () => {
  const plan = { plan_id: 1, student_id: 'S001' };

  it('STUDENT who owns the plan: allowed', () => {
    expect(() => assertCanEditPlan(STUDENT, plan)).not.toThrow();
  });

  it('STUDENT who does not own the plan: refused', () => {
    expect(() => assertCanEditPlan({ ...STUDENT, studentId: 'S999' }, plan)).toThrow(ForbiddenError);
  });

  it.each([
    ['ADVISOR', ADVISOR],
    ['STAFF', STAFF],
    ['ADMIN', ADMIN],
    ['unknown role', { sub: 'x', role: 'SUPERUSER', studentId: 'S001' }],
  ])('%s: refused even when their studentId happens to match the plan', (_name, user) => {
    expect(() => assertCanEditPlan({ ...user, studentId: 'S001' }, plan)).toThrow(ForbiddenError);
  });

  it('STUDENT with no linked student_id: refused', () => {
    expect(() => assertCanEditPlan({ ...STUDENT, studentId: null }, plan)).toThrow(ForbiddenError);
  });

  it('does a pure in-memory check: no database round trip, so nothing to cache or go stale', () => {
    queryMock.mockReset();
    assertCanEditPlan(STUDENT, plan);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
