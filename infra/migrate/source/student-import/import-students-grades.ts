import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import pg from "pg";
import type {
  ImportRowResult,
  ImportSummary,
  StudentImportRecord,
  StudentCourseImportRecord,
} from "../../../../src/types/studentImport.js";
import { parseStudentCsv, parseStudentCoursesCsv, RowValidationError } from "./import-validation.js";

const { Pool } = pg;

const { values } = parseArgs({
  options: {
    students: { type: "string", default: "infra/migrate/source/student-import/samples/students.csv" },
    courses: { type: "string", default: "infra/migrate/source/student-import/samples/student_courses.csv" },
    report: { type: "string", default: "reports/import-report.json" },
    "dry-run": { type: "boolean", default: false },
  },
  strict: true,
}); 

const studentsPath = resolve(values.students!);
const coursesPath = resolve(values.courses!);
const reportPath = resolve(values.report!);
const dryRun = Boolean(values["dry-run"]);

function newSummary(): ImportSummary {
  return { total: 0, inserted: 0, updated: 0, skipped: 0, failed: 0, results: [] };
}

function addResult(summary: ImportSummary, result: ImportRowResult): void {
  summary.total += 1;
  if (result.status === "INSERTED") summary.inserted += 1;
  if (result.status === "UPDATED") summary.updated += 1;
  if (result.status === "SKIPPED") summary.skipped += 1;
  if (result.status === "FAILED") summary.failed += 1;
  summary.results.push(result);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date) a = a.toISOString().slice(0, 10);
  if (b instanceof Date) b = b.toISOString().slice(0, 10);
  if (a === null || a === undefined) a = null;
  if (b === null || b === undefined) b = null;
  return String(a ?? "") === String(b ?? "");
}

function studentMatches(db: Record<string, unknown>, row: StudentImportRecord): boolean {
  return (
    sameValue(db.first_name, row.first_name) &&
    sameValue(db.last_name, row.last_name) &&
    sameValue(db.email, row.email) &&
    sameValue(db.phone, row.phone) &&
    sameValue(db.birth_date, row.birth_date) &&
    sameValue(db.curriculum, row.curriculum) &&
    sameValue(db.gpa, row.gpa)
  );
}

function courseMatches(db: Record<string, unknown>, row: StudentCourseImportRecord): boolean {
  return (
    sameValue(db.status, row.status) &&
    sameValue(db.grade_point, row.grade_point)
  );
}

