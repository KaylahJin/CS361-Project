// ============================================================
// CS361 V2 — Company API Client
// ============================================================
// Issue: #26 — ทำการเรียกข้อมูลสถานประกอบการ
// Calls: API Gateway → Lambda → RDS PostgreSQL
// ============================================================

import type { Company, CompanyQueryParams } from '../types/company';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class CompanyApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CompanyApiError';
    this.status = status;
  }
}

/** Fetch companies with optional search + filter */
export async function getCompanies(
  params?: CompanyQueryParams
): Promise<Company[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.province) qs.set('province', params.province);

  const queryStr = qs.toString();
  const url = `${API_BASE}/companies${queryStr ? `?${queryStr}` : ''}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new CompanyApiError(
      `Failed to fetch companies: ${res.statusText}`,
      res.status
    );
  }

  return res.json();
}

/** Fetch a single company by ID */
export async function getCompany(companyId: string): Promise<Company> {
  const url = `${API_BASE}/companies/${encodeURIComponent(companyId)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new CompanyApiError(
      `Failed to fetch company ${companyId}: ${res.statusText}`,
      res.status
    );
  }

  return res.json();
}
