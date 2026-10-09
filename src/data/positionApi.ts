// ============================================================
// CS361 V2 — Position / Project API Client
// ============================================================
// Issue: #38 — พัฒนา API สำหรับเรียกข้อมูล Position/Project
// Calls: API Gateway → Lambda → RDS PostgreSQL
// ============================================================

import type { Position, PositionQueryParams } from '../types/position';

import fallbackPositions from './positionsData.json';

const API_BASE = import.meta.env.VITE_API_URL || '';

export class PositionApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PositionApiError';
    this.status = status;
  }
}

/**
 * Fetch positions with optional search & filter parameters.
 *
 * @param params - Optional query parameters (search, category, work_mode, status, company_id)
 * @returns Promise<Position[]> - List of positions
 */
export async function getPositions(
  params?: PositionQueryParams
): Promise<Position[]> {
  try {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.category) qs.set('category', params.category);
    if (params?.work_mode) qs.set('work_mode', params.work_mode);
    if (params?.status) qs.set('status', params.status);
    if (params?.company_id) qs.set('company_id', params.company_id);

    const queryStr = qs.toString();
    const url = `${API_BASE}/positions${queryStr ? `?${queryStr}` : ''}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new PositionApiError(
        `Failed to fetch positions: ${res.statusText}`,
        res.status
      );
    }

    return await res.json();
  } catch (err) {
    // If network error (dev server stopped or offline), fallback gracefully to local dataset
    if (err instanceof TypeError && err.message.includes('fetch')) {
      console.warn('Backend API unreachable, using local fallback positions data:', err);
      let filtered = (fallbackPositions || []) as unknown as Position[];
      if (params?.search) {
        const rawSearch = params.search.toLowerCase().trim();
        const tokens = rawSearch.split(/\s+/).filter(Boolean);
        filtered = filtered.filter((p) => {
          const searchableText = [
            p.title,
            p.company_name,
            p.company_short_name,
            p.location,
            p.description,
            p.qualification,
            p.application_url,
            p.company_url,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return (
            searchableText.includes(rawSearch) ||
            tokens.every((t) => searchableText.includes(t)) ||
            tokens.some((t) => t.length >= 3 && searchableText.includes(t))
          );
        });
      }
      if (params?.category) {
        filtered = filtered.filter((p) => p.category === params.category);
      }
      if (params?.work_mode) {
        filtered = filtered.filter((p) => p.work_mode === params.work_mode);
      }
      if (params?.status) {
        filtered = filtered.filter((p) => p.status === params.status);
      }
      if (params?.company_id) {
        filtered = filtered.filter((p) => p.company_id === params.company_id);
      }
      return filtered;
    }
    throw err;
  }
}

/**
 * Fetch a single position by ID.
 *
 * @param positionId - Position ID (e.g. 'POS001')
 * @returns Promise<Position> - Position details with joined company information
 */
export async function getPosition(positionId: string): Promise<Position> {
  const url = `${API_BASE}/positions/${encodeURIComponent(positionId)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new PositionApiError(
      `Failed to fetch position ${positionId}: ${res.statusText}`,
      res.status
    );
  }

  return res.json();
}