async function importStudent(
  client: pg.PoolClient,
  row: StudentImportRecord,
  rowNumber: number,
): Promise<ImportRowResult> {
  await client.query("BEGIN");
  try {
    const existing = await client.query(
      `SELECT student_id, first_name, last_name, email, phone, birth_date, curriculum, gpa
       FROM students WHERE student_id = $1 FOR UPDATE`,
      [row.student_id],
    );

    if (existing.rowCount) {
      if (studentMatches(existing.rows[0], row)) {
        await client.query("COMMIT");
        return { file: "students.csv", row: rowNumber, key: row.student_id, status: "SKIPPED", message: "ข้อมูลตรงกับฐานข้อมูลแล้ว" };
      }

      await client.query(
        `UPDATE students
         SET first_name = $2, last_name = $3, email = $4, phone = $5,
             birth_date = $6, curriculum = $7, gpa = $8
         WHERE student_id = $1`,
        [row.student_id, row.first_name, row.last_name, row.email, row.phone, row.birth_date, row.curriculum, row.gpa],
      );
      await client.query("COMMIT");
      return { file: "students.csv", row: rowNumber, key: row.student_id, status: "UPDATED", message: "ปรับปรุงข้อมูลนักศึกษาเดิม" };
    }

    await client.query(
      `INSERT INTO students
       (student_id, first_name, last_name, email, phone, birth_date, curriculum, gpa)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [row.student_id, row.first_name, row.last_name, row.email, row.phone, row.birth_date, row.curriculum, row.gpa],
    );
    await client.query("COMMIT");
    return { file: "students.csv", row: rowNumber, key: row.student_id, status: "INSERTED", message: "เพิ่มนักศึกษาใหม่" };
  } catch (error) {
    await client.query("ROLLBACK");
    return {
      file: "students.csv",
      row: rowNumber,
      key: row.student_id,
      status: "FAILED",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function importStudentCourse(
  client: pg.PoolClient,
  row: StudentCourseImportRecord,
  rowNumber: number,
): Promise<ImportRowResult> {
  await client.query("BEGIN");
  try {
    const student = await client.query("SELECT 1 FROM students WHERE student_id = $1", [row.student_id]);
    if (!student.rowCount) {
      await client.query("ROLLBACK");
      return {
        file: "student_courses.csv",
        row: rowNumber,
        key: `${row.student_id}/${row.course_code}`,
        status: "FAILED",
        message: `ไม่พบ student_id "${row.student_id}" ในตาราง students`,
      };
    }

    // The V2/V3 schema keeps course_code in student_courses; when coop_course_rules
    // exists, validate the reference before writing. This avoids assuming every
    // environment has migrated that reference table already.
    const rulesTable = await client.query(`SELECT to_regclass('public.coop_course_rules') AS table_name`);
    if (rulesTable.rows[0]?.table_name) {
      const course = await client.query(
        "SELECT 1 FROM coop_course_rules WHERE course_code = $1 LIMIT 1",
        [row.course_code],
      );
      if (!course.rowCount) {
        await client.query("ROLLBACK");
        return {
          file: "student_courses.csv",
          row: rowNumber,
          key: `${row.student_id}/${row.course_code}`,
          status: "FAILED",
          message: `ไม่พบ course_code "${row.course_code}" ใน coop_course_rules`,
        };
      }
    }

    const existing = await client.query(
      `SELECT status, grade_point FROM student_courses
       WHERE student_id = $1 AND course_code = $2 FOR UPDATE`,
      [row.student_id, row.course_code],
    );

    if (existing.rowCount && courseMatches(existing.rows[0], row)) {
      await client.query("COMMIT");
      return { file: "student_courses.csv", row: rowNumber, key: `${row.student_id}/${row.course_code}`, status: "SKIPPED", message: "ผลการเรียนตรงกับฐานข้อมูลแล้ว" };
    }

    if (existing.rowCount) {
      await client.query(
        `UPDATE student_courses SET status = $3, grade_point = $4
         WHERE student_id = $1 AND course_code = $2`,
        [row.student_id, row.course_code, row.status, row.grade_point],
      );
      await client.query("COMMIT");
      return { file: "student_courses.csv", row: rowNumber, key: `${row.student_id}/${row.course_code}`, status: "UPDATED", message: "ปรับปรุงผลการเรียนเดิม" };
    }

    await client.query(
      `INSERT INTO student_courses (student_id, course_code, status, grade_point)
       VALUES ($1, $2, $3, $4)`,
      [row.student_id, row.course_code, row.status, row.grade_point],
    );
    await client.query("COMMIT");
    return { file: "student_courses.csv", row: rowNumber, key: `${row.student_id}/${row.course_code}`, status: "INSERTED", message: "เพิ่มผลการเรียนใหม่" };
  } catch (error) {
    await client.query("ROLLBACK");
    return {
      file: "student_courses.csv",
      row: rowNumber,
      key: `${row.student_id}/${row.course_code}`,
      status: "FAILED",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function printSummary(title: string, summary: ImportSummary): void {
  console.log(`\n${title}`);
  console.table({
    total: summary.total,
    inserted: summary.inserted,
    updated: summary.updated,
    skipped: summary.skipped,
    failed: summary.failed,
  });
  for (const result of summary.results) {
    if (result.status === "FAILED") {
      console.error(`${result.file}:${result.row} [${result.key}] ${result.status}: ${result.message}`);
    }
  }
}

async function main(): Promise<void> {
  let studentsRecords;
  let courseRecords;

  try {
    studentsRecords = parseStudentCsv(await readFile(studentsPath, "utf8"));
    courseRecords = parseStudentCoursesCsv(await readFile(coursesPath, "utf8"));
  } catch (error) {
    if (error instanceof RowValidationError) throw error;
    throw new Error(`Cannot read/validate input CSV: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }

  if (dryRun) {
    console.log(`Dry run: CSV ผ่านการตรวจรูปแบบทั้งหมด`);
    console.log(`students.csv: ${studentsRecords.length} rows`);
    console.log(`student_courses.csv: ${courseRecords.length} rows`);
    console.log("ยังไม่ได้เชื่อมต่อหรือเปลี่ยนแปลงฐานข้อมูล");
    return;
  }

  if (!process.env.DATABASE_URL && !process.env.PGHOST) {
    throw new Error("Set DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD in your environment before importing.");
  }

  const pool = new Pool(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined }
      : {
          host: process.env.PGHOST,
          port: Number(process.env.PGPORT ?? 5432),
          database: process.env.PGDATABASE,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
        },
  );

  const studentSummary = newSummary();
  const courseSummary = newSummary();
  
  console.log(">>> กำลังเชื่อมต่อ Database...");
  const client = await pool.connect();
  console.log(">>> เชื่อมต่อ Database สำเร็จแล้ว!");

  try {
    // Process students first so rows in student_courses can reference them.
    for (const record of studentsRecords) {
      console.log(`>>> กำลังนำเข้า student_id: ${record.value.student_id}`);
      addResult(studentSummary, await importStudent(client, record.value, record.rowNumber));
    }

    for (const record of courseRecords) {
      addResult(courseSummary, await importStudentCourse(client, record.value, record.rowNumber));
    }
  } finally {
    client.release();
    await pool.end();
  }

  printSummary("Students", studentSummary);
  printSummary("Student courses / grades", courseSummary);

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun: false,
    students: studentSummary,
    studentCourses: courseSummary,
  };
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nSaved report: ${reportPath}`);

  if (studentSummary.failed + courseSummary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
