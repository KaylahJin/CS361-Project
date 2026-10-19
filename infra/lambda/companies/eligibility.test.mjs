import { describe, it, expect, vi } from 'vitest';

import {
  checkEligibility,
  gpaFailures,
  courseFailures,
  FALLBACK_MIN_GPA,
  MIN_COURSE_GROUP_GPA,
} from './eligibility.mjs';

const passed = (course_code, grade_point = 3) => ({
  course_code,
  status: 'PASSED',
  grade_point,
});

const valid66Courses = () => [
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

function clientFor({
  student,
  minGpa,
  courses = valid66Courses(),
}) {
  return {
    query: vi.fn(async (text) => {
      if (/FROM students/.test(text)) {
        return {
          rows: student ? [student] : [],
        };
      }

      if (/FROM coop_info/.test(text)) {
        return {
          rows: [{ min_gpa: minGpa }],
        };
      }

      if (/FROM student_courses/.test(text)) {
        return {
          rows: courses,
        };
      }

      throw new Error(`unexpected query: ${text}`);
    }),
  };
}

describe('gpaFailures', () => {
  it('passes a GPA above the minimum', () => {
    expect(gpaFailures(3.2, 2.75)).toEqual([]);
  });

  it('passes a GPA exactly at the minimum', () => {
    expect(gpaFailures(2.75, 2.75)).toEqual([]);
  });

  it('fails a student below the GPA minimum and reports the comparison', () => {
    const [failure] = gpaFailures(2.6, 2.75);

    expect(failure).toMatchObject({
      code: 'GPA_BELOW_MINIMUM',
      required: 2.75,
      actual: 2.6,
    });

    expect(failure.message).toContain('2.60');
    expect(failure.message).toContain('2.75');
  });

  it.each([null, undefined])(
    'fails a student with no GPA on record (%s) instead of guessing',
    (gpa) => {
      expect(gpaFailures(gpa, 2.75)).toMatchObject([
        {
          code: 'GPA_MISSING',
          required: 2.75,
        },
      ]);
    },
  );
});

describe('courseFailures', () => {
  it('accepts a curriculum 66 student with all required courses', () => {
    expect(
      courseFailures('66', valid66Courses()),
    ).toEqual([]);
  });

  it('accepts a curriculum 61 student with either alternative course', () => {
    const courses = [
      passed('คพ.101'),
      passed('คพ.102'),
      passed('คพ.111'),
      passed('คพ.251'),
      passed('คพ.264'),
      passed('คพ.216'),
      {
        course_code: 'คพ.384',
        status: 'ENROLLED',
        grade_point: null,
      },
      passed('คพ.348'),
    ];

    expect(courseFailures('61', courses)).toEqual([]);
  });

  it('rejects missing required graded courses', () => {
    const failures = courseFailures('66', []);

    expect(
      failures.map((failure) => failure.code),
    ).toContain('REQUIRED_COURSES_MISSING');

    expect(
      failures.map((failure) => failure.code),
    ).toContain('ONGOING_OR_STUDIED_COURSE_MISSING');

    expect(failures[0].missingCourses).toContain('คพ.100');
  });

  it('checks the course-group GPA against 2.50', () => {
    const courses = valid66Courses().map((row) =>
      [
        'คพ.100',
        'คพ.101',
        'คพ.102',
        'คพ.111',
        'คพ.213',
        'คพ.251',
        'คพ.261',
      ].includes(row.course_code)
        ? {
            ...row,
            grade_point:
              row.course_code === 'คพ.100' ? 0 : 2,
          }
        : row,
    );

    const failures = courseFailures('66', courses);

    expect(
      failures.map((failure) => failure.code),
    ).toContain('COURSE_GROUP_GPA_BELOW_MINIMUM');

    expect(MIN_COURSE_GROUP_GPA).toBe(2.5);
  });

    it('accepts enrolled or previously studied courses in the second group', () => {
    const courses = [
        ...valid66Courses().filter(
        (row) => row.course_code !== 'คพ.262',
        ),
        {
        course_code: 'คพ.331',
        status: 'ENROLLED',
        grade_point: null,
        },
    ];

    expect(courseFailures('66', courses)).toEqual([]);
    });

  it('rejects unsupported curricula', () => {
    expect(
      courseFailures('other', []).map(
        (failure) => failure.code,
      ),
    ).toEqual(['UNSUPPORTED_CURRICULUM']);
  });
});

describe('checkEligibility', () => {
  it('passes an eligible student and queries their course history', async () => {
    const client = clientFor({
      student: {
        student_id: 'S1',
        curriculum: '66',
        gpa: 3.4,
      },
      minGpa: 2.75,
    });

    expect(await checkEligibility(client, 'S1')).toEqual([]);

    expect(
      client.query.mock.calls.some(([sql]) =>
        /FROM student_courses/.test(sql),
      ),
    ).toBe(true);
  });

  it('fails a student below the configured GPA minimum', async () => {
    const client = clientFor({
      student: {
        student_id: 'S1',
        curriculum: '61',
        gpa: 2.6,
      },
      minGpa: 3.0,
      courses: [
        passed('คพ.101'),
        passed('คพ.102'),
        passed('คพ.111'),
        passed('คพ.251'),
        passed('คพ.264'),
        passed('คพ.213'),
        {
          course_code: 'คพ.384',
          status: 'ENROLLED',
        },
        passed('คพ.266'),
      ],
    });

    expect(
      await checkEligibility(client, 'S1'),
    ).toMatchObject([
      {
        code: 'GPA_BELOW_MINIMUM',
        required: 3.0,
      },
    ]);
  });

  it('uses the student curriculum for GPA and course rules', async () => {
    const client = clientFor({
      student: {
        student_id: 'S1',
        curriculum: '66',
        gpa: 3.4,
      },
      minGpa: 2.75,
    });

    await checkEligibility(client, 'S1');

    expect(client.query.mock.calls[0][1]).toEqual(['S1']);

    expect(
      client.query.mock.calls.find(([sql]) =>
        /FROM coop_info/.test(sql),
      )[1],
    ).toEqual(['66']);

    expect(
      client.query.mock.calls.find(([sql]) =>
        /FROM student_courses/.test(sql),
      )[1],
    ).toEqual(['S1']);
  });

  it('uses the fallback overall GPA minimum when no rule exists', async () => {
    const client = clientFor({
      student: {
        student_id: 'S1',
        curriculum: '66',
        gpa: 2.6,
      },
      minGpa: null,
    });

    expect(
      await checkEligibility(client, 'S1'),
    ).toMatchObject([
      {
        code: 'GPA_BELOW_MINIMUM',
        required: FALLBACK_MIN_GPA,
      },
    ]);
  });

  it('reports a missing student record', async () => {
    const client = clientFor({
      student: null,
      minGpa: 2.75,
    });

    expect(
      await checkEligibility(client, 'S1'),
    ).toMatchObject([
      {
        code: 'STUDENT_RECORD_MISSING',
      },
    ]);
  });
});