// ============================================================
// CS361 V2 — Coop Info API Client
// ============================================================
// Issue: #60 — เชื่อมข้อมูลข้อกำหนดสหกิจเข้ากับหน้า Requirements
// Calls: API Gateway → Lambda → RDS PostgreSQL
// ============================================================

import type { CoopInfo, CoopInfoQueryParams } from '../types/coopInfo';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class CoopInfoApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CoopInfoApiError';
    this.status = status;
  }
}

/** Fetch coop info with optional search + filters */
export async function getCoopInfo(
  params?: CoopInfoQueryParams
): Promise<CoopInfo[]> {
  const qs = new URLSearchParams();

  if (params?.search) qs.set('search', params.search);
  if (params?.category) qs.set('category', params.category);
  if (params?.curriculum) qs.set('curriculum', params.curriculum);

  const queryStr = qs.toString();
  const url = `${API_BASE}/coop-info${queryStr ? `?${queryStr}` : ''}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new CoopInfoApiError(
      `Failed to fetch coop info: ${res.statusText}`,
      res.status
    );
  }

  return res.json();
}