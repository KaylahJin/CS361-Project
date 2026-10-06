import type {
  Student,
  StudentDetail,
  StudentQueryParams,
} from '../types/student';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
  params?: StudentQueryParams
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

  const res = await fetch(url);

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
  studentId: string
): Promise<StudentDetail> {
  const url = `${API_BASE}/students/${encodeURIComponent(studentId)}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new StudentApiError(
      `Failed to fetch student ${studentId}: ${res.statusText}`,
      res.status
    );
  }

  return res.json();
}