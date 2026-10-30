// ============================================================
// CS361 V2 — Coop Plan Types
// ============================================================

export type CoopPlanStatus =
  | 'PREPARING'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'ENDORSED'
  | 'ELIGIBLE'
  | 'NOT_ELIGIBLE'
  | 'APPROVED'
  | 'REJECTED';

export interface CoopPlan {
  plan_id: number;
  student_id: string;
  period_id: string;
  position_id: string | null;
  status: CoopPlanStatus;

  acknowledged_pre_course: boolean;
  terms_accepted_at: string | null;
  student_note: string | null;

  submitted_at: string | null;

  reviewer_name: string | null;
  reviewed_at: string | null;
  review_comment: string | null;

  created_at: string;
  updated_at: string;

  // Student
  first_name: string;
  last_name: string;
  curriculum: string;
  gpa?: number | null;
  advisor_name?: string | null;

  // Position / Company
  position_title: string | null;
  company_id: string | null;
  company_name: string | null;
  company_short_name: string | null;

  // Period
  period_name: string | null;
}

export interface CoopPlanQueryParams {
  status?: CoopPlanStatus;
  studentId?: string;
  search?: string;
  curriculum?: string;
  periodId?: string;
  companyId?: string;
  positionId?: string;
  submittedFrom?: string;
  submittedTo?: string;
}

// ------------------------------------------------------------
// V3-04.1 — create and edit
// ------------------------------------------------------------

/**
 * Body of POST /coop-plans. There is no student id: the API takes the owner
 * from the verified token, and refuses a body that names one.
 */
export interface CreateCoopPlanInput {
  periodId: string;
  positionId?: string | null;
}

/**
 * Body of PATCH /coop-plans/{planId}. Send only the fields that changed.
 * `termsAccepted` is a yes/no — the server stamps the time itself.
 * Status, period and every review field are not editable and are refused.
 */
export interface UpdateCoopPlanInput {
  positionId?: string | null;
  studentNote?: string | null;
  acknowledgedPreCourse?: boolean;
  termsAccepted?: boolean;
}

/**
 * Statuses a student may edit (V3-01-data-model.md §4). SUBMITTED is waiting
 * on a reviewer; APPROVED and REJECTED are final. This only decides whether the
 * page offers an edit button — the API enforces it with a 409 regardless.
 */
export const EDITABLE_PLAN_STATUSES: readonly CoopPlanStatus[] = [
  'PREPARING',
  'RETURNED',
];

export function isPlanEditable(status: CoopPlanStatus): boolean {
  return EDITABLE_PLAN_STATUSES.includes(status);
}

/** Same limit the API enforces on studentNote. */
export const MAX_STUDENT_NOTE = 2000;