// ============================================================
// CS361 V2 — GET /students
// ============================================================
// Query params (both optional):
//   search     -> ILIKE against first_name, last_name, "first last"
//                 (full name) OR student_id, wrapped as '%' + term + '%'
//                 (uses the gin_trgm_ops indexes on first_name/last_name)
//   curriculum -> exact match against students.curriculum, e.g. '61', '66'
//                 (uses btree index idx_students_curriculum)
//
// Response: 200 with a BARE JSON ARRAY of Student objects
//   (same convention as GET /companies — no { students, total } wrapper).
//   No match / empty table -> 200 [].
//
// Type notes (pg returns NUMERIC as string and DATE as a JS Date):
//   gpa        -> cast to float8 so the client gets a number (3.2), not "3.20"
//   birth_date -> formatted in SQL as 'YYYY-MM-DD' so it is never shifted by
//                 a timezone conversion when the Date is JSON-serialized
//
// SQL safety: every user-supplied value goes through the pg driver's
// parameterized query() values array ($1/$2/...). Values are NEVER
// concatenated or template-interpolated into the SQL text.
// ============================================================

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';

const SELECT_COLUMNS = `SELECT student_id, first_name, last_name, email, phone,
       to_char(birth_date, 'YYYY-MM-DD') AS birth_date,
       curriculum,
       gpa::float8 AS gpa
FROM students`;

/**
 * True when a query-string value is actually usable (non-empty string).
 * An empty or whitespace-only value is treated as "not provided" rather
 * than becoming a meaningless `ILIKE '%%'` / `curriculum = ''` condition.
 *
 * @param {string | undefined | null} value
 * @returns {boolean}
 */
function isProvided(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * GET /students handler.
 *
 * @param {{queryStringParameters?: Record<string, string> | null}} event
 *   API Gateway HTTP API payload format 2.0 event.
 * @returns {Promise<{statusCode: number, headers: Record<string, string>, body: string}>}
 */
export async function listStudents(event) {
  try {
    const params = event?.queryStringParameters ?? {};
    const { search, curriculum } = params;

    /** @type {string[]} */
    const conditions = [];
    /** @type {string[]} */
    const values = [];

    if (isProvided(search)) {
      values.push(`%${search.trim()}%`);
      const idx = values.length;
      conditions.push(
        `(first_name ILIKE $${idx} OR last_name ILIKE $${idx}` +
          ` OR (first_name || ' ' || last_name) ILIKE $${idx}` +
          ` OR student_id ILIKE $${idx})`
      );
    }

    if (isProvided(curriculum)) {
      values.push(curriculum.trim());
      conditions.push(`curriculum = $${values.length}`);
    }

    const where = conditions.length > 0 ? `\nWHERE ${conditions.join(' AND ')}` : '';
    const text = `${SELECT_COLUMNS}${where}\nORDER BY student_id`;

    const result = await getPool().query(text, values);

    // Bare array — see the response note at the top of this file.
    return jsonResponse(200, result.rows);
  } catch (err) {
    // Real error goes to CloudWatch; the client gets a generic body.
    console.error('listStudents failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}