// ============================================================
// CS361 V2 — GET /periods
// ============================================================
// Issue: #49 — กำหนดการสหกิจศึกษา (Home / Timeline)
// Issue: #50 — กรองตามรอบเวลา / ประเภทกิจกรรม
// ============================================================

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';

function isProvided(value) {
  return typeof value === 'string' && value.trim() !== '';
}

export async function listPeriods(event) {
  try {
    const params = event?.queryStringParameters ?? {};

    const periodId = params.period_id;
    const activityType = params.activity_type;
    const search = params.search;

    // ==========================================================
    // 1. Find the requested period
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

    // ----------------------------------------------------------
    // Search: title / description
    // ----------------------------------------------------------

    if (isProvided(search)) {
      values.push(`%${search.trim()}%`);

      conditions.push(
        `(s.title ILIKE $${values.length}
          OR s.description ILIKE $${values.length})`
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