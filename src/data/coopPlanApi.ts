// Coop plan API client: API Gateway, Lambda, then RDS.
//
// Every route is behind the JWT authorizer, so every function takes the
// Cognito ID token and sends it as a Bearer header.
//
// There is no bundled fallback. coopPlansData.json used to serve that role,
// but it carried every student's id, name, note and review comments, and
// anything imported here is compiled into the public JS bundle — readable
// without signing in, which is exactly what the authorizer exists to stop.
// A request that cannot be answered now fails, and the page says so.

import type {
  CoopPlan,
  CoopPlanQueryParams,
  CreateCoopPlanInput,
  UpdateCoopPlanInput,
} from '../types/coopPlan';
import type { EndorseDecision, PlanEligibility, ScreenDecision, SelectDecision } from '../types/planReview';

const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:3000';

const API_TIMEOUT = 10000;

export class CoopPlanApiError extends Error {
  status: number;
  code?: string;
  details?: Array<{ code?: string; message?: string }>;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: Array<{ code?: string; message?: string }>
  ) {
    super(message);
    this.name = 'CoopPlanApiError';
    this.status = status;
    this.code = code;
    this.details = details;
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

/** Headers for a request that carries a JSON body. */
function jsonWriteHeaders(idToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  return headers;
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
/**
 * Builds the error for a failed write. The API answers with
 * `{ error, code, message }`; only `code` is kept, because it is what the page
 * maps to text. A body that is missing or is not JSON (a gateway error page,
 * an authorizer 401) leaves the code undefined and the status still tells the
 * page enough.
 */
async function writeError(
  res: Response,
  action: string
): Promise<CoopPlanApiError> {
  let code: string | undefined;
  let details: Array<{ code?: string; message?: string }> | undefined;

  try {
    const body: unknown = await res.json();

    if (body && typeof body === 'object') {
      const payload = body as {
        code?: unknown;
        failures?: unknown;
        details?: unknown;
      };

      if (typeof payload.code === 'string') {
        code = payload.code;
      }

      const rawDetails = Array.isArray(payload.failures)
        ? payload.failures
        : payload.details;

      if (Array.isArray(rawDetails)) {
        details = rawDetails.filter(
          (item): item is { code?: string; message?: string } =>
            Boolean(item) &&
            typeof item === 'object' &&
            (
              typeof (item as { code?: unknown }).code === 'string' ||
              typeof (item as { message?: unknown }).message === 'string'
            )
        );
      }
    }
  } catch {
    // No usable JSON body. Keep the HTTP status.
  }

  return new CoopPlanApiError(
    `Failed to ${action}: ${res.statusText}`,
    res.status,
    code,
    details
  );
}

/**
 * Starts a draft (POST /coop-plans). The plan is created PREPARING, which is a
 * draft, not a submission. The owner is never sent: the API reads it from the
 * token. Resolves with the created plan.
 */
export async function createCoopPlan(
  input: CreateCoopPlanInput,
  idToken?: string | null
): Promise<CoopPlan> {
  const url = `${API_BASE}/coop-plans`;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: jsonWriteHeaders(idToken),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw await writeError(res, 'create coop plan');
    }

    return await res.json();
  } catch (error) {
    if (error instanceof CoopPlanApiError) {
      throw error;
    }

    console.warn('Coop Plan API unreachable on create.', error);

    throw error;
  }
}

/**
 * Saves edits to a draft or returned plan (PATCH /coop-plans/{planId}). Send
 * only what changed. Resolves with the plan as the database now holds it.
 */
