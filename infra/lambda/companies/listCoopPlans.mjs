// ============================================================
// CS361 V2 — GET /coop-plans
// ============================================================
// Query params (all optional, combined with AND):
//   status        -> exact match; must be one of VALID_STATUSES, else 400
//   studentId     -> exact match on coop_plans.student_id
//   search        -> ILIKE on student first/last name, full name or student_id
//   curriculum    -> exact match on students.curriculum
//   periodId      -> exact match on coop_plans.period_id
//   companyId     -> exact match on positions.company_id
//   positionId    -> exact match on coop_plans.position_id
//   submittedFrom -> YYYY-MM-DD, inclusive (Asia/Bangkok day), else 400
//   submittedTo   -> YYYY-MM-DD, inclusive (Asia/Bangkok day), else 400
//
// Response: 200 with a BARE JSON ARRAY (no { plans, total } wrapper),
// newest submission first; drafts (submitted_at NULL) last.
//
// SQL safety: every user-supplied value goes through the pg driver's
// values array ($1/$2/...), never interpolated into the SQL text.
// ============================================================

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';

export const VALID_STATUSES = ['PREPARING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

const SELECT_COLUMNS = `SELECT p.plan_id, p.student_id, p.period_id, p.position_id, p.status,
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
LEFT JOIN periods per ON per.period_id = p.period_id`;

/** @param {unknown} value */
function isProvided(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/** @param {string} value  strict YYYY-MM-DD that is a real calendar date */
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * GET /coop-plans handler.
 *
 * @param {{queryStringParameters?: Record<string, string> | null}} event
 *   API Gateway HTTP API payload format 2.0 event.
 * @returns {Promise<{statusCode: number, headers: Record<string, string>, body: string}>}
 */
export async function listCoopPlans(event) {
  const q = event?.queryStringParameters ?? {};
  const { status, studentId, search, curriculum, periodId, companyId, positionId } = q;
  const submittedFrom = q.submittedFrom;
  const submittedTo = q.submittedTo;

  // Validate before touching the pool.
  if (isProvided(status) && !VALID_STATUSES.includes(status.trim())) {
    return jsonResponse(400, { error: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }
  for (const [name, value] of [['submittedFrom', submittedFrom], ['submittedTo', submittedTo]]) {
    if (isProvided(value) && !isValidDate(value.trim())) {
      return jsonResponse(400, { error: `${name} must be a valid date in YYYY-MM-DD format` });
    }
  }

  try {
    /** @type {string[]} */
    const conditions = [];
    /** @type {string[]} */
    const values = [];
    /** @param {string} v @returns {string} placeholder like $1 */
    const add = (v) => {
      values.push(v);
      return `$${values.length}`;
    };

    if (isProvided(status)) conditions.push(`p.status = ${add(status.trim())}`);
    if (isProvided(studentId)) conditions.push(`p.student_id = ${add(studentId.trim())}`);
    if (isProvided(search)) {
      const ph = add(`%${search.trim()}%`);
      conditions.push(
        `(s.student_id ILIKE ${ph} OR s.first_name ILIKE ${ph} OR s.last_name ILIKE ${ph}` +
          ` OR (s.first_name || ' ' || s.last_name) ILIKE ${ph})`,
      );
    }
    if (isProvided(curriculum)) conditions.push(`s.curriculum = ${add(curriculum.trim())}`);
    if (isProvided(periodId)) conditions.push(`p.period_id = ${add(periodId.trim())}`);
    if (isProvided(companyId)) conditions.push(`pos.company_id = ${add(companyId.trim())}`);
    if (isProvided(positionId)) conditions.push(`p.position_id = ${add(positionId.trim())}`);
    if (isProvided(submittedFrom)) {
      conditions.push(
        `p.submitted_at >= (${add(submittedFrom.trim())}::date)::timestamp AT TIME ZONE 'Asia/Bangkok'`,
      );
    }
    if (isProvided(submittedTo)) {
      conditions.push(
        `p.submitted_at < ((${add(submittedTo.trim())}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')`,
      );
    }

    const where = conditions.length > 0 ? `\nWHERE ${conditions.join(' AND ')}` : '';
    const text = `${SELECT_COLUMNS}${where}\nORDER BY p.submitted_at DESC NULLS LAST, p.plan_id DESC`;

    const result = await getPool().query(text, values);
    return jsonResponse(200, result.rows);
  } catch (err) {
    console.error('listCoopPlans failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}
