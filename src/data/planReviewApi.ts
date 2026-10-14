// ============================================================
// CS361 V3 — Plan Review API & Mock Service (Issue #106 / V3-05)
// ============================================================
// Supports:
// - Role-based scoping (Advisor sees only their advisees, Staff sees all)
// - Status filtering & counts aggregation
// - Review decision recording (Approve / Return with reason / Reject with reason)
// ============================================================

import type {
  PlanCounts,
  PlanReviewFilter,
  PlanReviewItem,
  Reviewer,
  ReviewSubmitPayload,
} from '../types/planReview';

import coopPlansRaw from './coopPlansData.json';
import studentsRaw from './studentsData.json';

// ============================================================
// Available Mock Reviewers (Cognito / Role Simulation)
// ============================================================

export const MOCK_REVIEWERS: Reviewer[] = [
  {
    id: 'ADV01',
    name: 'อ.สมชาย ใจดี',
    role: 'ADVISOR',
    roleTitle: 'อาจารย์ที่ปรึกษา (หลักสูตร 61)',
    email: 'somchai.j@cstu.ac.th',
    assignedStudentIds: [
      '6100000001',
      '6100000002',
      '6100000003',
      '6100000004',
      '6100000005',
      '6100000006',
    ],
  },
  {
    id: 'ADV02',
    name: 'อ.สมหญิง รักษา',
    role: 'ADVISOR',
    roleTitle: 'อาจารย์ที่ปรึกษา (หลักสูตร 66)',
    email: 'somying.r@cstu.ac.th',
    assignedStudentIds: [
      '6600000001',
      '6600000002',
      '6600000003',
      '6600000004',
    ],
  },
  {
    id: 'STF01',
    name: 'คุณนภัสสร รัตนโชติ',
    role: 'STAFF',
    roleTitle: 'เจ้าหน้าที่สหกิจศึกษา (ตรวจได้ทุกแผน)',
    email: 'napatsorn.r@cstu.ac.th',
  },
];

let activeReviewerId = 'ADV01';

// Student GPA lookup map
const studentGpaMap = new Map<string, number | null>();
studentsRaw.forEach((s) => {
  studentGpaMap.set(s.studentId, s.gpa ?? null);
});

