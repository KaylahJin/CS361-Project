// ============================================================
// CS361 — GET /students
// ============================================================
// Behind the API Gateway JWT authorizer: no token never reaches here.
//
// Which rows and which columns the caller gets are decided by
// authorize.mjs, not here. The scope is a WHERE fragment rather than a
// filter applied after the read, so a row the caller may not see is never
// fetched, and a column they may not see is never selected.
//
// Query params (both optional):
//   search     -> ILIKE against first_name, last_name, "first last"
//                 (full name) OR student_id, wrapped as '%' + term + '%'
//                 (uses the gin_trgm_ops indexes on first_name/last_name)
//   curriculum -> exact match against students.curriculum, e.g. '61', '66'
//                 (uses btree index idx_students_curriculum)
//
// A caller's own params are ANDed in alongside the role scope, so they can
// only narrow what that role may see, never widen it.
//
// Response: 200 with a BARE JSON ARRAY of Student objects
//   (same convention as GET /companies — no { students, total } wrapper).
//   No match / nothing in scope -> 200 [].
//
// Type notes (pg returns NUMERIC as string and DATE as a JS Date):
//   gpa        -> cast to float8 so the client gets a number (3.2), not "3.20"
//   birth_date -> formatted in SQL as 'YYYY-MM-DD' so it is never shifted by
//                 a timezone conversion when the Date is JSON-serialized
//   Both live in authorize.mjs with the rest of the column list.
//
// SQL safety: every user-supplied value goes through the pg driver's
// parameterized query() values array ($1/$2/...). Values are NEVER
// concatenated or template-interpolated into the SQL text.
// ============================================================

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { getAuthenticatedUser } from './auth.mjs';
import { buildStudentScope, studentColumnsFor, ForbiddenError } from './authorize.mjs';

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
  // Identity and scope first: the role decides which rows and columns exist
  // for this caller at all, so there is nothing to query until it is known.
  // getAuthenticatedUser decides between 401 and 403 itself; see auth.mjs.
  let scope;
  let columns;
  try {
    const { user, denied } = await getAuthenticatedUser(event);
    if (denied) {
      return jsonResponse(denied.status, { error: denied.error });
    }

    scope = await buildStudentScope(user);
    columns = studentColumnsFor(user).columns;
  } catch (err) {
    if (err instanceof ForbiddenError) {
      console.error('listStudents forbidden', err.message);
      return jsonResponse(403, { error: 'Forbidden' });
    }
    console.error('listStudents auth failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }

  try {
    const params = event?.queryStringParameters ?? {};
    const { search, curriculum } = params;

    /** @type {string[]} */
    const conditions = [];
    /** @type {string[]} */
    const values = [];

    // Pushes a value and hands back its placeholder, so the numbering stays
    // in step with the values array as conditions are added.
    const add = (value) => {
      values.push(value);
      return `$${values.length}`;
    };

    // The role scope goes in first, so it is $1 and the caller's own filters
    // follow it. Which one comes first does not change the result — they are
    // ANDed — but a stable order keeps the SQL readable in logs.
    if (scope.sql) {
      let sql = scope.sql;
      for (const param of scope.params) {
        sql = sql.replace('$PARAM', add(param));
      }
      conditions.push(sql);
    }

    if (isProvided(search)) {
      const placeholder = add(`%${search.trim()}%`);
      conditions.push(
        `(first_name ILIKE ${placeholder} OR last_name ILIKE ${placeholder}` +
          ` OR (first_name || ' ' || last_name) ILIKE ${placeholder}` +
          ` OR student_id ILIKE ${placeholder})`
      );
    }

    if (isProvided(curriculum)) {
      conditions.push(`curriculum = ${add(curriculum.trim())}`);
    }

    const where = conditions.length > 0 ? `\nWHERE ${conditions.join(' AND ')}` : '';
    const text = `SELECT ${columns.join(', ')}
FROM students s${where}
ORDER BY student_id`;

    const result = await getPool().query(text, values);

    // Bare array — see the response note at the top of this file.
    return jsonResponse(200, result.rows);
  } catch (err) {
    // Real error goes to CloudWatch; the client gets a generic body.
    console.error('listStudents failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}
