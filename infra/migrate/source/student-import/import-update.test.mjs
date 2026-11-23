import { describe, expect, it } from "vitest";
import { mergeStudentForUpdate } from "./import-update.mjs";

describe("mergeStudentForUpdate", () => {
  it("keeps existing optional values when a CSV row leaves them blank", () => {
    expect(
      mergeStudentForUpdate(
        { phone: "0800000001", birth_date: "2002-01-15", gpa: 3.2 },
        { phone: null, birth_date: null, gpa: null },
      ),
    ).toEqual({ phone: "0800000001", birth_date: "2002-01-15", gpa: 3.2 });
  });
});
