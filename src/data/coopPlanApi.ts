// Coop plan API client: API Gateway, Lambda, then RDS.
//
// Both routes are behind the JWT authorizer, so both functions take the
// Cognito ID token and send it as a Bearer header.
//
// There is no bundled fallback. coopPlansData.json used to serve that role,
// but it carried every student's id, name, note and review comments, and
// anything imported here is compiled into the public JS bundle — readable
// without signing in, which is exactly what the authorizer exists to stop.
// A request that cannot be answered now fails, and the page says so.

import type {
  CoopPlan,
  CoopPlanQueryParams,
} from '../types/coopPlan';

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
    if (error instanceof CoopPlanApiError) {
      throw error;
    }

    console.warn('Coop Plan API unreachable.', error);

    throw error;
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
    if (error instanceof CoopPlanApiError) {
      throw error;
    }

    console.warn(`Coop Plan API unreachable for plan ${planId}.`, error);

    throw error;
  }
}

export async function reviewCoopPlan(
  planId: number,
  decision: 'APPROVED' | 'RETURNED' | 'REJECTED',
  comment?: string,
  idToken?: string | null
): Promise<CoopPlan> {
  const url = `${API_BASE}/coop-plans/${encodeURIComponent(planId)}/review`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ decision, comment: comment || '' }),
    });

    if (!res.ok) {
      let errorMsg = `Failed to review coop plan: ${res.statusText}`;
      try {
        const errJson = await res.json();
        if (errJson?.error) errorMsg = errJson.error;
      } catch {
        // use default
      }
      throw new CoopPlanApiError(errorMsg, res.status);
    }

    return await res.json();
  } catch (error) {
    if (error instanceof CoopPlanApiError) {
      throw error;
    }

    console.warn(`Coop Plan review API unreachable for plan ${planId}.`, error);
    throw error;
  }
}