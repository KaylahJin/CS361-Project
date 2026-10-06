// ============================================================
// CS361 V2 — Coop Info Type Definitions
// ============================================================
// Issue: #60 — เชื่อมข้อมูลข้อกำหนดสหกิจเข้ากับหน้า Requirements
// Maps to: infra/schema.sql → coop_info table
// ============================================================

export interface CoopInfo {
  info_id: number;
  item_number: number;
  curriculum: string;
  category: string;
  title: string;
  description: string;
  gpa_requirement: string | null;
  academic_year: number;
  created_at: string;
}

export interface CoopInfoQueryParams {
  search?: string;
  category?: string;
  curriculum?: string;
}