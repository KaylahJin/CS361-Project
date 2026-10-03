// ============================================================
// CS361 V2 — GET /companies/{companyId}
// ============================================================
// Issue: #26 — ทำการเรียกข้อมูลสถานประกอบการ
//
// Responses:
//   200 -> single Company object
//   400 -> companyId missing / empty / whitespace-only
//          (validated BEFORE any DB call — no wasted connection)
//   404 -> no row with that company_id
//   500 -> anything thrown; generic body only
//
// src/data/companyApi.ts never parses an error body (it only reads
// res.status / res.statusText), so the error body shape is flexible —
// but the status codes must be exactly right.
//
// SQL safety: companyId is passed as $1 through the pg driver's values
// array, never interpolated into the SQL text.
// ============================================================

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';

const SELECT_BY_ID = `SELECT company_id, name, short_name, province, location, description,
       logo_filename, url, created_at
FROM companies
WHERE company_id = $1`;

/**
 * GET /companies/{companyId} handler.
 *
 * @param {{pathParameters?: Record<string, string> | null}} event
 *   API Gateway HTTP API payload format 2.0 event.
 * @returns {Promise<{statusCode: number, headers: Record<string, string>, body: string}>}
 */
export async function getCompanyById(event) {
  const companyId = event?.pathParameters?.companyId;

  // Validate first — this must short-circuit before touching the pool.
  if (typeof companyId !== 'string' || companyId.trim() === '') {
    return jsonResponse(400, { error: 'companyId is required' });
  }

  try {
    const result = await getPool().query(SELECT_BY_ID, [companyId]);

    if (result.rows.length === 0) {
      return jsonResponse(404, { error: 'Company not found' });
    }

    return jsonResponse(200, result.rows[0]);
  } catch (err) {
    // Real error goes to CloudWatch; the client gets a generic body.
    // Never return err.message / err.stack.
    console.error('getCompanyById failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}
