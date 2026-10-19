// Student-side eligibility checks for V3-04.2.
//
// The included schema exposes students(student_id, curriculum, gpa) and
// student_courses(student_id, course_code, status, grade_point).
// Course rules are enforced here using those real columns; they are not frontend-only checks.
//
// IMPORTANT DATA-MODEL LIMITS:
// The supplied schema has no university/faculty/major field and no disciplinary
// record. Those criteria cannot be independently verified from these tables.
// The system must only treat the student registry as CS/TU-scoped if that is
// guaranteed by the trusted import/administrative process. To verify the
// disciplinary criterion, add a trusted disciplinary-clearance field/source.

export const FALLBACK_MIN_GPA = 2.75;
export const MIN_COURSE_GROUP_GPA = 2.5;

const SELECT_STUDENT = `
  SELECT student_id, curriculum, gpa::float8 AS gpa
  FROM students
  WHERE student_id = $1
`;

const SELECT_MIN_GPA = `
  SELECT MAX(gpa_requirement)::float8 AS min_gpa
  FROM coop_info
  WHERE gpa_requirement IS NOT NULL
    AND curriculum IN ($1, 'all')
    AND academic_year = (
      SELECT MAX(academic_year)
      FROM coop_info
      WHERE gpa_requirement IS NOT NULL
        AND curriculum IN ($1, 'all')
    )
`;

const SELECT_STUDENT_COURSES = `
  SELECT course_code, status, grade_point::float8 AS grade_point
  FROM student_courses
  WHERE student_id = $1
`;

// Course groups are slots: every mandatory course is one slot, and the
// interchangeable pair is one slot (either code satisfies it). If both
// alternatives have grades, the higher grade represents that slot so taking
// both does not unexpectedly penalize a student.
const CURRICULUM_RULES = Object.freeze({
  '61': {
    gradedRequired: [
      'คพ.101',
      'คพ.102',
      'คพ.111',
      'คพ.251',
      'คพ.264',
    ],
    gradedAlternative: ['คพ.213', 'คพ.216'],
    ongoingGroups: [
      ['คพ.384'],
      ['คพ.266', 'คพ.322', 'คพ.348'],
    ],
    preWorkCourse: 'คพ.302',
  },

  '66': {
    gradedRequired: [
      'คพ.100',
      'คพ.101',
      'คพ.102',
      'คพ.111',
      'คพ.251',
      'คพ.261',
    ],
    gradedAlternative: ['คพ.213', 'คพ.216'],
    ongoingGroups: [
      ['คพ.180'],
      ['คพ.262', 'คพ.331', 'คพ.240'],
    ],
    preWorkCourse: 'คพ.301',
  },
});

export function gpaFailures(gpa, minGpa) {
  if (gpa === null || gpa === undefined) {
    return [
      {
        code: 'GPA_MISSING',
        message:
          'There is no GPA on record for this student, so eligibility cannot be confirmed.',
        required: minGpa,
      },
    ];
  }

  if (Number(gpa) < minGpa) {
    return [
      {
        code: 'GPA_BELOW_MINIMUM',
        message: `GPA ${Number(gpa).toFixed(2)} is below the required ${Number(
          minGpa,
        ).toFixed(2)}.`,
        required: minGpa,
        actual: Number(gpa),
      },
    ];
  }

  return [];
}

