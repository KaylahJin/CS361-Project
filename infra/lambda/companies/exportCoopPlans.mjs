// GET /coop-plans/export — direct CSV download for STAFF and ADMIN.

import { getAuthenticatedUser } from './auth.mjs';
import { getPool } from './db.mjs';

const VALID_STATUSES = [
  'PREPARING', 'SUBMITTED', 'RETURNED', 'ENDORSED', 'ELIGIBLE',
  'NOT_ELIGIBLE', 'SELECTED', 'NOT_SELECTED', 'APPROVED', 'REJECTED',
];

export const CSV_HEADERS = [
  'รหัสนักศึกษา',
  'ชื่อ-นามสกุล',
  'หลักสูตร',
  'สถานะแผน',
  'สถานประกอบการ',
  'ตำแหน่ง',
  'รอบเวลา',
  'วันที่ส่งแผน',
  'วันที่พิจารณาล่าสุด',
  'สถานะ deadline',
];

const SELECT_COLUMNS = `SELECT p.plan_id, p.student_id, p.status,
       p.submitted_at, p.reviewed_at,
       s.first_name, s.last_name, s.curriculum,
       pos.title AS position_title, pos.company_id,
       c.name AS company_name, c.short_name AS company_short_name,
       per.name AS period_name,
       to_char(MAX(sch.end_date) FILTER (WHERE sch.activity_type = 'APPLICATION'), 'YYYY-MM-DD') AS submission_deadline
FROM coop_plans p
JOIN students s ON s.student_id = p.student_id
LEFT JOIN positions pos ON pos.position_id = p.position_id
LEFT JOIN companies c ON c.company_id = pos.company_id
LEFT JOIN periods per ON per.period_id = p.period_id
LEFT JOIN coop_schedules sch ON sch.period_id = p.period_id`;

function isProvided(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function csvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function deadlineStatus(row, now = new Date()) {
  if (!row.submission_deadline) return 'ไม่มีกำหนดส่ง';
  const deadline = new Date(`${row.submission_deadline}T00:00:00Z`);
  if (Number.isNaN(deadline.getTime())) return 'ไม่มีกำหนดส่ง';

  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const days = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
  if (days < 0 && ['PREPARING', 'RETURNED'].includes(row.status)) return 'เกินกำหนด';
  if (days <= 7 && days >= 0) return 'ใกล้ครบ';
  if (days > 7) return 'ปกติ';
  return 'ปกติ';
}

export function buildCsv(rows) {
  const data = rows.map((row) => [
    row.student_id,
    `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    row.curriculum,
    row.status,
    row.company_name || row.company_short_name || '',
    row.position_title || '',
    row.period_name || row.period_id,
    formatDate(row.submitted_at),
    formatDate(row.reviewed_at),
    deadlineStatus(row),
  ]);
  return '\ufeff' + [CSV_HEADERS, ...data].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export async function exportCoopPlans(event) {
  const { user, denied } = await getAuthenticatedUser(event);
  if (denied) return { statusCode: denied.status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: denied.error }) };
  if (!['STAFF', 'ADMIN'].includes(user.role)) {
    return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const q = event?.queryStringParameters ?? {};
  if (isProvided(q.status) && !VALID_STATUSES.includes(q.status.trim())) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: `status must be one of ${VALID_STATUSES.join(', ')}` }) };
  }
  for (const [name, value] of [['submittedFrom', q.submittedFrom], ['submittedTo', q.submittedTo]]) {
    if (isProvided(value) && !isValidDate(value.trim())) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: `${name} must be a valid date in YYYY-MM-DD format` }) };
    }
  }

  const auditFilters = {};
  for (const name of [
    'status', 'studentId', 'search', 'curriculum',
    'periodId', 'companyId', 'positionId', 'submittedFrom', 'submittedTo',
  ]) {
    if (isProvided(q[name])) auditFilters[name] = q[name].trim();
  }

  const conditions = [];
  const values = [];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (isProvided(q.status)) conditions.push(`p.status = ${add(q.status.trim())}`);
  if (isProvided(q.studentId)) conditions.push(`p.student_id = ${add(q.studentId.trim())}`);
  if (isProvided(q.search)) {
    const ph = add(`%${q.search.trim()}%`);
    conditions.push(`(s.student_id ILIKE ${ph} OR s.first_name ILIKE ${ph} OR s.last_name ILIKE ${ph} OR (s.first_name || ' ' || s.last_name) ILIKE ${ph})`);
  }
  if (isProvided(q.curriculum)) conditions.push(`s.curriculum = ${add(q.curriculum.trim())}`);
  if (isProvided(q.periodId)) conditions.push(`p.period_id = ${add(q.periodId.trim())}`);
  if (isProvided(q.companyId)) conditions.push(`pos.company_id = ${add(q.companyId.trim())}`);
  if (isProvided(q.positionId)) conditions.push(`p.position_id = ${add(q.positionId.trim())}`);
  if (isProvided(q.submittedFrom)) conditions.push(`p.submitted_at >= (${add(q.submittedFrom.trim())}::date)::timestamp AT TIME ZONE 'Asia/Bangkok'`);
  if (isProvided(q.submittedTo)) conditions.push(`p.submitted_at < ((${add(q.submittedTo.trim())}::date + 1)::timestamp AT TIME ZONE 'Asia/Bangkok')`);

  const where = conditions.length ? `\nWHERE ${conditions.join(' AND ')}` : '';
  const text = `${SELECT_COLUMNS}${where}\nGROUP BY p.plan_id, p.student_id, p.status, p.submitted_at, p.reviewed_at, p.period_id,\n s.first_name, s.last_name, s.curriculum, pos.title, pos.company_id,\n c.name, c.short_name, per.name\nORDER BY p.submitted_at DESC NULLS LAST, p.plan_id DESC`;

  try {
    const pool = getPool();
    const result = await pool.query(text, values);
    await pool.query(
      `INSERT INTO export_audit (exported_by, exporter_role, filters)
       VALUES ($1, $2, $3::jsonb)`,
      [user.sub, user.role, JSON.stringify(auditFilters)],
    );
    const csv = buildCsv(result.rows);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="coop-plans-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
      body: csv,
    };
  } catch (err) {
    console.error('exportCoopPlans failed', err);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
