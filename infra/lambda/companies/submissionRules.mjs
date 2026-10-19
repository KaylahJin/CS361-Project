// The plan-side checks that decide whether a plan may be submitted. Pure
// functions over data the handler has already read, so every rule is testable
// without a database; eligibility.mjs holds the student-side rules.
//
// Each check reports a failure object instead of throwing. The handler gathers
// every failure and answers once, so a student who is missing three things
// hears about all three, not one per attempt.
//
// A failure is { code, message, field?, ...details }. `code` is what the page
// maps to its own wording; `message` is the explanation V3-01-api-spec.md §8 asks for.

/**
 * Required data on the plan itself (V3-01-workflow-permissions.md §4). Period
 * and position are foreign keys, so when they are set they exist; this only
 * has to say whether they are set.
 */
export function completenessFailures(plan) {
  const failures = [];

  if (!plan.period_id) {
    failures.push({
      code: 'PERIOD_REQUIRED',
      field: 'periodId',
      message: 'The plan has no period.',
    });
  }
  if (!plan.position_id) {
    failures.push({
      code: 'POSITION_REQUIRED',
      field: 'positionId',
      message: 'Choose a position before submitting.',
    });
  }
  if (!plan.acknowledged_pre_course) {
    failures.push({
      code: 'PRE_COURSE_NOT_ACKNOWLEDGED',
      field: 'acknowledgedPreCourse',
      message: 'Acknowledge the pre-course requirement before submitting.',
    });
  }
  if (!plan.terms_accepted_at) {
    failures.push({
      code: 'TERMS_NOT_ACCEPTED',
      field: 'termsAccepted',
      message: 'Accept the terms before submitting.',
    });
  }

  return failures;
}

/**
 * The submission window: the APPLICATION rows of coop_schedules for the plan's
 * period. `windows` is what the database returned, each with `is_open` worked
 * out in SQL against today's date in Thailand, so a Date is never shifted by a
 * timezone here.
 *
 * No window at all counts as closed: "submit within the open period" cannot be
 * confirmed when no period is defined, so the safe answer is to refuse and say why.
 */
export function windowFailures(windows) {
  if (windows.length === 0) {
    return [
      {
        code: 'SUBMISSION_WINDOW_NOT_DEFINED',
        message: 'No submission window is defined for this period, so submissions are not open.',
      },
    ];
  }
  if (windows.some((w) => w.is_open)) return [];

  return [
    {
      code: 'SUBMISSION_WINDOW_CLOSED',
      message: 'Submissions for this period are not open today.',
      windows: windows.map((w) => ({ startDate: w.start_date, endDate: w.end_date })),
    },
  ];
}
