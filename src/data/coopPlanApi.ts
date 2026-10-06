// ============================================================
// CS361 V2 — Coop Plan API Client
// ============================================================
// Calls: API Gateway → Lambda → RDS PostgreSQL
//
// Fallback:
// - API timeout after 10 seconds
// - API error
// - API unavailable
// → use local coopPlansData.json
// ============================================================

import type {
  CoopPlan,
  CoopPlanQueryParams,
} from '../types/coopPlan';

import coopPlansData from './coopPlansData.json';

const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

const API_TIMEOUT = 10000;

export class CoopPlanApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CoopPlanApiError';
    this.status = status;
  }
}

// ============================================================
// Local fallback data
// ============================================================

const localCoopPlans = coopPlansData as CoopPlan[];

// ============================================================
// Fetch with timeout
// ============================================================

async function fetchWithTimeout(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, API_TIMEOUT);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// Local fallback — filter
// ============================================================

function filterLocalCoopPlans(
  params?: CoopPlanQueryParams
): CoopPlan[] {
  if (!params) {
    return localCoopPlans;
  }

  const search = params.search?.trim().toLowerCase();
  const status = params.status?.trim();
  const studentId = params.studentId?.trim();
  const curriculum = params.curriculum?.trim();
  const periodId = params.periodId?.trim();
  const companyId = params.companyId?.trim();
  const positionId = params.positionId?.trim();

  return localCoopPlans.filter((plan) => {
    // --------------------------------------------------------
    // Search
    // --------------------------------------------------------

    if (search) {
      const searchableText = [
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

      if (!searchableText.includes(search)) {
        return false;
      }
    }

    // --------------------------------------------------------
    // Status
    // --------------------------------------------------------

    if (status && plan.status !== status) {
      return false;
    }

    // --------------------------------------------------------
    // Student
    // --------------------------------------------------------

    if (studentId && plan.student_id !== studentId) {
      return false;
    }

    // --------------------------------------------------------
    // Curriculum
    // --------------------------------------------------------

    if (curriculum && plan.curriculum !== curriculum) {
      return false;
    }

    // --------------------------------------------------------
    // Period
    // --------------------------------------------------------

    if (periodId && plan.period_id !== periodId) {
      return false;
    }

    // --------------------------------------------------------
    // Company
    // --------------------------------------------------------

    if (companyId && plan.company_id !== companyId) {
      return false;
    }

    // --------------------------------------------------------
    // Position
    // --------------------------------------------------------

    if (positionId && plan.position_id !== positionId) {
      return false;
    }

    // --------------------------------------------------------
    // Submitted date
    // --------------------------------------------------------

    if (params.submittedFrom && plan.submitted_at) {
      if (
        plan.submitted_at <
        `${params.submittedFrom}T00:00:00`
      ) {
        return false;
      }
    }

    if (params.submittedTo && plan.submitted_at) {
      if (
        plan.submitted_at >
        `${params.submittedTo}T23:59:59`
      ) {
        return false;
      }
    }

    return true;
  });
}

// ============================================================
// GET /coop-plans
// ============================================================

/**
 * Fetch coop plans with optional search + filters.
 *
 * API is tried first.
 * If API fails or times out after 10 seconds,
 * local coopPlansData.json is used instead.
 */
export async function getCoopPlans(
  params?: CoopPlanQueryParams
): Promise<CoopPlan[]> {
  const qs = new URLSearchParams();

  if (params?.status) {
    qs.set('status', params.status);
  }

  if (params?.studentId) {
    qs.set('studentId', params.studentId);
  }

  if (params?.search) {
    qs.set('search', params.search);
  }

  if (params?.curriculum) {
    qs.set('curriculum', params.curriculum);
  }

  if (params?.periodId) {
    qs.set('periodId', params.periodId);
  }

  if (params?.companyId) {
    qs.set('companyId', params.companyId);
  }

  if (params?.positionId) {
    qs.set('positionId', params.positionId);
  }

  if (params?.submittedFrom) {
    qs.set('submittedFrom', params.submittedFrom);
  }

  if (params?.submittedTo) {
    qs.set('submittedTo', params.submittedTo);
  }

  const queryStr = qs.toString();

  const url = `${API_BASE}/coop-plans${
    queryStr ? `?${queryStr}` : ''
  }`;

  try {
    const res = await fetchWithTimeout(url);

    if (!res.ok) {
      throw new CoopPlanApiError(
        `Failed to fetch coop plans: ${res.statusText}`,
        res.status
      );
    }

    return await res.json();
  } catch (error) {
    console.warn(
      'Coop Plan API unavailable. Using local coopPlansData.json.',
      error
    );

    return filterLocalCoopPlans(params);
  }
}

// ============================================================
// GET /coop-plans/{planId}
// ============================================================

/**
 * Fetch a single coop plan by ID.
 *
 * API is tried first.
 * If API fails or times out after 10 seconds,
 * local coopPlansData.json is used instead.
 */
export async function getCoopPlan(
  planId: number
): Promise<CoopPlan> {
  const url = `${API_BASE}/coop-plans/${encodeURIComponent(
    planId
  )}`;

  try {
    const res = await fetchWithTimeout(url);

    if (!res.ok) {
      throw new CoopPlanApiError(
        `Failed to fetch coop plan ${planId}: ${res.statusText}`,
        res.status
      );
    }

    return await res.json();
  } catch (error) {
    console.warn(
      `Coop Plan API unavailable for plan ${planId}. Using local coopPlansData.json.`,
      error
    );

    const localPlan = localCoopPlans.find(
      (plan) => plan.plan_id === planId
    );

    if (!localPlan) {
      throw new CoopPlanApiError(
        `Coop plan ${planId} not found`,
        404
      );
    }

    return localPlan;
  }
}