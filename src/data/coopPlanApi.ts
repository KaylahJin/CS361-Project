// Coop plan API client: API Gateway, Lambda, then RDS.
//
// Both routes are behind the JWT authorizer, so both functions take the
// Cognito ID token and send it as a Bearer header.
//
// The bundled coopPlansData.json is used only when the API cannot be reached
// at all — network failure or the timeout. Any HTTP status is re-thrown
// instead, because that file holds every student's name, note and review
// comments: serving it after a 401 would publish the data the authorizer had
// just refused.

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

const localCoopPlans = coopPlansData as CoopPlan[];

/**
 * Without this header the request is rejected with 401 before the Lambda
 * runs. Pass `useAuth().getIdToken()`, read right before the call.
 */
function authHeaders(idToken?: string | null): RequestInit | undefined {
  if (!idToken) return undefined;
  return { headers: { Authorization: `Bearer ${idToken}` } };
}

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


    if (status && plan.status !== status) {
      return false;
    }


    if (studentId && plan.student_id !== studentId) {
      return false;
    }


    if (curriculum && plan.curriculum !== curriculum) {
      return false;
    }


    if (periodId && plan.period_id !== periodId) {
      return false;
    }


    if (companyId && plan.company_id !== companyId) {
      return false;
    }


    if (positionId && plan.position_id !== positionId) {
      return false;
    }


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

export async function getCoopPlans(
  params?: CoopPlanQueryParams,
  idToken?: string | null
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
    const res = await fetchWithTimeout(url, authHeaders(idToken));

    if (!res.ok) {
      throw new CoopPlanApiError(
        `Failed to fetch coop plans: ${res.statusText}`,
        res.status
      );
    }

    return await res.json();
  } catch (error) {
    // An answer from the server is never a reason to fall back. A 401 or 403
    // means the rules worked, and a 5xx is a real fault worth showing.
    if (error instanceof CoopPlanApiError) {
      throw error;
    }

    console.warn(
      'Coop Plan API unreachable. Using local coopPlansData.json.',
      error
    );

    return filterLocalCoopPlans(params);
  }
}

export async function getCoopPlan(
  planId: number,
  idToken?: string | null
): Promise<CoopPlan> {
  const url = `${API_BASE}/coop-plans/${encodeURIComponent(
    planId
  )}`;

  try {
    const res = await fetchWithTimeout(url, authHeaders(idToken));

    if (!res.ok) {
      throw new CoopPlanApiError(
        `Failed to fetch coop plan ${planId}: ${res.statusText}`,
        res.status
      );
    }

    return await res.json();
  } catch (error) {
    // As in getCoopPlans: a status from the server is the answer, never a
    // reason to serve the bundled copy of someone's plan.
    if (error instanceof CoopPlanApiError) {
      throw error;
    }

    console.warn(
      `Coop Plan API unreachable for plan ${planId}. Using local coopPlansData.json.`,
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