// ============================================================
// CS361 V2 — GET /positions/{positionId}
// ============================================================
// Issue: #38 — พัฒนา API สำหรับเรียกข้อมูล Position/Project
//
// Responses:
//   200 -> single Position object with joined company info
//   400 -> positionId missing / empty / whitespace-only
//   404 -> no row with that position_id
//   500 -> server error
//
// SQL safety: Parameterized query ($1) via pg driver.
// ============================================================

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';

const SELECT_BY_ID = `SELECT 
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
LEFT JOIN companies c ON p.company_id = c.company_id
WHERE p.position_id = $1`;

/**
 * GET /positions/{positionId} handler.
 *
 * @param {{pathParameters?: Record<string, string> | null}} event
 * @returns {Promise<{statusCode: number, headers: Record<string, string>, body: string}>}
 */
export async function getPositionById(event) {
  const positionId = event?.pathParameters?.positionId;

  if (typeof positionId !== 'string' || positionId.trim() === '') {
    return jsonResponse(400, { error: 'positionId is required' });
  }

  try {
    const result = await getPool().query(SELECT_BY_ID, [positionId.trim()]);

    if (result.rows.length === 0) {
      return jsonResponse(404, { error: 'Position not found' });
    }

    return jsonResponse(200, result.rows[0]);
  } catch (err) {
    console.error('getPositionById failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}
