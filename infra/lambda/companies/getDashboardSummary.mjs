// GET /coop-plans/dashboard — live status counts and overdue plans for STAFF/ADMIN (#266).
import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { getAuthenticatedUser } from './auth.mjs';
import { assertCanViewDashboard, ForbiddenError } from './authorize.mjs';
import { VALID_STATUSES } from './listCoopPlans.mjs';

const STATUS_COUNTS_SQL = `SELECT status, COUNT(*)::int AS count FROM coop_plans GROUP BY status`;

const OVERDUE_PLANS_SQL = `SELECT p.plan_id, p.student_id, p.status,
       s.first_name, s.last_name, c.name AS company_name, c.short_name AS company_short_name,
       per.name AS period_name, to_char(sch.end_date, 'YYYY-MM-DD') AS submission_deadline,
       ((NOW() AT TIME ZONE 'Asia/Bangkok')::date - sch.end_date)::int AS days_overdue
FROM coop_plans p
JOIN students s ON s.student_id = p.student_id
LEFT JOIN positions pos ON pos.position_id = p.position_id
LEFT JOIN companies c ON c.company_id = pos.company_id
LEFT JOIN periods per ON per.period_id = p.period_id
JOIN (
  SELECT period_id, MAX(end_date) AS end_date FROM coop_schedules
  WHERE activity_type = 'APPLICATION' GROUP BY period_id
) sch ON sch.period_id = p.period_id
WHERE p.status NOT IN ('APPROVED', 'REJECTED')
  AND sch.end_date < (NOW() AT TIME ZONE 'Asia/Bangkok')::date
ORDER BY sch.end_date ASC, p.plan_id ASC`;

export async function getDashboardSummary(event) {
  try {
    const { user, denied } = await getAuthenticatedUser(event);
    if (denied) return jsonResponse(denied.status, { error: denied.error });
    assertCanViewDashboard(user);
  } catch (err) {
    if (err instanceof ForbiddenError) return jsonResponse(403, { error: 'Forbidden' });
    console.error('getDashboardSummary auth failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }

  try {
    const pool = getPool();
    const [countsResult, overdueResult] = await Promise.all([
      pool.query(STATUS_COUNTS_SQL),
      pool.query(OVERDUE_PLANS_SQL),
    ]);
    const statusCounts = Object.fromEntries(VALID_STATUSES.map((s) => [s, 0]));
    for (const row of countsResult.rows) {
      if (row.status in statusCounts) statusCounts[row.status] = Number(row.count) || 0;
    }
    const totalPlans = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
    const overduePlans = overdueResult.rows;
    return jsonResponse(200, { statusCounts, totalPlans, overdueCount: overduePlans.length, overduePlans });
  } catch (err) {
    console.error('getDashboardSummary query failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}
