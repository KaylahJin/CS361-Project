// GET /coop-plans — a bare JSON array, newest submission first, drafts last.
// Every query param is optional and they combine with AND; the date filters
// take YYYY-MM-DD and are read as whole Asia/Bangkok days.

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { getAuthenticatedUser } from './auth.mjs';
import { buildCoopPlanListFilter, ForbiddenError } from './authorize.mjs';

// V3 workflow statuses. UNDER_REVIEW was a V2 state and is gone: reviewers act
// on SUBMITTED directly, and RETURNED is the plan sent back for edits.
export const VALID_STATUSES = ['PREPARING', 'SUBMITTED', 'RETURNED', 'APPROVED', 'REJECTED'];

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

function isProvided(value) {
  return typeof value === 'string' && value.trim() !== '';
}

// Strict YYYY-MM-DD that is also a real calendar date: the round-trip through
// Date rejects 2026-02-30, which the regex alone accepts.
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export async function listCoopPlans(event) {
  // Identity and scope come before query parsing: the role decides which rows
  // exist for this caller at all. A throw from either call is a server fault
  // (app_users missing, DB unreachable) and answers 500 — reporting it as 401
  // would tell a signed-in user their credentials were rejected.
  //
  // getAuthenticatedUser decides between 401 and 403 itself; see auth.mjs.
  let roleFilter;
  try {
    const { user, denied } = await getAuthenticatedUser(event);
    if (denied) {
      return jsonResponse(denied.status, { error: denied.error });
    }

    roleFilter = await buildCoopPlanListFilter(user);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      console.error('listCoopPlans forbidden', err.message);
      return jsonResponse(403, { error: 'Forbidden' });
    }
    console.error('listCoopPlans auth failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }

  const q = event?.queryStringParameters ?? {};
  const { status, studentId, search, curriculum, periodId, companyId, positionId } = q;
  const submittedFrom = q.submittedFrom;
  const submittedTo = q.submittedTo;

  if (isProvided(status) && !VALID_STATUSES.includes(status.trim())) {
    return jsonResponse(400, { error: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }
  for (const [name, value] of [['submittedFrom', submittedFrom], ['submittedTo', submittedTo]]) {
    if (isProvided(value) && !isValidDate(value.trim())) {
      return jsonResponse(400, { error: `${name} must be a valid date in YYYY-MM-DD format` });
    }
  }

  try {
    const conditions = [];
    const values = [];
    // Pushes a value and hands back its placeholder ($1, $2, ...), so the
    // numbering stays in step with the values array as filters are added.
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

    // The role filter is ANDed in alongside the caller's own filters, so a
    // query param can only narrow the caller's scope, never widen it: a
    // student asking for ?studentId=SOMEONE_ELSE ends up with
    // `p.student_id = 'OWN' AND p.student_id = 'SOMEONE_ELSE'` — no rows.
    if (roleFilter.sql) {
      let sql = roleFilter.sql;
      for (const param of roleFilter.params) {
        sql = sql.replace('$PARAM', add(param));
      }
      conditions.push(sql);
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
