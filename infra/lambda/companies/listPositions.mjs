// ============================================================
// CS361 V2 — GET /positions
// ============================================================
// Issue: #38 — พัฒนา API สำหรับเรียกข้อมูล Position/Project
//
// Query params (all optional):
//   search     -> ILIKE against p.title OR c.name OR c.short_name
//   category   -> exact match against p.category
//   work_mode  -> exact match against p.work_mode
//   status     -> exact match against p.status
//   company_id -> exact match against p.company_id
//
// Response: 200 with a BARE JSON ARRAY of Position objects with joined company info.
//
// SQL safety: Parameterized queries ($1, $2, ...) via pg driver.
// ============================================================

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';

const SELECT_POSITIONS = `SELECT 
    p.position_id,
    p.company_id,
    c.name AS company_name,
    c.short_name AS company_short_name,
    c.logo_filename AS company_logo,
    c.province AS company_province,
    p.title,
    p.category,
    p.description,
    p.qualification,
    p.location,
    p.work_mode,
    p.application_deadline,
    p.application_url,
    p.status,
    p.source_url,
    p.created_at
FROM positions p
LEFT JOIN companies c ON p.company_id = c.company_id`;

/**
 * Check if query param is non-empty string.
 * @param {string | undefined | null} value
 * @returns {boolean}
 */
function isProvided(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * GET /positions handler.
 *
 * @param {{queryStringParameters?: Record<string, string> | null}} event
 * @returns {Promise<{statusCode: number, headers: Record<string, string>, body: string}>}
 */
export async function listPositions(event) {
  try {
    const params = event?.queryStringParameters ?? {};
    const { search, category, work_mode, status, company_id } = params;

    /** @type {string[]} */
    const conditions = [];
    /** @type {string[]} */
    const values = [];

    if (isProvided(search)) {
      values.push(`%${search}%`);
      const idx = values.length;
      conditions.push(`(p.title ILIKE $${idx} OR c.name ILIKE $${idx} OR c.short_name ILIKE $${idx})`);
    }

    if (isProvided(category)) {
      values.push(category);
      conditions.push(`p.category = $${values.length}`);
    }

    if (isProvided(work_mode)) {
      values.push(work_mode);
      conditions.push(`p.work_mode = $${values.length}`);
    }

    if (isProvided(status)) {
      values.push(status);
      conditions.push(`p.status = $${values.length}`);
    }

    if (isProvided(company_id)) {
      values.push(company_id);
      conditions.push(`p.company_id = $${values.length}`);
    }

    const where = conditions.length > 0 ? `\nWHERE ${conditions.join(' AND ')}` : '';
    const text = `${SELECT_POSITIONS}${where}\nORDER BY p.position_id ASC`;

    const result = await getPool().query(text, values);

    return jsonResponse(200, result.rows);
  } catch (err) {
    console.error('listPositions failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}
