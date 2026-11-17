// ============================================================
// CS361 V4-03 — Deadline Classification & Display Utilities (FR6)
// Issue: #192
// ============================================================

/**
 * Threshold for "Near Deadline" in days (0..7 days remaining).
 * Matches CLOSING_SOON_DAYS = 7 established in src/pages/Positions.tsx.
 */
export const NEAR_DEADLINE_DAYS = 7;

export type DeadlineCategory =
  | 'UPCOMING'
  | 'NEAR_DEADLINE'
  | 'OVERDUE'
  | 'COMPLETED'
  | 'NO_DEADLINE';

export interface DeadlineInfo {
  category: DeadlineCategory;
  label: string;
  shortLabel: string;
  badgeClass: string;
  daysLeft: number | null;
  formattedDate: string;
}

/** Statuses where the student's submission/resubmission action is still incomplete. */
const INCOMPLETE_SUBMISSION_STATUSES = new Set([
  'PREPARING',
  'DRAFT',
  'RETURNED',
  'INCOMPLETE',
]);

/**
 * Parses a YYYY-MM-DD (or ISO) string into local midnight Date so calendar day
 * comparisons do not drift across timezones.
 */
export function parseDeadlineDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  const datePart = trimmed.slice(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(d.getTime()) ||
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }

  return d;
}

export function formatDeadlineDate(dateStr: string | null | undefined): string {
  const parsed = parseDeadlineDate(dateStr);
  if (!parsed) return 'ไม่ระบุกำหนดเวลา';
  try {
    return parsed.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr?.slice(0, 10) || 'ไม่ระบุกำหนดเวลา';
  }
}

/**
 * Returns the whole number of calendar days from `now` (in Asia/Bangkok date)
 * until `deadlineStr` (YYYY-MM-DD).
 * - > 0: deadline is in the future
 * -   0: deadline is today
 * - < 0: deadline has passed
 */
export function calculateDaysLeft(
  deadlineStr: string | null | undefined,
  now: Date = new Date()
): number | null {
  const deadline = parseDeadlineDate(deadlineStr);
  if (!deadline) return null;

  // Convert `now` to Asia/Bangkok calendar date (UTC+7)
  const bangkokMs = now.getTime() + 7 * 60 * 60 * 1000;
  const bangkokDate = new Date(bangkokMs);
  const todayUtc = Date.UTC(
    bangkokDate.getUTCFullYear(),
    bangkokDate.getUTCMonth(),
    bangkokDate.getUTCDate()
  );

  const diffMs = deadline.getTime() - todayUtc;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Classifies a plan's deadline according to V4 Overview §3.4 (FR6):
 * - UPCOMING: deadline > 7 days in the future
 * - NEAR_DEADLINE: deadline within 0..7 days
 * - OVERDUE: deadline passed (< 0 days) AND plan is not yet completed/submitted
 * - COMPLETED: plan already submitted/decided after deadline passed (not overdue)
 * - NO_DEADLINE: no valid deadline date available
 */
export function classifyPlanDeadline(
  deadlineStr: string | null | undefined,
  planStatus: string,
  now: Date = new Date()
): DeadlineInfo {
  const daysLeft = calculateDaysLeft(deadlineStr, now);
  const formattedDate = formatDeadlineDate(deadlineStr);

  if (daysLeft === null) {
    return {
      category: 'NO_DEADLINE',
      label: 'ไม่ระบุกำหนดเวลา (No Deadline)',
      shortLabel: 'No Deadline',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      daysLeft: null,
      formattedDate,
    };
  }

  const isPendingSubmission = INCOMPLETE_SUBMISSION_STATUSES.has(planStatus);

  if (daysLeft < 0) {
    if (isPendingSubmission) {
      return {
        category: 'OVERDUE',
        label: 'เกินกำหนดส่ง (Overdue)',
        shortLabel: 'Overdue',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        daysLeft,
        formattedDate,
      };
    }

    return {
      category: 'COMPLETED',
      label: 'ดำเนินการแล้ว (Completed)',
      shortLabel: 'Completed',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      daysLeft,
      formattedDate,
    };
  }

  if (daysLeft <= NEAR_DEADLINE_DAYS) {
    return {
      category: 'NEAR_DEADLINE',
      label: `ใกล้ครบกำหนด (อีก ${daysLeft} วัน)`,
      shortLabel: 'Near Deadline',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      daysLeft,
      formattedDate,
    };
  }

  return {
    category: 'UPCOMING',
    label: 'ตามกำหนดการ (Upcoming)',
    shortLabel: 'Upcoming',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    daysLeft,
    formattedDate,
  };
}

/**
 * Classifies a schedule item deadline on the Co-op Timelines page (Periods.tsx).
 */
export function classifyScheduleDeadline(
  endDateStr: string | null | undefined,
  hasIncompleteAction = false,
  now: Date = new Date()
): DeadlineInfo {
  return classifyPlanDeadline(
    endDateStr,
    hasIncompleteAction ? 'PREPARING' : 'APPROVED',
    now
  );
}
