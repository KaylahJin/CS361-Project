// Issue #37 — build positions seed SQL from infra/migrate/source/positions.json
// Matches official Position / Project Data Model (docs/overview/position.md)

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const POSITIONS_JSON = path.join(__dirname, 'source', 'positions.json');
const SEED_SQL = path.join(ROOT, 'infra', 'seed.sql');

function sqlStr(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlDate(v) {
  if (!v || v === 'null') return 'NULL';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return `'${v}'`;
  }
  return 'NULL';
}

function mapCategory(raw) {
  if (!raw) return 'other';
  const c = raw.trim();
  switch (c) {
    case 'Software Development':
      return 'software_development';
    case 'Data / AI':
      return 'data_ai';
    case 'Cloud / Infrastructure / DevOps':
      return 'cloud_infrastructure_devops';
    case 'QA / Testing':
      return 'qa_testing';
    case 'Business / Enterprise Systems':
      return 'business_enterprise_systems';
    case 'IT Support / Operations':
      return 'it_support_operations';
    case 'UX/UI Design':
      return 'ux_ui_design';
    case 'Cybersecurity':
      return 'cybersecurity';
    case 'Technical Sales':
      return 'technical_sales';
    case 'IT Solutions':
      return 'it_solutions';
    default:
      return 'other';
  }
}

function mapWorkMode(raw) {
  if (!raw) return 'unknown';
  const wm = raw.toLowerCase();
  if (wm.includes('hybrid')) return 'hybrid';
  if (wm.includes('remote') || wm.includes('work from home') || wm.includes('wfh')) return 'remote';
  if (wm.includes('on-site') || wm.includes('onsite') || wm.includes('office')) return 'onsite';
  return 'unknown';
}

function mapStatus(currentStatus, openNow) {
  if (openNow === 'True' || openNow === true) return 'open';
  if (currentStatus === 'past_deadline') return 'expired';
  if (currentStatus === 'closed_on_employer_page') return 'closed';
  if (currentStatus === 'historical_program') return 'expired';
  if (currentStatus === 'open') return 'open';
  if (currentStatus === 'closed') return 'closed';
  if (currentStatus === 'expired') return 'expired';
  return 'unknown';
}

export function generatePositionsSql() {
  const raw = readFileSync(POSITIONS_JSON, 'utf-8');
  const data = JSON.parse(raw);
  const positions = data.positions || [];

  const validRows = [];
  const skipped = [];

  for (const p of positions) {
    const companyId = (p.registry_candidate_codes && p.registry_candidate_codes.length > 0)
      ? p.registry_candidate_codes[0]
      : (p.confirmed_registry_company_id || null);

    if (!companyId) {
      skipped.push(`${p.position_id} (${p.title} - ${p.company_label}): no valid company_id in registry, skipped to satisfy NOT NULL FK`);
      continue;
    }

    const descParts = [];
    if (p.duration) descParts.push(`ระยะเวลา: ${p.duration}`);
    if (p.allowance) descParts.push(`เบี้ยเลี้ยง: ${p.allowance}`);
    const description = descParts.length > 0 ? descParts.join(' | ') : null;

    validRows.push({
      position_id: p.position_id,
      company_id: companyId,
      title: p.title,
      category: mapCategory(p.category),
      description: description,
      qualification: p.qualifications || null,
      location: p.work_location || null,
      work_mode: mapWorkMode(p.work_mode),
      application_deadline: p.application_deadline || null,
      application_url: p.application_url || null,
      status: mapStatus(p.current_status, p.open_now),
      source_url: p.source_url || null,
    });
  }

  const header = `\n\n-- Seed: ${validRows.length} positions with valid company references\n` +
    `-- Source: infra/migrate/source/positions.json\n` +
    `-- Standardized categories, work_mode, and status matching docs/overview/position.md\n\n` +
    `INSERT INTO positions (position_id, company_id, title, category, description, qualification, location, work_mode, application_deadline, application_url, status, source_url) VALUES\n`;

  const values = validRows
    .map((r) => `  (${sqlStr(r.position_id)}, ${sqlStr(r.company_id)}, ${sqlStr(r.title)}, ${sqlStr(r.category)}, ${sqlStr(r.description)}, ${sqlStr(r.qualification)}, ${sqlStr(r.location)}, ${sqlStr(r.work_mode)}, ${sqlDate(r.application_deadline)}, ${sqlStr(r.application_url)}, ${sqlStr(r.status)}, ${sqlStr(r.source_url)})`)
    .join(',\n');

  const upsert = `\nON CONFLICT (position_id) DO UPDATE SET\n` +
    `  company_id = EXCLUDED.company_id,\n` +
    `  title = EXCLUDED.title,\n` +
    `  category = EXCLUDED.category,\n` +
    `  description = EXCLUDED.description,\n` +
    `  qualification = EXCLUDED.qualification,\n` +
    `  location = EXCLUDED.location,\n` +
    `  work_mode = EXCLUDED.work_mode,\n` +
    `  application_deadline = EXCLUDED.application_deadline,\n` +
    `  application_url = EXCLUDED.application_url,\n` +
    `  status = EXCLUDED.status,\n` +
    `  source_url = EXCLUDED.source_url;\n`;

  return {
    sql: header + values + upsert,
    count: validRows.length,
    skipped,
  };
}

export function main() {
  const currentSeed = readFileSync(SEED_SQL, 'utf-8');
  const companiesPart = currentSeed.includes('\n\n-- Seed: ')
    ? currentSeed.split('\n\n-- Seed: ')[0].trimEnd()
    : currentSeed.trimEnd();

  const result = generatePositionsSql();
  writeFileSync(SEED_SQL, companiesPart + result.sql);
  console.log(`Generated ${result.count} positions to ${path.relative(ROOT, SEED_SQL)}`);
  if (result.skipped.length) {
    console.log(`Skipped ${result.skipped.length} items without company mapping:`);
    for (const s of result.skipped) console.log(`  - ${s}`);
  }
}

const isMain = path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? '');
if (isMain) main();
