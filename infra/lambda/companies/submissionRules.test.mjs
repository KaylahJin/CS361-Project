import { describe, it, expect } from 'vitest';
import { completenessFailures, windowFailures } from './submissionRules.mjs';

const COMPLETE = {
  period_id: 'P2568-1',
  position_id: 'POS013',
  acknowledged_pre_course: true,
  terms_accepted_at: '2026-10-01T10:00:00Z',
};

const codes = (failures) => failures.map((f) => f.code);

describe('completenessFailures', () => {
  it('passes a complete plan', () => {
    expect(completenessFailures(COMPLETE)).toEqual([]);
  });

  it.each([
    ['period_id', null, 'PERIOD_REQUIRED', 'periodId'],
    ['position_id', null, 'POSITION_REQUIRED', 'positionId'],
    ['acknowledged_pre_course', false, 'PRE_COURSE_NOT_ACKNOWLEDGED', 'acknowledgedPreCourse'],
    ['terms_accepted_at', null, 'TERMS_NOT_ACCEPTED', 'termsAccepted'],
  ])('reports a plan whose %s is missing', (column, value, code, field) => {
    const failures = completenessFailures({ ...COMPLETE, [column]: value });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ code, field });
    expect(failures[0].message).toBeTruthy();
  });

  it('reports every missing item at once, not just the first', () => {
    const failures = completenessFailures({
      period_id: 'P2568-1',
      position_id: null,
      acknowledged_pre_course: false,
      terms_accepted_at: null,
    });
    expect(codes(failures)).toEqual([
      'POSITION_REQUIRED',
      'PRE_COURSE_NOT_ACKNOWLEDGED',
      'TERMS_NOT_ACCEPTED',
    ]);
  });
});

describe('windowFailures', () => {
  const open = { start_date: '2026-10-01', end_date: '2026-10-31', is_open: true };
  const past = { start_date: '2026-06-01', end_date: '2026-06-15', is_open: false };

  it('passes when a window is open today', () => {
    expect(windowFailures([open])).toEqual([]);
  });

  it('passes when any one of several windows is open', () => {
    expect(windowFailures([past, open])).toEqual([]);
  });

  it('refuses when every window has closed, and lists them', () => {
    const failures = windowFailures([past]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      code: 'SUBMISSION_WINDOW_CLOSED',
      windows: [{ startDate: '2026-06-01', endDate: '2026-06-15' }],
    });
  });

  it('refuses when the period has no window at all, with its own code', () => {
    const failures = windowFailures([]);
    expect(codes(failures)).toEqual(['SUBMISSION_WINDOW_NOT_DEFINED']);
  });
});
