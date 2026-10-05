// ============================================================
// CS361 V2 — Period & Schedule API Client
// ============================================================
// Issue: #49 — กำหนดการสหกิจศึกษา (Home / Timeline)
// Calls: API Gateway → Lambda → RDS PostgreSQL
// ============================================================

import type { ScheduleTimelineResponse } from '../types/period';

const API_BASE = import.meta.env.VITE_API_URL || 'https://85dwh6cbtf.execute-api.us-east-1.amazonaws.com';

export class PeriodApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PeriodApiError';
    this.status = status;
  }
}

/** Fetch active period and timeline schedules */
export async function getPeriodTimeline(): Promise<ScheduleTimelineResponse> {
  const url = `${API_BASE}/periods`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new PeriodApiError(
      `Failed to fetch period timeline: ${res.statusText}`,
      res.status
    );
  }

  return res.json();
}