export async function updateCoopPlan(
  planId: number,
  input: UpdateCoopPlanInput,
  idToken?: string | null
): Promise<CoopPlan> {
  const url = `${API_BASE}/coop-plans/${encodeURIComponent(planId)}`;

  try {
    const res = await fetchWithTimeout(url, {
      method: 'PATCH',
      headers: jsonWriteHeaders(idToken),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw await writeError(res, `update coop plan ${planId}`);
    }

    return await res.json();
  } catch (error) {
    if (error instanceof CoopPlanApiError) {
      throw error;
    }

    console.warn(`Coop Plan API unreachable on update of plan ${planId}.`, error);

    throw error;
  }
}

/**
 * Submit a saved coop plan.
 *
 * The API must verify ownership, eligibility, submission window,
 * current status and duplicate submissions on the server.
 *
 * The frontend does not send a student ID and does not decide
 * whether the student is eligible.
 */
export async function submitCoopPlan(
  planId: number,
  idToken?: string | null
): Promise<CoopPlan> {
  const url = `${API_BASE}/coop-plans/${encodeURIComponent(planId)}/submit`;

  try {
    const headers: Record<string, string> = {};

    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
    });

    if (!res.ok) {
      throw await writeError(res, 'submit coop plan');
    }

    return await res.json();
  } catch (error) {
    if (error instanceof CoopPlanApiError) {
      throw error;
    }

    console.warn(
      `Coop Plan API unreachable on submit of plan ${planId}.`,
      error
    );

    throw error;
  }
}

/**
 * Advisor endorsement (POST /coop-plans/{planId}/endorse, #147). Resolves with
 * the plan as saved: ENDORSED, or RETURNED when not endorsed. 409 means the
 * plan was no longer SUBMITTED.
 */
export async function endorseCoopPlan(
  planId: number,
  decision: EndorseDecision,
  comment: string,
  idToken?: string | null
): Promise<CoopPlan> {
  const url = `${API_BASE}/coop-plans/${encodeURIComponent(planId)}/endorse`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: jsonWriteHeaders(idToken),
    body: JSON.stringify(comment ? { decision, comment } : { decision }),
  });

  if (!res.ok) {
    throw await writeError(res, `endorse coop plan ${planId}`);
  }
  return await res.json();
}

/**
 * Staff screening (POST /coop-plans/{planId}/screen, #148). Resolves with the
 * plan as saved: ELIGIBLE, NOT_ELIGIBLE, or RETURNED when INCOMPLETE. 409
 * means the plan was no longer ENDORSED.
 */
export async function screenCoopPlan(
  planId: number,
  decision: ScreenDecision,
  comment: string,
  idToken?: string | null
): Promise<CoopPlan> {
  const url = `${API_BASE}/coop-plans/${encodeURIComponent(planId)}/screen`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: jsonWriteHeaders(idToken),
    body: JSON.stringify(comment ? { decision, comment } : { decision }),
  });

  if (!res.ok) {
    throw await writeError(res, `screen coop plan ${planId}`);
  }
  return await res.json();
}

/**
 * Committee selection (POST /coop-plans/{planId}/select, #149). Resolves with
 * the plan as saved. 409 carries CAPACITY_REACHED / CAPACITY_NOT_SET when no
 * seat can be given, PLAN_NOT_SELECTABLE when the plan was no longer ELIGIBLE.
 */
export async function selectCoopPlan(
  planId: number,
  decision: SelectDecision,
  comment: string,
  idToken?: string | null
): Promise<CoopPlan> {
  const url = `${API_BASE}/coop-plans/${encodeURIComponent(planId)}/select`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: jsonWriteHeaders(idToken),
    body: JSON.stringify(comment ? { decision, comment } : { decision }),
  });

  if (!res.ok) {
    throw await writeError(res, `select coop plan ${planId}`);
  }
  return await res.json();
}

/** The plan's student against its period's criteria (GET /coop-plans/{planId}/eligibility, #148). */
export async function getPlanEligibility(
  planId: number,
  idToken?: string | null
): Promise<PlanEligibility> {
  const url = `${API_BASE}/coop-plans/${encodeURIComponent(planId)}/eligibility`;
  const res = await fetchWithTimeout(url, authHeaders(idToken));

  if (!res.ok) {
    throw new CoopPlanApiError(`Failed to fetch eligibility for plan ${planId}: ${res.statusText}`, res.status);
  }
  return await res.json();
}
