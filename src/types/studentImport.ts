export type ImportStatus = "INSERTED" | "UPDATED" | "SKIPPED" | "FAILED";

export interface ImportRowResult {
  file: string;
  row: number;
  key: string;
  status: ImportStatus;
  message: string;
}

export interface ImportSummary {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  results: ImportRowResult[];
}

export interface StudentImportRecord {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  birth_date: string | null;
  curriculum: string;
  gpa: number | null;
}

export type StudentCourseStatus = "ENROLLED" | "PASSED" | "FAILED";

export interface StudentCourseImportRecord {
  student_id: string;
  course_code: string;
  status: StudentCourseStatus;
  grade_point: number | null;
}

export interface CsvRecord<T> {
  rowNumber: number;
  value: T;
}