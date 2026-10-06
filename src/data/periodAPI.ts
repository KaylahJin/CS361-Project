// ============================================================
// CS361 V2 — Period & Schedule API Client
// ============================================================
// Issue: #49 — กำหนดการสหกิจศึกษา (Home / Timeline)
// Issue: #50 — Filter / Search ตามรอบเวลา / ประเภทกิจกรรม
// Calls: API Gateway → Lambda → RDS PostgreSQL
// ============================================================

import type { ScheduleTimelineResponse, ActivityType } from '../types/period';

const API_BASE = import.meta.env.VITE_API_URL;

export interface PeriodFilterParams {
  search?: string;
  period_id?: string;
  activity_type?: ActivityType;
}

export class PeriodApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PeriodApiError';
    this.status = status;
  }
}

/** Fetch active period and timeline schedules */

export async function getPeriodTimeline(filters: PeriodFilterParams = {}): Promise<ScheduleTimelineResponse> {
  const query = new URLSearchParams();

  // Search
  if (filters.search?.trim()) {
    query.set('search', filters.search.trim());
  }

  // Filter by period
  if (filters.period_id?.trim()) {
    query.set('period_id', filters.period_id.trim());
  }

  // Filter by activity type
  if (filters.activity_type) {
    query.set('activity_type', filters.activity_type);
  }

  const queryString = query.toString();

  const url = queryString
    ? `${API_BASE}/periods?${queryString}`
    : `${API_BASE}/periods`;

  const res = await fetch(url, {
    method: 'GET',

    headers: {
      Accept: 'application/json',
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