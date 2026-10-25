import { describe, it, expect, vi } from 'vitest';

import {
  checkEligibility,
  gpaFailures,
  courseFailures,
} from './eligibility.mjs';

const PERIOD_ID = 'COOP-2569-01';

const passed = (course_code, grade_point = 3) => ({
  course_code,
  status: 'PASSED',
  grade_point,
});

const valid66Courses = (gradePoint = 3) => [
  passed('คพ.100', gradePoint),
  passed('คพ.101', gradePoint),
  passed('คพ.102', gradePoint),
  passed('คพ.111', gradePoint),
  passed('คพ.213', gradePoint),
  passed('คพ.251', gradePoint),
  passed('คพ.261', gradePoint),
  {
    course_code: 'คพ.180',
    status: 'ENROLLED',
    grade_point: null,
  },
  passed('คพ.262', gradePoint),
];

function clientFor({
  student = {
    student_id: 'S01',
    curriculum: '66',
    gpa: 3.2,
  },
  minGpa = 2.8,
  minGroupGpa = 2.5,
  capacity = 2,
  courses = valid66Courses(),
  periods,
} = {}) {
  return {
    query: vi.fn(async (sql, params) => {
      if (/FROM periods/.test(sql)) {
        const periodId = params?.[0];

        if (periods) {
          const criteria = periods[periodId];

          return {
            rows: criteria ? [{
              min_gpa: criteria.min_gpa,
              min_group_gpa: criteria.min_group_gpa,
              capacity: criteria.capacity,
            }] : [],
          };
        }

        return {
          rows: [{
            min_gpa: minGpa,
            min_group_gpa: minGroupGpa,
            capacity,
          }],
        };
      }

      if (/FROM students/.test(sql)) {
        return {
          rows: student ? [student] : [],
        };
      }

      if (/FROM student_courses/.test(sql)) {
        return { rows: courses };
      }

      throw new Error(`Unexpected query: ${sql}`);
    }),
  };
}

describe('gpaFailures', () => {
  it('passes when overall GPA is above the period minimum', () => {
    expect(gpaFailures(3.2, 2.8)).toEqual([]);
  });

  it('fails when overall GPA equals the period minimum', () => {
    expect(gpaFailures(2.8, 2.8)).toMatchObject([
      {
        code: 'GPA_BELOW_MINIMUM',
        required: 2.8,
        actual: 2.8,
      },
    ]);
  });

  it('passes when overall GPA is just above the minimum', () => {
    expect(gpaFailures(2.81, 2.8)).toEqual([]);
  });

  it('fails when overall GPA is below the period minimum', () => {
    expect(gpaFailures(2.75, 2.8)).toMatchObject([
      {
        code: 'GPA_BELOW_MINIMUM',
        required: 2.8,
        actual: 2.75,
      },
    ]);
  });

  it.each([null, undefined])(
    'fails when overall GPA is missing (%s)',
    (gpa) => {
      expect(gpaFailures(gpa, 2.8)).toMatchObject([
        {
          code: 'GPA_MISSING',
          required: 2.8,
        },
      ]);
    },
  );
});

describe('courseFailures', () => {
  it('passes when all required courses are satisfied', () => {
    expect(
      courseFailures('66', valid66Courses(), 2.5),
    ).toEqual([]);
  });

  it('fails when required courses are missing', () => {
    const failures = courseFailures('66', [], 2.5);
    const codes = failures.map((failure) => failure.code);

    expect(codes).toContain('REQUIRED_COURSES_MISSING');
    expect(codes).toContain('ONGOING_OR_STUDIED_COURSE_MISSING');
  });

  it('fails when course-group GPA is below 2.50', () => {
    const courses = valid66Courses().map((course) =>
      [
        'คพ.100',
        'คพ.101',
        'คพ.102',
        'คพ.111',
        'คพ.213',
        'คพ.251',
        'คพ.261',
      ].includes(course.course_code)
        ? { ...course, grade_point: 2 }
        : course,
    );

    expect(
      courseFailures('66', courses, 2.5).map(
        (failure) => failure.code,
      ),
    ).toContain('COURSE_GROUP_GPA_BELOW_MINIMUM');
  });

  it('passes when course-group GPA equals 2.50', () => {
    expect(
      courseFailures('66', valid66Courses(2.5), 2.5),
    ).toEqual([]);
  });

  it('rejects unsupported curricula', () => {
    expect(
      courseFailures('other', [], 2.5).map(
        (failure) => failure.code,
      ),
    ).toContain('UNSUPPORTED_CURRICULUM');
  });
});

