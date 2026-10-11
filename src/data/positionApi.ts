// ============================================================
// CS361 V2 — Position / Project API Client
// ============================================================
// Issue: #38 — พัฒนา API สำหรับเรียกข้อมูล Position/Project
// Calls: API Gateway → Lambda → RDS PostgreSQL
// ============================================================

import type { Position, PositionQueryParams } from '../types/position';

const API_BASE = import.meta.env.VITE_API_URL || '';

export class PositionApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PositionApiError';
    this.status = status;
  }
}

async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    // ถูกยกเลิกโดย AbortController ให้โยนต่อไปตามเดิม
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // เครือข่ายล้มเหลว (offline / CORS / server ล่ม)
    throw new PositionApiError(
      'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
      0
    );
  }

  if (!res.ok) {
    throw new PositionApiError(`โหลดข้อมูลไม่สำเร็จ (รหัส ${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch positions with optional search & filter parameters.
 *
 * @param params - Optional query parameters (search, category, work_mode, status, company_id)
 * @returns Promise<Position[]> - List of positions
 */
export async function getPositions(
  params?: PositionQueryParams,
  options?: { signal?: AbortSignal }
): Promise<Position[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.category) qs.set('category', params.category);
  if (params?.work_mode) qs.set('work_mode', params.work_mode);
  if (params?.status) qs.set('status', params.status);
  if (params?.company_id) qs.set('company_id', params.company_id);

  const queryStr = qs.toString();
  const url = `${API_BASE}/positions${queryStr ? `?${queryStr}` : ''}`;
  return request<Position[]>(url, options?.signal);
}

/**
 * Fetch a single position by ID.
 *
 * @param positionId - Position ID (e.g. 'POS001')
 * @returns Promise<Position> - Position details with joined company information
 */
export async function getPosition(positionId: string): Promise<Position> {
  const url = `${API_BASE}/positions/${encodeURIComponent(positionId)}`;
  return request<Position>(url);
}
