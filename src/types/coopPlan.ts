// ============================================================
// CS361 V2 — Coop Plan Types
// ============================================================

export type CoopPlanStatus =
  | 'PREPARING'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
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