// Build initial plan review list
function initializePlans(): PlanReviewItem[] {
  return coopPlansRaw.map((p) => {
    let v3Status: PlanReviewItem['status'];

    if (p.status === 'PREPARING') {
      if (p.review_comment) {
        v3Status = 'RETURNED';
      } else {
        v3Status = 'DRAFT';
      }
    } else if (p.status === 'UNDER_REVIEW') {
      v3Status = 'SUBMITTED';
    } else if (p.status === 'APPROVED') {
      v3Status = 'APPROVED';
    } else if (p.status === 'REJECTED') {
      v3Status = 'REJECTED';
    } else {
      v3Status = 'SUBMITTED';
    }

    const advisorName = p.student_id.startsWith('61')
      ? 'อ.สมชาย ใจดี'
      : 'อ.สมหญิง รักษา';

    return {
      plan_id: p.plan_id,
      student_id: p.student_id,
      first_name: p.first_name,
      last_name: p.last_name,
      curriculum: p.curriculum,
      gpa: studentGpaMap.get(p.student_id) ?? null,
      advisor_name: advisorName,
      period_id: p.period_id,
      period_name: p.period_name,
      position_id: p.position_id,
      position_title: p.position_title,
      company_id: p.company_id,
      company_name: p.company_name,
      company_short_name: p.company_short_name,
      status: v3Status,
      submitted_at: p.submitted_at,
      student_note: p.student_note,
      acknowledged_pre_course: p.acknowledged_pre_course,
      terms_accepted_at: p.terms_accepted_at,
      reviewer_name: p.reviewer_name,
      reviewed_at: p.reviewed_at,
      review_comment: p.review_comment,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });
}

// In-memory mock store
let plansStore: PlanReviewItem[] = initializePlans();

// ============================================================
// Reviewer & Auth Methods
// ============================================================

export function getAvailableReviewers(): Reviewer[] {
  return MOCK_REVIEWERS;
}

export function getCurrentReviewer(): Reviewer {
  return (
    MOCK_REVIEWERS.find((r) => r.id === activeReviewerId) ||
    MOCK_REVIEWERS[0]
  );
}

export function setCurrentReviewer(id: string): Reviewer {
  const found = MOCK_REVIEWERS.find((r) => r.id === id);
  if (found) {
    activeReviewerId = found.id;
    return found;
  }
  return getCurrentReviewer();
}

// ============================================================
// Plan Review Query Methods
// ============================================================

/**
 * Filter plans based on reviewer role, status, search, and curriculum.
 */
export async function getReviewPlans(
  filter: PlanReviewFilter = {}
): Promise<PlanReviewItem[]> {
  // Simulate small network delay for realistic UX
  await new Promise((resolve) => setTimeout(resolve, 80));

  const reviewer = filter.reviewerId
    ? MOCK_REVIEWERS.find((r) => r.id === filter.reviewerId) || getCurrentReviewer()
    : getCurrentReviewer();

  return plansStore.filter((plan) => {
    // 1. Role Scoping: Advisor only sees assigned students; Staff sees all
    if (reviewer.role === 'ADVISOR' && reviewer.assignedStudentIds) {
      if (!reviewer.assignedStudentIds.includes(plan.student_id)) {
        return false;
      }
    }

    // 2. Status filter
    if (filter.status && filter.status !== 'ALL') {
      if (plan.status !== filter.status) {
        return false;
      }
    }

    // 3. Curriculum filter
    if (filter.curriculum && filter.curriculum !== 'ALL') {
      if (plan.curriculum !== filter.curriculum) {
        return false;
      }
    }

    // 4. Search filter
    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      const combined = [
        plan.student_id,
        plan.first_name,
        plan.last_name,
        `${plan.first_name} ${plan.last_name}`,
        plan.company_name,
        plan.company_short_name,
        plan.position_title,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!combined.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Aggregates plan count per status for the current reviewer scope.
 */
export async function getPlanReviewCounts(
  reviewerId?: string
): Promise<PlanCounts> {
  const reviewer = reviewerId
    ? MOCK_REVIEWERS.find((r) => r.id === reviewerId) || getCurrentReviewer()
    : getCurrentReviewer();

  const scopedPlans = plansStore.filter((plan) => {
    if (reviewer.role === 'ADVISOR' && reviewer.assignedStudentIds) {
      return reviewer.assignedStudentIds.includes(plan.student_id);
    }
    return true;
  });

  const counts: PlanCounts = {
    ALL: scopedPlans.length,
    SUBMITTED: 0,
    RETURNED: 0,
    APPROVED: 0,
    REJECTED: 0,
    DRAFT: 0,
  };

  scopedPlans.forEach((plan) => {
    if (counts[plan.status] !== undefined) {
      counts[plan.status]++;
    }
  });

  return counts;
}

// ============================================================
// Plan Review Mutation Methods (Issue V3-05.2)
// ============================================================

/**
 * Submit review decision (APPROVE, RETURN, REJECT) with required comment
 * and reviewer attribution.
 */
export async function submitPlanReview(
  payload: ReviewSubmitPayload
): Promise<PlanReviewItem> {
  await new Promise((resolve) => setTimeout(resolve, 150));

  const planIndex = plansStore.findIndex((p) => p.plan_id === payload.planId);
  if (planIndex === -1) {
    throw new Error(`ไม่พบแผนหมายเลข ${payload.planId}`);
  }

  // Validation as required by V3-05.2 & Section 2.5:
  // Comments are mandatory for RETURNED and REJECTED
  if (
    (payload.decision === 'RETURNED' || payload.decision === 'REJECTED') &&
    !payload.comment.trim()
  ) {
    throw new Error('กรุณาระบุเหตุผลหรือความคิดเห็นในการส่งกลับ/ไม่อนุมัติแผน');
  }

  const currentPlan = plansStore[planIndex];
  const now = new Date().toISOString();

  const updatedPlan: PlanReviewItem = {
    ...currentPlan,
    status: payload.decision,
    reviewer_name: payload.reviewerName,
    reviewed_at: now,
    review_comment: payload.comment.trim() || null,
    updated_at: now,
  };

  plansStore[planIndex] = updatedPlan;

  return updatedPlan;
}

/**
 * Reset local store to original state (useful for test & demo).
 */
export function resetPlansStore(): void {
  plansStore = initializePlans();
}
