// ============================================================
// CS361 V2 — Company Type Definitions
// ============================================================
// Issue: #24 — ออกแบบข้อมูลสถานประกอบการที่จำเป็น
// Maps to: infra/schema.sql → companies table
// ============================================================

/** Core Company type — mirrors RDS `companies` table */
export interface Company {
  company_id: string;       // PK — e.g. 'C01'
  name: string;             // ชื่อเต็มภาษาไทย
  short_name?: string;      // ชื่อย่อ/อังกฤษ (e.g. 'SCB', 'CDG Group')
  province: string;         // จังหวัด (สำหรับ filter)
  location: string;         // ที่อยู่เต็ม
  description?: string;     // รายละเอียดเพิ่มเติม (V3+)
  logo_filename?: string;   // ชื่อไฟล์ logo (public/images/logos/)
  url?: string;             // ลิงก์เว็บไซต์
  created_at?: string;      // ISO timestamp
}

/** Query parameters for GET /companies */
export interface CompanyQueryParams {
  search?: string;          // ค้นหาจากชื่อบริษัท (ILIKE)
  province?: string;        // กรองตามจังหวัด
}

/** API response wrapper */
export interface CompanyListResponse {
  companies: Company[];
  total: number;
}

/** Province list (for filter dropdown) */
export interface ProvinceOption {
  province: string;
  count: number;
}