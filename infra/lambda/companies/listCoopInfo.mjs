// ============================================================
// CS361 V2 — GET /coop-info
// ============================================================
// Issue: #59 — พัฒนา API และระบบ Search และ Filter ข้อกำหนดสหกิจ
//
// Query params (all optional):
//   search      -> ILIKE against coop_info.title OR description
//   category    -> exact match against coop_info.category
//   curriculum  -> exact match against coop_info.curriculum
//
// Search and filters can be used together.
//
// Response: 200 with a BARE JSON ARRAY of Coop Info objects.
// No matching data returns 200 with [].
//
// SQL safety: every user-supplied value goes through the pg driver's
// parameterized query() values array ($1/$2/...). Values are NEVER
// concatenated into the SQL text.
// ============================================================

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';

const SELECT_COLUMNS = `SELECT info_id, item_number, curriculum, category,
       title, description, gpa_requirement, academic_year, created_at
FROM coop_info`;

/**
 * True when a query-string value is actually usable.
 *
 * @param {string | undefined | null} value
 * @returns {boolean}
 */
function isProvided(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * GET /coop-info handler.
 *
 * @param {{queryStringParameters?: Record<string, string> | null}} event
 * @returns {Promise<{statusCode: number, headers: Record<string, string>, body: string}>}
 */
export async function listCoopInfo(event) {
  try {
    const params = event?.queryStringParameters ?? {};
    const { search, category, curriculum } = params;

    /** @type {string[]} */
    const conditions = [];

    /** @type {string[]} */
    const values = [];

    if (isProvided(search)) {
      values.push(`%${search}%`);
      conditions.push(
        `(title ILIKE $${values.length} OR description ILIKE $${values.length})`
      );
    }

    if (isProvided(category)) {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }

    if (isProvided(curriculum)) {
      values.push(curriculum);
      conditions.push(`curriculum IN ($${values.length}, 'all')`);
    }

    const where =
      conditions.length > 0
        ? `\nWHERE ${conditions.join(' AND ')}`
        : '';

    const text = `${SELECT_COLUMNS}${where}
ORDER BY item_number, curriculum, info_id`;

    const result = await getPool().query(text, values);

    return jsonResponse(200, result.rows);
  } catch (err) {
    console.error('listCoopInfo failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}