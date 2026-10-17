import type {
  Student,
  StudentDetail,
  StudentQueryParams,
} from '../types/student';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Both student routes are behind the JWT authorizer, so without this header
 * the request is refused with 401 before the Lambda runs. Pass
 * `useAuth().getIdToken()`, read right before the call and never cached: a
 * token read once and kept would outlive the session it belongs to.
 */
function authHeaders(idToken?: string | null): RequestInit | undefined {
  if (!idToken) return undefined;
  return { headers: { Authorization: `Bearer ${idToken}` } };
}

export class StudentApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'StudentApiError';
    this.status = status;
  }
}

/**
 * Fetch students with optional search and curriculum filter.
 */
export async function getStudents(
  params?: StudentQueryParams,
  idToken?: string | null
): Promise<Student[]> {
  const qs = new URLSearchParams();

  if (params?.search) {
    qs.set('search', params.search);
  }

  if (params?.curriculum) {
    qs.set('curriculum', params.curriculum);
  }

  const queryString = qs.toString();

  const url = `${API_BASE}/students${
    queryString ? `?${queryString}` : ''
  }`;

  const res = await fetch(url, authHeaders(idToken));

  if (!res.ok) {
    throw new StudentApiError(
      `Failed to fetch students: ${res.statusText}`,
      res.status
    );
  }

  return res.json();
}

/**
 * Fetch a single student with course history.
 */
export async function getStudent(
  studentId: string,
  idToken?: string | null
): Promise<StudentDetail> {
  const url = `${API_BASE}/students/${encodeURIComponent(studentId)}`;

  const res = await fetch(url, authHeaders(idToken));

  if (!res.ok) {
    throw new StudentApiError(
      `Failed to fetch student ${studentId}: ${res.statusText}`,
      res.status
    );
  }

  return res.json();
}