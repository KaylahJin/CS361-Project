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

/** The advisor's step (#147). NOT_ENDORSED returns the plan to the student. */
export type EndorseDecision = 'ENDORSED' | 'NOT_ENDORSED';

/** Staff's step (#148). INCOMPLETE returns the plan to the student. */
export type ScreenDecision = 'ELIGIBLE' | 'INCOMPLETE' | 'NOT_ELIGIBLE';

/** The committee's step (#149). SELECTED only within the period's capacity. */
export type SelectDecision = 'SELECTED' | 'NOT_SELECTED';

/** GET /coop-plans/{planId}/eligibility: the plan's student against its period's criteria. */
export interface PlanEligibility {
  plan_id: number;
  period_id: string;
  criteria: { min_gpa: number | null; min_group_gpa: number | null };
  eligible: boolean;
  failures: Array<{ code?: string; message?: string }>;
}

export type PlanReviewItem = CoopPlan;

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
