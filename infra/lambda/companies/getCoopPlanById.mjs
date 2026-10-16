// GET /coop-plans/{planId} — one plan, joined with its student, position,
// company and period so the frontend needs no follow-up calls.

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { getAuthenticatedUser } from './auth.mjs';
import { assertCanViewPlan, ForbiddenError } from './authorize.mjs';

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

function isValidPlanId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return false;
  const n = Number(value.trim());
  return n >= 1 && n <= MAX_INT4;
}

export async function getCoopPlanById(event) {
  const planId = event?.pathParameters?.planId;

  // plan_id is an INTEGER column, so a non-numeric id has to be rejected here;
  // handed to pg it would throw and come back as a 500.
  if (!isValidPlanId(planId)) {
    return jsonResponse(400, { error: 'planId must be a positive integer' });
  }

  // A throw while resolving identity is a server fault (app_users missing, DB
  // unreachable), so it answers 500. Reporting it as 401 would tell a
  // signed-in user their credentials were rejected and hide the outage.
  //
  // getAuthenticatedUser decides between 401 and 403 itself; see auth.mjs.
  let user;
  try {
    const resolved = await getAuthenticatedUser(event);
    if (resolved.denied) {
      return jsonResponse(resolved.denied.status, { error: resolved.denied.error });
    }
    user = resolved.user;
  } catch (err) {
    console.error('getCoopPlanById auth failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }

  try {
    const result = await getPool().query(SELECT_BY_ID, [Number(planId.trim())]);

    if (result.rows.length === 0) {
      return jsonResponse(404, { error: 'Coop plan not found' });
    }

    const plan = result.rows[0];

    // Ownership is checked against the row we just read, so a missing plan
    // answers 404 before a forbidden one answers 403. That does reveal which
    // plan ids exist, which is fine here: everyone past this point is a known
    // signed-in user and the ids are sequential anyway.
    try {
      await assertCanViewPlan(user, plan);
    } catch (err) {
      if (err instanceof ForbiddenError) {
        console.error('getCoopPlanById forbidden', err.message);
        return jsonResponse(403, { error: 'Forbidden' });
      }
      throw err;
    }

    return jsonResponse(200, plan);
  } catch (err) {
    console.error('getCoopPlanById failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}
