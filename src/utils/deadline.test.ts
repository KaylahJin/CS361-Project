import { describe, it, expect } from 'vitest';
import {
  NEAR_DEADLINE_DAYS,
  parseDeadlineDate,
  calculateDaysLeft,
  classifyPlanDeadline,
  classifyScheduleDeadline,
} from './deadline';

describe('deadline utilities (V4-03 / FR6)', () => {
  // Reference "now": 2025-06-10T05:00:00Z -> 2025-06-10 12:00 Asia/Bangkok
  const NOW = new Date('2025-06-10T05:00:00Z');

  it('uses the 7-day threshold established in the codebase', () => {
    expect(NEAR_DEADLINE_DAYS).toBe(7);
  });

  it('parses valid YYYY-MM-DD dates and rejects invalid or impossible dates', () => {
    expect(parseDeadlineDate('2025-06-15')).not.toBeNull();
    expect(parseDeadlineDate(null)).toBeNull();
    expect(parseDeadlineDate('')).toBeNull();
    expect(parseDeadlineDate('   ')).toBeNull();
    expect(parseDeadlineDate('2025-02-30')).toBeNull();
    expect(parseDeadlineDate('invalid')).toBeNull();
  });

  it('calculates daysLeft accurately against Asia/Bangkok calendar date', () => {
    expect(calculateDaysLeft('2025-06-10', NOW)).toBe(0);
    expect(calculateDaysLeft('2025-06-17', NOW)).toBe(7);
    expect(calculateDaysLeft('2025-06-18', NOW)).toBe(8);
    expect(calculateDaysLeft('2025-06-09', NOW)).toBe(-1);
  });

  it('returns NO_DEADLINE when deadline is null or missing', () => {
    const info = classifyPlanDeadline(null, 'PREPARING', NOW);
    expect(info.category).toBe('NO_DEADLINE');
    expect(info.shortLabel).toBe('No Deadline');
    expect(info.formattedDate).toBe('ไม่ระบุกำหนดเวลา');
  });

  it('returns UPCOMING when deadline is more than 7 days away', () => {
    const info = classifyPlanDeadline('2025-06-20', 'PREPARING', NOW);
    expect(info.category).toBe('UPCOMING');
    expect(info.shortLabel).toBe('Upcoming');
    expect(info.daysLeft).toBe(10);
  });

  it('returns NEAR_DEADLINE when deadline is 0 to 7 days away', () => {
    const sevenDays = classifyPlanDeadline('2025-06-17', 'PREPARING', NOW);
    expect(sevenDays.category).toBe('NEAR_DEADLINE');
    expect(sevenDays.shortLabel).toBe('Near Deadline');
    expect(sevenDays.daysLeft).toBe(7);

    const today = classifyPlanDeadline('2025-06-10', 'RETURNED', NOW);
    expect(today.category).toBe('NEAR_DEADLINE');
    expect(today.daysLeft).toBe(0);
  });

  it('returns OVERDUE only when deadline has passed AND plan is still incomplete (PREPARING / RETURNED)', () => {
    const preparingOverdue = classifyPlanDeadline('2025-06-01', 'PREPARING', NOW);
    expect(preparingOverdue.category).toBe('OVERDUE');
    expect(preparingOverdue.shortLabel).toBe('Overdue');
    expect(preparingOverdue.daysLeft).toBe(-9);

    const returnedOverdue = classifyPlanDeadline('2025-06-01', 'RETURNED', NOW);
    expect(returnedOverdue.category).toBe('OVERDUE');
  });

  it('does NOT mark SUBMITTED, ENDORSED, APPROVED, or REJECTED plans as OVERDUE after deadline passes', () => {
    for (const status of ['SUBMITTED', 'ENDORSED', 'APPROVED', 'REJECTED']) {
      const info = classifyPlanDeadline('2025-06-01', status, NOW);
      expect(info.category).toBe('COMPLETED');
      expect(info.category).not.toBe('OVERDUE');
    }
  });

  it('classifies schedule deadlines on Periods page', () => {
    expect(classifyScheduleDeadline('2025-06-01', false, NOW).category).toBe('OVERDUE');
    expect(classifyScheduleDeadline('2025-06-15', false, NOW).category).toBe('NEAR_DEADLINE');
    expect(classifyScheduleDeadline('2025-07-01', false, NOW).category).toBe('UPCOMING');
    expect(classifyScheduleDeadline(null, false, NOW).category).toBe('NO_DEADLINE');
  });
});
