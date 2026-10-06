// ============================================================
// CS361 V2 — Period & Schedule Type Definitions
// ============================================================
// Issue: Feature #47 — Data Schema สำหรับ Period/Schedule
// Maps to: infra/schema.sql → periods & coop_schedules tables
// ============================================================

export type ActivityType =
  | 'APPLICATION'
  | 'ORIENTATION'
  | 'INTERVIEW'
  | 'WORK_PERIOD'
  | 'SUBMISSION';

/** Core Period model — mirrors RDS `periods` table */
export interface Period {
  period_id: string;        // PK — e.g. 'P2568-1'
  name: string;             // ชื่อรอบเต็ม e.g. 'ภาคการศึกษาที่ 1/2568'
  academic_year: number;    // ปีการศึกษา (Filter หลัก) e.g. 2568
  semester: string;         // '1', '2', 'summer'
  is_active: boolean;       // รอบปัจจุบันหรือไม่
  created_at?: string;
}

/** Milestone schedule item — mirrors RDS `coop_schedules` table */
export interface CoopSchedule {
  schedule_id: string;      // PK — e.g. 'SCH-2568-01'
  period_id: string;        // FK → periods.period_id
  step_order: number;       // ลำดับขั้นตอนไทม์ไลน์ 1..N
  title: string;            // ชื่องาน/กิจกรรม
  description?: string;     // รายละเอียด
  activity_type: ActivityType; // สำหรับทำ Filter Tabs
  start_date: string;       // YYYY-MM-DD
  end_date: string;         // YYYY-MM-DD
  created_at?: string;
}

/** API Response สำหรับหน้า Timeline กำหนดการ */
export interface ScheduleTimelineResponse {
  period: Period;
  schedules: CoopSchedule[];
}

/** Query Parameters สำหรับค้นหาและกรอง */
export interface ScheduleQueryParams {
  period_id?: string;
  academic_year?: number;
  activity_type?: ActivityType;
}