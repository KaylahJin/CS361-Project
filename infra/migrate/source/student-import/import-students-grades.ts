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
  import { parseStudentCsv, parseStudentCoursesCsv} from "./import-validation.js";

  const { Pool } = pg;

  async function rollbackSafely(client: pg.PoolClient): Promise<void> {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }
  }

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

  function rejectDuplicateRows<T>(
    records: { rowNumber: number; value: T }[],
    getKey: (record: T) => string,
    getDisplayKey: (record: T) => string,
    file: string,
    summary: ImportSummary,
    areEqual: (a: T, b: T) => boolean,
  ): { rowNumber: number; value: T }[] {
    const groups = new Map<string, { rowNumber: number; value: T }[]>();

    for (const record of records) {
      const key = getKey(record.value);
      const group = groups.get(key) ?? [];
      group.push(record);
      groups.set(key, group);
    }

    const result: { rowNumber: number; value: T }[] = [];

    for (const group of groups.values()) {
      if (group.length === 1) {
        result.push(group[0]);
        continue;
      }

      const first = group[0];
      const key = getDisplayKey(first.value);
      const identical = group.every((record) =>
        areEqual(first.value, record.value),
      );

      if (identical) {
        result.push(first);

        for (const duplicate of group.slice(1)) {
          addResult(summary, {
            file,
            row: duplicate.rowNumber,
            key,
            status: "SKIPPED",
            message: `ข้อมูลซ้ำกับแถว ${first.rowNumber} และมีค่าเหมือนกัน`,
          });
        }
      } else {
        for (const duplicate of group) {
          addResult(summary, {
            file,
            row: duplicate.rowNumber,
            key: getDisplayKey(duplicate.value),
            status: "FAILED",
            message: "พบ key ซ้ำในไฟล์ CSV แต่ข้อมูลแตกต่างกัน",
          });
        }
      }
    }

    return result.sort((a, b) => a.rowNumber - b.rowNumber);
  }


  function normalizeValue(value: unknown): unknown {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    }

    return value;
  }


  function sameValue(a: unknown, b: unknown): boolean {
    a = normalizeValue(a);
    b = normalizeValue(b);

    if (a === null && b === null) return true;
    if (a === null || b === null) return false;

    return String(a).trim() === String(b).trim();
  }


  function sameNumericValue(a: unknown, b: unknown): boolean {
    a = normalizeValue(a);
    b = normalizeValue(b);

    if (a === null && b === null) return true;
    if (a === null || b === null) return false;

    const numA = Number(a);
    const numB = Number(b);

    if (!Number.isFinite(numA) || !Number.isFinite(numB)) {
      return false;
    }

    return Math.abs(numA - numB) < 0.0001;
  }

  function studentMatches(db: Record<string, unknown>, row: StudentImportRecord): boolean {
    return (
      sameValue(db.first_name, row.first_name) &&
      sameValue(db.last_name, row.last_name) &&
      sameValue(db.email, row.email) &&
      sameValue(db.phone, row.phone) &&
      sameValue(db.birth_date, row.birth_date) &&
      sameValue(db.curriculum, row.curriculum) &&
      sameNumericValue(db.gpa, row.gpa)
    );
  }

  function courseMatches(db: Record<string, unknown>, row: StudentCourseImportRecord): boolean {
    return (
      sameValue(db.status, row.status) &&
      sameNumericValue(db.grade_point, row.grade_point)
    );
  }

  async function importStudent(
    client: pg.PoolClient,
    row: StudentImportRecord,
    rowNumber: number,
  ): Promise<ImportRowResult> {
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        `SELECT student_id, first_name, last_name, email, phone, TO_CHAR(birth_date, 'YYYY-MM-DD') AS birth_date, curriculum, gpa
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
      await rollbackSafely(client);
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
    try {
      await client.query("BEGIN");
      const student = await client.query("SELECT 1 FROM students WHERE student_id = $1", [row.student_id]);
      if (!student.rowCount) {
        await rollbackSafely(client);
        return {
          file: "student_courses.csv",
          row: rowNumber,
          key: `${row.student_id}/${row.course_code}`,
          status: "FAILED",
          message: `ไม่พบ student_id "${row.student_id}" ในตาราง students`,
        };
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
      await rollbackSafely(client);
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

  async function saveReport(
    reportPath: string,
    dryRun: boolean,
    studentSummary: ImportSummary,
    courseSummary: ImportSummary,
  ): Promise<void> {
    const report = {
      generatedAt: new Date().toISOString(),
      dryRun,
      students: studentSummary,
      studentCourses: courseSummary,
    };

    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nSaved report: ${reportPath}`);
  }

  async function main(): Promise<void> {
    const studentSummary = newSummary();
    const courseSummary = newSummary();

    let studentsRecords: { rowNumber: number; value: StudentImportRecord }[] = [];
    let courseRecords: { rowNumber: number; value: StudentCourseImportRecord }[] = [];

    let studentParseFailed = false;
    let courseParseFailed = false;

    try {
      studentsRecords = parseStudentCsv(
        await readFile(studentsPath, "utf8"),
      );
    } catch (error) {
      studentParseFailed = true;
      const msg = error instanceof Error ? error.message : String(error);
      const rowMatch = msg.match(/row (\d+)/i);

      addResult(studentSummary, {
        file: "students.csv",
        row: rowMatch ? Number(rowMatch[1]) : 0,
        key: "VALIDATION_ERROR",
        status: "FAILED",
        message: msg,
      });
    }

    try {
      courseRecords = parseStudentCoursesCsv(
        await readFile(coursesPath, "utf8"),
      );
    } catch (error) {
      courseParseFailed = true;
      const msg = error instanceof Error ? error.message : String(error);
      const rowMatch = msg.match(/row (\d+)/i);

      addResult(courseSummary, {
        file: "student_courses.csv",
        row: rowMatch ? Number(rowMatch[1]) : 0,
        key: "VALIDATION_ERROR",
        status: "FAILED",
        message: msg,
      });
    }


  if (!studentParseFailed) {
    studentsRecords = rejectDuplicateRows(
      studentsRecords,
      (row) => row.student_id,
      (row) => row.student_id,
      "students.csv",
      studentSummary,
      (a, b) =>
        a.student_id === b.student_id &&
        a.first_name === b.first_name &&
        a.last_name === b.last_name &&
        a.email === b.email &&
        a.phone === b.phone &&
        a.birth_date === b.birth_date &&
        a.curriculum === b.curriculum &&
        a.gpa === b.gpa,
    );
  }

  if (!courseParseFailed) {
    courseRecords = rejectDuplicateRows(
      courseRecords,
      (row) => JSON.stringify([row.student_id, row.course_code]),
      (row) => `${row.student_id}/${row.course_code}`,
      "student_courses.csv",
      courseSummary,
      (a, b) =>
        a.student_id === b.student_id &&
        a.course_code === b.course_code &&
        a.status === b.status &&
        a.grade_point === b.grade_point,
    );
  }


    
  if (dryRun) {
    const studentFailed = studentSummary.failed;
    const courseFailed = courseSummary.failed;

  studentSummary.total =
    studentsRecords.length + studentSummary.skipped + studentSummary.failed;

  courseSummary.total =
    courseRecords.length + courseSummary.skipped + courseSummary.failed;
    if (studentFailed > 0 || courseFailed > 0) {
      console.error("Dry run: CSV มีข้อผิดพลาด");
      process.exitCode = 1;
    } else {
      console.log("Dry run: CSV ผ่านการตรวจรูปแบบทั้งหมด");
      console.log(`students.csv: ${studentsRecords.length} rows to process`);
      console.log(`student_courses.csv: ${courseRecords.length} rows to process`);
      console.log("ยังไม่ได้เชื่อมต่อหรือเปลี่ยนแปลงฐานข้อมูล");
    }

    printSummary("Students", studentSummary);
    printSummary("Student courses / grades", courseSummary);

    await saveReport(reportPath, true, studentSummary, courseSummary);
    return;
  }
    if (
      !studentParseFailed &&
      !courseParseFailed &&
      (studentsRecords.length > 0 || courseRecords.length > 0)
    ) {

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
      try {
        console.log(">>> กำลังเชื่อมต่อ Database...");

        const client = await pool.connect();

        try {
          console.log(">>> เชื่อมต่อ Database สำเร็จแล้ว!");

          console.log(
            `>>> กำลังนำเข้าข้อมูลนักศึกษา (${studentsRecords.length} รายการ)...`,
          );

          for (const record of studentsRecords) {
            addResult(
              studentSummary,
              await importStudent(
                client,
                record.value,
                record.rowNumber,
              ),
            );
          }

          console.log(">>> นำเข้าข้อมูลนักศึกษาเสร็จสิ้น");

          console.log(
            `>>> กำลังนำเข้าผลการเรียน (${courseRecords.length} รายการ)...`,
          );

          for (const record of courseRecords) {
            addResult(
              courseSummary,
              await importStudentCourse(
                client,
                record.value,
                record.rowNumber,
              ),
            );
          }

          console.log(">>> นำเข้าผลการเรียนเสร็จสิ้น");
        } finally {
          client.release();
        }
      } finally {
        await pool.end();
      }
    }

    printSummary("Students", studentSummary);
    printSummary("Student courses / grades", courseSummary);

    await saveReport(
      reportPath,
      false,
      studentSummary,
      courseSummary,
    );

    if (studentSummary.failed + courseSummary.failed > 0) {
      process.exitCode = 1;
    }
  }

  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });