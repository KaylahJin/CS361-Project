// ============================================================
// CS361 V3 — Plan Review Types (Issue #106 / V3-05)
// ============================================================

export type PlanReviewStatus =
  | 'ALL'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'APPROVED'
  | 'REJECTED'
  | 'DRAFT';

export type ReviewerRole = 'ADVISOR' | 'STAFF' | 'ADMIN';

export interface Reviewer {
  id: string;
  name: string;
  role: ReviewerRole;
  roleTitle: string;
  email: string;
  assignedStudentIds?: string[]; // IDs of advisees (for advisors)
}

export type ReviewDecision = 'APPROVED' | 'RETURNED' | 'REJECTED';

export interface PlanReviewItem {
  plan_id: number;
  student_id: string;
  first_name: string;
  last_name: string;
  curriculum: string;
  gpa?: number | null;
  advisor_name?: string | null;
  period_id: string;
  period_name?: string | null;
  position_id?: string | null;
  position_title?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  company_short_name?: string | null;
  status: 'SUBMITTED' | 'RETURNED' | 'APPROVED' | 'REJECTED' | 'DRAFT';
  submitted_at: string | null;
  student_note: string | null;
  acknowledged_pre_course: boolean;
  terms_accepted_at: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewSubmitPayload {
  planId: number;
  decision: ReviewDecision;
  comment: string;
  reviewerId: string;
  reviewerName: string;
}

export interface PlanCounts {
  ALL: number;
  SUBMITTED: number;
  RETURNED: number;
  APPROVED: number;
  REJECTED: number;
  DRAFT: number;
  [key: string]: number;
}

export interface PlanReviewFilter {
  status?: string;
  search?: string;
  curriculum?: string;
  reviewerId?: string;
}
