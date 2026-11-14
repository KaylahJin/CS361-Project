import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("base schema", () => {
  it("includes period criteria introduced by v3_03 migration", async () => {
    const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");

    expect(schema).toMatch(/min_gpa\s+NUMERIC\(3,\s*2\)/);
    expect(schema).toMatch(/min_group_gpa\s+NUMERIC\(3,\s*2\)/);
    expect(schema).toMatch(/capacity\s+INTEGER/);
  });
});
