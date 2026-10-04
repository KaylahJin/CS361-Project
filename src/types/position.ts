// ============================================================
// CS361 V2 — Position / Project Type Definitions
// ============================================================
// Issue: #38 — พัฒนา API สำหรับเรียกข้อมูล Position/Project
// Maps to: docs/overview/position.md & RDS `positions` table
// ============================================================

export type PositionCategory =
  | 'software_development'
  | 'data_ai'
  | 'cloud_infrastructure_devops'
  | 'qa_testing'
  | 'business_enterprise_systems'
  | 'it_support_operations'
  | 'ux_ui_design'
  | 'cybersecurity'
  | 'technical_sales'
  | 'it_solutions'
  | 'other';

export type WorkMode = 'onsite' | 'hybrid' | 'remote' | 'unknown';

export type PositionStatus = 'open' | 'closed' | 'expired' | 'unknown';

/** Core Position type — mirrors RDS `positions` table + joined company info */
export interface Position {
  position_id: string;                  // PK, e.g. 'POS001'
  company_id: string;                   // FK -> companies.company_id
  company_name?: string;                // Joined company full name
  company_short_name?: string;          // Joined company short name
  company_logo?: string;                // Joined company logo filename
  company_province?: string;            // Joined company province
  title: string;                        // Position title
  category: PositionCategory;           // Standardized category
  description?: string | null;          // Details / duration / allowance
  qualification?: string | null;        // Candidate qualifications
  location?: string | null;             // Work location
  work_mode: WorkMode;                  // onsite | hybrid | remote | unknown
  application_deadline?: string | null; // Date (YYYY-MM-DD) or null
  application_url?: string | null;      // Direct apply link
  status: PositionStatus;               // open | closed | expired | unknown
  source_url?: string | null;           // Announcement source URL
  created_at?: string;                  // Timestamp
}

/** Query parameters for GET /positions */
export interface PositionQueryParams {
  search?: string;                      // Search by title or company name
  category?: PositionCategory | string; // Filter by category
  work_mode?: WorkMode | string;        // Filter by work mode
  status?: PositionStatus | string;     // Filter by status
  company_id?: string;                  // Filter by company
}

/** Human-readable category display names */
export const CATEGORY_LABELS: Record<PositionCategory, string> = {
  software_development: 'Software & Web Development',
  data_ai: 'Data Science & AI',
  cloud_infrastructure_devops: 'Cloud & DevOps',
  qa_testing: 'QA & Software Testing',
  business_enterprise_systems: 'Business & System Analysis',
  it_support_operations: 'IT Support & Operations',
  ux_ui_design: 'UX/UI Design',
  cybersecurity: 'Cybersecurity',
  technical_sales: 'Technical Sales',
  it_solutions: 'IT Solutions',
  other: 'Other',
};

/** Human-readable work mode display names */
export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote / WFH',
  unknown: 'ไม่ระบุ',
};

/** Human-readable status display names */
export const STATUS_LABELS: Record<PositionStatus, string> = {
  open: 'เปิดรับสมัคร',
  closed: 'ปิดรับสมัคร',
  expired: 'หมดเขตรับสมัคร',
  unknown: 'ไม่ระบุสถานะ',
};
