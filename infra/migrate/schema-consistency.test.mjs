import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("base schema parity with V3 migrations (#153)", () => {
  it("includes period criteria introduced by v3_03 migration", async () => {
    const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");

    expect(schema).toMatch(/min_gpa\s+NUMERIC\(3,\s*2\)/);
    expect(schema).toMatch(/min_group_gpa\s+NUMERIC\(3,\s*2\)/);
    expect(schema).toMatch(/capacity\s+INTEGER/);
  });

  it("includes V3 tables app_users, advisor_student_assignments, plan_reviews, and plan_attachments FK", async () => {
    const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");

    // app_users with COMMITTEE role and student_id link check
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS app_users/i);
    expect(schema).toMatch(/'STUDENT',\s*'ADVISOR',\s*'STAFF',\s*'COMMITTEE',\s*'ADMIN'/);
    expect(schema).toMatch(/CONSTRAINT\s+chk_app_users_student_link/i);

    // advisor_student_assignments with ON DELETE CASCADE ON UPDATE CASCADE
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS advisor_student_assignments/i);
    expect(schema).toMatch(/REFERENCES\s+app_users\(cognito_sub\)\s+ON DELETE CASCADE ON UPDATE CASCADE/i);

    // plan_reviews with step column, ON UPDATE CASCADE, and 3-step decisions
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS plan_reviews/i);
    expect(schema).toMatch(/REFERENCES\s+app_users\(cognito_sub\)\s+ON UPDATE CASCADE/i);
    expect(schema).toMatch(/CONSTRAINT\s+chk_plan_reviews_step/i);
    expect(schema).toMatch(/'ENDORSED',\s*'NOT_ENDORSED'/);
    expect(schema).toMatch(/'ELIGIBLE',\s*'INCOMPLETE',\s*'NOT_ELIGIBLE'/);
    expect(schema).toMatch(/'SELECTED',\s*'NOT_SELECTED'/);

    // coop_plans V3 statuses and one-plan-per-period unique index (v3_04 + v3_05)
    expect(schema).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_coop_plans_active_period/i);
    expect(schema).toMatch(/CONSTRAINT\s+fk_plan_attachments_uploader\s+FOREIGN KEY\s*\(uploaded_by\)\s*REFERENCES\s+app_users\(cognito_sub\)/i);
  });

  it("keeps schema.dbml aligned with V3 tables, column types, and partial unique index", async () => {
    const dbml = await readFile(new URL("../schema.dbml", import.meta.url), "utf8");

    for (const table of [
      "positions",
      "students",
      "coop_plans",
      "app_users",
      "advisor_student_assignments",
      "plan_reviews",
      "plan_attachments",
      "student_courses",
    ]) {
      expect(dbml).toMatch(new RegExp(`Table\\s+${table}\\s*\\{`));
    }

    const studentsBlock = dbml.match(/Table\s+students\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(studentsBlock).toMatch(/first_name\s+text\b/);
    expect(studentsBlock).toMatch(/last_name\s+text\b/);
    expect(studentsBlock).toMatch(/email\s+text\b/);
    expect(studentsBlock).toMatch(/curriculum\s+varchar\(2\)/);

    const positionsBlock = dbml.match(/Table\s+positions\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(positionsBlock).toMatch(/title\s+varchar\(255\)/);
    expect(positionsBlock).toMatch(/category\s+varchar\(50\)/);
    expect(positionsBlock).toMatch(/work_mode\s+varchar\(20\)/);
    expect(positionsBlock).toMatch(/status\s+varchar\(20\)/);
    expect(positionsBlock).not.toMatch(/\bposition_type\b/);

    const coopPlansBlock = dbml.match(/Table\s+coop_plans\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(coopPlansBlock).toMatch(/\(student_id,\s*period_id\)\s*\[[^\]]*uq_coop_plans_active_period/);
    const coopPlansAttrsOnly = coopPlansBlock.replace(/"[^"]*"/g, '""');
    expect(coopPlansAttrsOnly).not.toMatch(/\(student_id,\s*period_id\)\s*\[[^\]]*\bunique\b/);
  });
});
