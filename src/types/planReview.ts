// ============================================================
// CS361 V3 — Plan Review Types (Issue #106 / V3-05.1 #107)
// ============================================================

import type { CoopPlan, CoopPlanStatus } from './coopPlan';

export type PlanReviewStatus = 'ALL' | CoopPlanStatus;

export type ReviewerRole = 'ADVISOR' | 'STAFF' | 'ADMIN';

export interface Reviewer {
  id: string;
  name: string;
  role: ReviewerRole;
  roleTitle: string;
  email: string;
  assignedStudentIds?: string[];
}

export type ReviewDecision = 'APPROVED' | 'RETURNED' | 'REJECTED';

export type PlanReviewItem = CoopPlan;

/** One decision from plan_reviews, as GET /coop-plans/{id} returns it. */
export interface PlanReviewHistoryItem {
  review_id: number;
  decision: ReviewDecision;
  comment: string | null;
  reviewed_at: string;
  reviewer_name: string | null;
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
  PREPARING: number;
  DRAFT?: number;
  [key: string]: number | undefined;
}

export interface PlanReviewFilter {
  status?: string;
  search?: string;
  curriculum?: string;
  periodId?: string;
  reviewerId?: string;
}
