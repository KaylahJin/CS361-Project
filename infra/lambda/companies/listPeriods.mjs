// ============================================================
// CS361 V2 — GET /periods
// ============================================================
// Issue: #49 — กำหนดการสหกิจศึกษา (Home / Timeline)
// Issue: #50 — กรองตามรอบเวลา / ประเภทกิจกรรม
//
// GET /periods
//
// Query Parameters (optional):
//   period_id
//       ตัวอย่าง: P2568-1
//
//   activity_type
//       ตัวอย่าง: APPLICATION
//       ตัวอย่าง: INTERVIEW
//
// Examples:
//   GET /periods
//   GET /periods?period_id=P2568-1
//   GET /periods?activity_type=INTERVIEW
//   GET /periods?period_id=P2568-1&activity_type=INTERVIEW
//
// Database:
//   periods
//   coop_schedules
//
// Response 200:
// {
//   "period": {...},
//   "schedules": [...]
// }
//
// ============================================================

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';

/**
 * Check whether a query parameter is actually usable.
 *
 * Empty values such as:
 *   ?period_id=
 *   ?activity_type=
 *
 * are treated as not provided.
 *
 * @param {string | undefined | null} value
 * @returns {boolean}
 */
function isProvided(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * GET /periods
 *
 * @param {{
 *   queryStringParameters?: Record<string, string> | null
 * }} event
 *
 * @returns {Promise<{
 *   statusCode: number,
 *   headers: Record<string, string>,
 *   body: string
 * }>}
 */
export async function listPeriods(event) {
  try {
    const params = event?.queryStringParameters ?? {};

    const periodId = params.period_id;
    const activityType = params.activity_type;

    // ==========================================================
    // 1. Find the requested period
    //
    // If period_id is provided:
    //   return that period
    //
    // Otherwise:
    //   return the active period
    // ==========================================================

    let periodQuery;
    let periodValues;

    if (isProvided(periodId)) {
      periodQuery = `
        SELECT
          p.period_id,
          p.name,
          p.academic_year,
          p.semester,
          p.is_active,
          p.created_at
        FROM periods p
        WHERE p.period_id = $1
        LIMIT 1
      `;

      periodValues = [periodId.trim()];
    } else {
      periodQuery = `
        SELECT
          p.period_id,
          p.name,
          p.academic_year,
          p.semester,
          p.is_active,
          p.created_at
        FROM periods p
        WHERE p.is_active = TRUE
        ORDER BY
          p.academic_year DESC,
          p.semester DESC
        LIMIT 1
      `;

      periodValues = [];
    }

    const periodResult = await getPool().query(
      periodQuery,
      periodValues
    );

    // ==========================================================
    // 2. No period found
    // ==========================================================

    if (periodResult.rows.length === 0) {
      return jsonResponse(200, {
        period: null,
        schedules: [],
      });
    }

    const period = periodResult.rows[0];

    // ==========================================================
    // 3. Find schedules belonging to this period
    // ==========================================================

    const conditions = [
      `s.period_id = $1`,
    ];

    const values = [
      period.period_id,
    ];

    // ----------------------------------------------------------
    // Filter: activity_type
    // ----------------------------------------------------------

    if (isProvided(activityType)) {
      values.push(activityType.trim());

      conditions.push(
        `s.activity_type = $${values.length}`
      );
    }

    const scheduleQuery = `
      SELECT
        s.schedule_id,
        s.period_id,
        s.title,
        s.description,
        s.activity_type,
        s.start_date,
        s.end_date,
        s.step_order,
        s.created_at
      FROM coop_schedules s
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        s.step_order ASC,
        s.start_date ASC
    `;

    const scheduleResult = await getPool().query(
      scheduleQuery,
      values
    );

    // ==========================================================
    // 4. Return response
    // ==========================================================

    return jsonResponse(200, {
      period,
      schedules: scheduleResult.rows,
    });

  } catch (err) {
    // Real error goes to CloudWatch.
    // Never expose database details to the frontend.
    console.error('listPeriods failed', err);

    return jsonResponse(500, {
      error: 'Internal server error',
    });
  }
}