function normalizeCourseCode(value) {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function courseLabel(code) {
  return code;
}

/**
 * Evaluate course eligibility against student_courses.
 *
 * status=ENROLLED counts for the "currently studying or studied" rule.
 *
 * The graded course-group requires a completed course with a recorded grade
 * (PASSED or FAILED); a missing grade cannot be used to calculate the average.
 */
export function courseFailures(curriculum, courseRows) {
  const rules = CURRICULUM_RULES[String(curriculum ?? '').trim()];

  if (!rules) {
    return [
      {
        code: 'UNSUPPORTED_CURRICULUM',
        message: `Curriculum "${curriculum ?? ''}" is not supported for co-op eligibility.`,
        actual: curriculum ?? null,
        supported: Object.keys(CURRICULUM_RULES),
      },
    ];
  }

  const byCode = new Map();

  for (const row of courseRows ?? []) {
    const code = normalizeCourseCode(row.course_code);

    if (!code) {
      continue;
    }

    const normalized = {
      ...row,
      course_code: code,
      status: String(row.status ?? '').toUpperCase(),
    };

    const existing = byCode.get(code);

    // The schema's primary key permits one row per student/course.
    // This also keeps pure-function tests deterministic if duplicate rows
    // are supplied.
    if (!existing) {
      byCode.set(code, normalized);
    }
  }

  const failures = [];

  const missingGraded = rules.gradedRequired.filter((code) => {
    const row = byCode.get(normalizeCourseCode(code));

    return (
      !row ||
      !['PASSED', 'FAILED'].includes(row.status) ||
      row.grade_point === null ||
      row.grade_point === undefined
    );
  });

  const hasAlternative = rules.gradedAlternative.some((code) => {
    const row = byCode.get(normalizeCourseCode(code));

    return (
      row &&
      ['PASSED', 'FAILED'].includes(row.status) &&
      row.grade_point !== null &&
      row.grade_point !== undefined
    );
  });

  if (missingGraded.length || !hasAlternative) {
    failures.push({
      code: 'REQUIRED_COURSES_MISSING',
      message:
        'Required graded courses are missing. Complete the required courses and at least one of the alternative courses before submitting.',
      missingCourses: [
        ...missingGraded.map(courseLabel),
        ...(!hasAlternative
          ? [
              `${rules.gradedAlternative[0]} หรือ ${rules.gradedAlternative[1]}`,
            ]
          : []),
      ],
    });
  } else {
    const requiredGrades = rules.gradedRequired.map((code) =>
      Number(byCode.get(normalizeCourseCode(code)).grade_point),
    );

    const alternativeGrades = rules.gradedAlternative
      .map((code) => byCode.get(normalizeCourseCode(code)))
      .filter(
        (row) =>
          row &&
          ['PASSED', 'FAILED'].includes(row.status) &&
          row.grade_point !== null &&
          row.grade_point !== undefined,
      )
      .map((row) => Number(row.grade_point));

    const groupGrades = [
      ...requiredGrades,
      Math.max(...alternativeGrades),
    ];

    const average =
      groupGrades.reduce((sum, grade) => sum + grade, 0) /
      groupGrades.length;

    if (
      groupGrades.some((grade) => !Number.isFinite(grade)) ||
      average < MIN_COURSE_GROUP_GPA
    ) {
      failures.push({
        code: 'COURSE_GROUP_GPA_BELOW_MINIMUM',
        message: `The average grade point for the required course group must be at least ${MIN_COURSE_GROUP_GPA.toFixed(
          2,
        )}.`,
        required: MIN_COURSE_GROUP_GPA,
        actual: Number.isFinite(average)
          ? Number(average.toFixed(2))
          : null,
        courses: [
          ...rules.gradedRequired,
          rules.gradedAlternative.join(' / '),
        ],
      });
    }
  }

  // "Currently studying or have studied" means a row exists with any valid
  // recorded status, including ENROLLED, PASSED or FAILED.
  for (const group of rules.ongoingGroups) {
    const satisfied = group.some((code) => {
      const row = byCode.get(normalizeCourseCode(code));

      return (
        row &&
        ['ENROLLED', 'PASSED', 'FAILED'].includes(row.status)
      );
    });

    if (!satisfied) {
      failures.push({
        code: 'ONGOING_OR_STUDIED_COURSE_MISSING',
        message: `You must be currently studying or have studied one of: ${group.join(
          ', ',
        )}.`,
        missingCourses: group,
      });
    }
  }

  // The curriculum-specific pre-work course is an acknowledgement, not a
  // submission-time passed-course requirement. The student must acknowledge
  // that they will pass it before starting work; this is checked on the plan.
  return failures;
}

/**
 * @param {{query: Function}} client transaction client
 * @param {string} studentId student id from the locked plan row, never request input
 * @returns {Promise<object[]>} failures; empty means all verifiable checks pass
 */
export async function checkEligibility(client, studentId) {
  const found = await client.query(SELECT_STUDENT, [studentId]);
  const student = found.rows[0];

  if (!student) {
    return [
      {
        code: 'STUDENT_RECORD_MISSING',
        message: 'The student record for this plan could not be found.',
      },
    ];
  }

  const failures = [];
  const curriculum = String(student.curriculum ?? '').trim();

  if (!CURRICULUM_RULES[curriculum]) {
    failures.push(...courseFailures(curriculum, []));
    return failures;
  }

  const req = await client.query(SELECT_MIN_GPA, [curriculum]);
  const minGpa = req.rows[0]?.min_gpa ?? FALLBACK_MIN_GPA;

  failures.push(...gpaFailures(student.gpa, minGpa));

  const courses = await client.query(SELECT_STUDENT_COURSES, [
    studentId,
  ]);

  failures.push(...courseFailures(curriculum, courses.rows));

  return failures;
}