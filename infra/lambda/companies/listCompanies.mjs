// ============================================================
// CS361 V2 — GET /companies
// ============================================================
// Issue: #26 — ทำการเรียกข้อมูลสถานประกอบการ
//
// Query params (both optional):
//   search   -> ILIKE against companies.name, wrapped as '%' + term + '%'
//               (uses the existing gin_trgm_ops index idx_companies_name)
//   province -> exact match against companies.province
//               (uses btree index idx_companies_province)
//
// Response: 200 with a BARE JSON ARRAY of Company objects.
//   Do NOT wrap in { companies, total }. src/types/company.ts defines a
//   CompanyListResponse type but src/data/companyApi.ts does
//   `return res.json()` typed directly as Promise<Company[]> — wrapping
//   would break the frontend.
//
// SQL safety: every user-supplied value goes through the pg driver's
// parameterized query() values array ($1/$2/...). Values are NEVER
// concatenated or template-interpolated into the SQL text.
// ============================================================

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';

const SELECT_COLUMNS = `SELECT company_id, name, short_name, province, location, description,
       logo_filename, url, created_at
FROM companies`;

/**
 * True when a query-string value is actually usable.
 * API Gateway may hand us a present-but-empty value (e.g. `?search=`),
 * and the frontend only sets a param when it is truthy — so an empty or
 * whitespace-only value is treated as "not provided" rather than becoming
 * a meaningless `ILIKE '%%'` / `province = ''` condition.
 *
 * @param {string | undefined | null} value
 * @returns {boolean}
 */
function isProvided(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * GET /companies handler.
 *
 * @param {{queryStringParameters?: Record<string, string> | null}} event
 *   API Gateway HTTP API payload format 2.0 event.
 * @returns {Promise<{statusCode: number, headers: Record<string, string>, body: string}>}
 */
export async function listCompanies(event) {
  try {
    const params = event?.queryStringParameters ?? {};
    const { search, province } = params;

    /** @type {string[]} */
    const conditions = [];
    /** @type {string[]} */
    const values = [];

    if (isProvided(search)) {
      values.push(`%${search}%`);
      conditions.push(`name ILIKE $${values.length}`);
    }

    if (isProvided(province)) {
      values.push(province);
      conditions.push(`province = $${values.length}`);
    }

    const where = conditions.length > 0 ? `\nWHERE ${conditions.join(' AND ')}` : '';
    const text = `${SELECT_COLUMNS}${where}\nORDER BY name`;

    const result = await getPool().query(text, values);

    // Bare array — see the response note at the top of this file.
    return jsonResponse(200, result.rows);
  } catch (err) {
    // Real error goes to CloudWatch; the client gets a generic body.
    // Never return err.message / err.stack.
    console.error('listCompanies failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}
