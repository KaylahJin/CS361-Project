import { parse } from "csv-parse/sync";
import type {
  CsvRecord,
  StudentCourseImportRecord,
  StudentCourseStatus,
  StudentImportRecord,
} from "../../../../src/types/studentImport.js";

export class RowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RowValidationError";
  }
}

function parseCsv<T>(contents: string): CsvRecord<T>[] {
  let rows: Record<string, string>[];
  try {
    rows = parse(contents, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    }) as Record<string, string>[];
  } catch (error) {
    throw new Error(`Validation failed: ${(error as Error).message}`, { cause: error });
  }

  return rows.map((value, index) => ({
    rowNumber: index + 2,
    value: value as T,
  }));
}

function requireText(value: string | undefined, field: string): string {
  const cleaned = (value ?? "").trim();
  if (!cleaned) throw new RowValidationError(`${field} is required`);
  return cleaned;
}

function optionalText(value: string | undefined): string | null {
  const cleaned = (value ?? "").trim();
  return cleaned === "" ? null : cleaned;
}

function parseGpa(value: string | undefined): number | null {
  const cleaned = (value ?? "").trim();
  if (!cleaned) return null;

  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(cleaned)) {
    throw new RowValidationError("gpa must be a number with up to 2 decimal places");
  }
  const gpa = Number(cleaned);
  if (!Number.isFinite(gpa) || gpa < 0 || gpa > 4) {
    throw new RowValidationError("gpa must be between 0.00 and 4.00");
  }
  return gpa;
}

function validateDate(value: string | undefined, field: string): string | null {
  const cleaned = optionalText(value);
  if (cleaned === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    throw new RowValidationError(`${field} must use YYYY-MM-DD format`);
  }
  const date = new Date(`${cleaned}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== cleaned) {
    throw new RowValidationError(`${field} is not a valid calendar date`);
  }
  if (field === "birth_date") {
    if (cleaned < "1900-01-01") {
      throw new RowValidationError("birth_date must be on or after 1900-01-01");
    }
    const today = new Date().toISOString().slice(0, 10);
    if (cleaned > today) throw new RowValidationError("birth_date cannot be in the future");
  }
  return cleaned;
}

export function parseStudentCsv(contents: string): CsvRecord<StudentImportRecord>[] {
  const rows = parseCsv<Record<string, string>>(contents);
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();

  return rows.map(({ rowNumber, value }) => {
    try {
      const student_id = requireText(value.student_id, "student_id");
      const first_name = requireText(value.first_name, "first_name");
      const last_name = requireText(value.last_name, "last_name");
      const email = requireText(value.email, "email").toLowerCase();
      const curriculum = requireText(value.curriculum, "curriculum");

      if (student_id.length > 10) throw new RowValidationError("student_id must be at most 10 characters");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new RowValidationError("email is not valid");
      }
      if (!/^\d{2}$/.test(curriculum)) {
        throw new RowValidationError("curriculum must be a two-digit code, e.g. 66");
      }

      const phone = optionalText(value.phone);
      if (phone && !/^[0-9+-]+$/.test(phone)) {
        throw new RowValidationError("phone may contain digits, +, and - only");
      }
      if (phone && phone.length > 20) throw new RowValidationError("phone must be at most 20 characters");

      if (seenIds.has(student_id)) throw new RowValidationError(`duplicate student_id "${student_id}" in this file`);
      if (seenEmails.has(email)) throw new RowValidationError(`duplicate email "${email}" in this file`);
      seenIds.add(student_id);
      seenEmails.add(email);

      return {
        rowNumber,
        value: {
          student_id,
          first_name,
          last_name,
          email,
          phone,
          birth_date: validateDate(value.birth_date, "birth_date"),
          curriculum,
          gpa: parseGpa(value.gpa),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new RowValidationError(`row ${rowNumber}: ${message}`);
    }
  });
}

export function parseStudentCoursesCsv(contents: string): CsvRecord<StudentCourseImportRecord>[] {
  const rows = parseCsv<Record<string, string>>(contents);
  const seenKeys = new Set<string>();

  return rows.map(({ rowNumber, value }) => {
    try {
      const student_id = requireText(value.student_id, "student_id");
      const course_code = requireText(value.course_code, "course_code").toUpperCase();
      const rawStatus = requireText(value.status, "status").toUpperCase();
      const allowed: StudentCourseStatus[] = ["ENROLLED", "PASSED", "FAILED"];

      if (!allowed.includes(rawStatus as StudentCourseStatus)) {
        throw new RowValidationError("status must be ENROLLED, PASSED, or FAILED");
      }
      if (student_id.length > 10) throw new RowValidationError("student_id must be at most 10 characters");
      if (course_code.length > 10) throw new RowValidationError("course_code must be at most 10 characters");

      const rawGrade = (value.grade_point ?? "").trim();
      let grade_point: number | null = null;
      if (rawGrade) {
        if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(rawGrade)) {
          throw new RowValidationError("grade_point must be a number with up to 2 decimal places");
        }
        grade_point = Number(rawGrade);
        if (grade_point < 0 || grade_point > 4) {
          throw new RowValidationError("grade_point must be between 0.00 and 4.00");
        }
      }

      if (rawStatus === "ENROLLED" && grade_point !== null) {
        throw new RowValidationError("ENROLLED records must leave grade_point empty (incomplete result)");
      }
      if ((rawStatus === "PASSED" || rawStatus === "FAILED") && grade_point === null) {
        throw new RowValidationError(`${rawStatus} records require grade_point`);
      }

      const key = `${student_id}::${course_code}`;
      if (seenKeys.has(key)) throw new RowValidationError(`duplicate student/course key "${key}" in this file`);
      seenKeys.add(key);

      return {
        rowNumber,
        value: {
          student_id,
          course_code,
          status: rawStatus as StudentCourseStatus,
          grade_point,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new RowValidationError(`row ${rowNumber}: ${message}`);
    }
  });
}