describe('checkEligibility', () => {
  it('reads eligibility criteria from the requested period', async () => {
    const client = clientFor();

    await checkEligibility(client, 'S01', PERIOD_ID);

    expect(client.query.mock.calls[0][1]).toEqual([PERIOD_ID]);
    expect(client.query.mock.calls[0][0]).toMatch(/FROM periods/);
  });

  it('passes an eligible student', async () => {
    const client = clientFor();

    expect(
      await checkEligibility(client, 'S01', PERIOD_ID),
    ).toEqual([]);
  });

  it('passes when overall GPA is just above 2.80', async () => {
    const client = clientFor({
      student: {
        student_id: 'S03',
        curriculum: '66',
        gpa: 2.81,
      },
    });

    expect(
      await checkEligibility(client, 'S03', PERIOD_ID),
    ).toEqual([]);
  });

  it('fails when overall GPA equals the configured threshold', async () => {
    const client = clientFor({
      student: {
        student_id: 'S02',
        curriculum: '66',
        gpa: 2.8,
      },
    });

    expect(
      await checkEligibility(client, 'S02', PERIOD_ID),
    ).toMatchObject([
      {
        code: 'GPA_BELOW_MINIMUM',
        required: 2.8,
        actual: 2.8,
      },
    ]);
  });

  it('fails when overall GPA is below the configured threshold', async () => {
    const client = clientFor({
      student: {
        student_id: 'S04',
        curriculum: '66',
        gpa: 2.75,
      },
    });

    expect(
      await checkEligibility(client, 'S04', PERIOD_ID),
    ).toMatchObject([
      {
        code: 'GPA_BELOW_MINIMUM',
        required: 2.8,
        actual: 2.75,
      },
    ]);
  });

  it('fails when course-group GPA is below the configured threshold', async () => {
    const lowGpaCourses = valid66Courses().map((course) =>
      [
        'คพ.100',
        'คพ.101',
        'คพ.102',
        'คพ.111',
        'คพ.213',
        'คพ.251',
        'คพ.261',
      ].includes(course.course_code)
        ? { ...course, grade_point: 2 }
        : course,
    );

    const client = clientFor({
      student: {
        student_id: 'S05',
        curriculum: '66',
        gpa: 3.2,
      },
      courses: lowGpaCourses,
    });

    expect(
      await checkEligibility(client, 'S05', PERIOD_ID),
    ).toMatchObject([
      {
        code: 'COURSE_GROUP_GPA_BELOW_MINIMUM',
        required: 2.5,
      },
    ]);
  });

  it('reports a missing student record', async () => {
    const client = clientFor({ student: null });

    expect(
      await checkEligibility(client, 'UNKNOWN', PERIOD_ID),
    ).toMatchObject([
      { code: 'STUDENT_RECORD_MISSING' },
    ]);
  });

  it('reports missing period criteria instead of using a fallback', async () => {
    const client = clientFor({
      minGpa: null,
    });

    expect(
      await checkEligibility(client, 'S01', PERIOD_ID),
    ).toMatchObject([
      { code: 'PERIOD_CRITERIA_MISSING' },
    ]);
  });

  it('uses the criteria belonging to each requested period', async () => {
    const client = clientFor({
      periods: {
        'COOP-2569-01': {
          min_gpa: 2.8,
          min_group_gpa: 2.5,
          capacity: 2,
        },
        'COOP-2569-02': {
          min_gpa: 3.5,
          min_group_gpa: 3.0,
          capacity: 10,
        },
      },
    });

    const firstPeriodFailures = await checkEligibility(
      client,
      'S01',
      'COOP-2569-01',
    );

    const secondPeriodFailures = await checkEligibility(
      client,
      'S01',
      'COOP-2569-02',
    );

    expect(firstPeriodFailures).toEqual([]);
    expect(secondPeriodFailures.map((failure) => failure.code))
      .toContain('GPA_BELOW_MINIMUM');

    const periodQueries = client.query.mock.calls.filter(
      ([sql]) => /FROM periods/.test(sql),
    );

    expect(periodQueries[0][1]).toEqual(['COOP-2569-01']);
    expect(periodQueries[1][1]).toEqual(['COOP-2569-02']);
  });

  it.each([
    ['6600000001', 3.65, true],
    ['66t00000002', 3.82, true],
    ['6600000003', 3.25, true],
    ['6600000004', 2.75, false],
    ['6600000005', 3.10, true],
  ])(
    'checks overall GPA eligibility for student %s (GPA: %s)',
    async (studentId, gpa, shouldPassGpa) => {
      const client = clientFor({
        student: {
          student_id: studentId,
          curriculum: '66',
          gpa,
        },
      });

      const failures = await checkEligibility(
        client,
        studentId,
        PERIOD_ID,
      );

      const gpaFailure = failures.find(
        (failure) =>
          failure.code === 'GPA_BELOW_MINIMUM' ||
          failure.code === 'GPA_MISSING',
      );

      if (shouldPassGpa) {
        expect(gpaFailure).toBeUndefined();
      } else {
        expect(gpaFailure).toMatchObject({
          code: 'GPA_BELOW_MINIMUM',
          required: 2.8,
          actual: 2.75,
        });
      }
    },
  );
});