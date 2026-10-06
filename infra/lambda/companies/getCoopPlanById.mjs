// ============================================================
// CS361 V2 — GET /coop-plans/{planId}
// ============================================================
// Responses:
//   200 -> single CoopPlan object (joined with student / position /
//          company / period so the frontend needs no extra calls)
//   400 -> planId missing / empty / not a positive 32-bit integer
//          (validated BEFORE any DB call — plan_id is INTEGER, so a
//          non-numeric value would otherwise make pg throw and become a 500)
//   404 -> no row with that plan_id
//   500 -> anything thrown; generic body only
//
// SQL safety: planId is passed as $1 through the pg driver's values
// array, never interpolated into the SQL text.
// ============================================================

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';

const MAX_INT4 = 2147483647;

const SELECT_BY_ID = `SELECT p.plan_id, p.student_id, p.period_id, p.position_id, p.status,
       p.acknowledged_pre_course, p.terms_accepted_at, p.student_note,
       p.submitted_at, p.reviewer_name, p.reviewed_at, p.review_comment,
       p.created_at, p.updated_at,
       s.first_name, s.last_name, s.curriculum,
       pos.title AS position_title, pos.company_id,
       c.name AS company_name, c.short_name AS company_short_name,
       per.name AS period_name
FROM coop_plans p
JOIN students s ON s.student_id = p.student_id
LEFT JOIN positions pos ON pos.position_id = p.position_id
LEFT JOIN companies c ON c.company_id = pos.company_id
LEFT JOIN periods per ON per.period_id = p.period_id
WHERE p.plan_id = $1`;

/**
 * @param {unknown} value
 * @returns {boolean} true when value is a positive integer string that fits INTEGER
 */
function isValidPlanId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return false;
  const n = Number(value.trim());
  return n >= 1 && n <= MAX_INT4;
}

/**
 * GET /coop-plans/{planId} handler.
 *
 * @param {{pathParameters?: Record<string, string> | null}} event
 *   API Gateway HTTP API payload format 2.0 event.
 * @returns {Promise<{statusCode: number, headers: Record<string, string>, body: string}>}
 */
export async function getCoopPlanById(event) {
  const planId = event?.pathParameters?.planId;

  // Validate first — this must short-circuit before touching the pool.
  if (!isValidPlanId(planId)) {
    return jsonResponse(400, { error: 'planId must be a positive integer' });
  }

  try {
    const result = await getPool().query(SELECT_BY_ID, [Number(planId.trim())]);

    if (result.rows.length === 0) {
      return jsonResponse(404, { error: 'Coop plan not found' });
    }

    return jsonResponse(200, result.rows[0]);
  } catch (err) {
    console.error('getCoopPlanById failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}
