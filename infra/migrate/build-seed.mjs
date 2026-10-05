// Issue #25 — build infra/seed.sql from the V1 company list.
//
// Source of truth: infra/migrate/source/v1-companies.json (103 companies).
// The registry CSV is NOT the source: it holds only 81 and truncates addresses
// before the province. It is read only to report companies it lists and V1 lacks.
//
// Run: npm run migrate:build-seed

import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const V1_COMPANIES = path.join(__dirname, 'source', 'v1-companies.json');
const REGISTRY_CSV = path.join(__dirname, 'source', 'companies-registry-2568.csv');
const PROVINCE_FALLBACK = path.join(__dirname, 'v1-province-fallback.json');
const OUT_SQL = path.join(ROOT, 'infra', 'seed.sql');

// --- Province extraction -----------------------------------------------

const PROVINCES_TH = [
  'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น',
  'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท', 'ชัยภูมิ', 'ชุมพร', 'เชียงราย',
  'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก', 'นครปฐม', 'นครพนม',
  'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี', 'นราธิวาส', 'น่าน',
  'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี', 'ปัตตานี',
  'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'เพชรบุรี',
  'เพชรบูรณ์', 'แพร่', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร',
  'ยะลา', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน',
  'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม',
  'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย', 'สุพรรณบุรี',
  'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง', 'อำนาจเจริญ',
  'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี',
].sort((a, b) => b.length - a.length); // longest first avoids substring clashes

// For the few romanized addresses
const PROVINCE_EN = [
  [/bangkok/i, 'กรุงเทพมหานคร'],
  [/pathumthani|pathum\s*thani/i, 'ปทุมธานี'],
  [/nonthaburi/i, 'นนทบุรี'],
];

export function extractProvince(location) {
  if (/กรุงเทพ/.test(location)) return 'กรุงเทพมหานคร';
  const m = location.match(/(?:จังหวัด|จ\.)\s*([ก-๙]+)/);
  if (m && PROVINCES_TH.includes(m[1])) return m[1];
  for (const p of PROVINCES_TH) {
    if (p !== 'กรุงเทพมหานคร' && location.includes(p)) return p;
  }
  for (const [re, name] of PROVINCE_EN) {
    if (re.test(location)) return name;
  }
  return null;
}

// Address first, curated map second. Returns null rather than guessing — a wrong
// province is invisible once stored and mis-sorts the #28 filter.
export function resolveProvince(code, address, fallbackMap) {
  const fromAddress = extractProvince(address || '');
  if (fromAddress) return { province: fromAddress, source: 'v1-address' };
  if (fallbackMap[code]) return { province: fallbackMap[code], source: 'fallback-map' };
  return { province: null, source: 'unresolved' };
}

// --- Registry cross-check ----------------------------------------------

// Needs a real CSV parser: C88's address has a comma inside quotes, so split(',')
// reads that row as two and loses the company.
export function parseRegistryCodes(csvRaw) {
  const records = parse(csvRaw, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    from_line: 5, // skip title / "Last updated" / blank / header rows
  });
  const codes = new Set();
  for (const rec of records) {
    const code = (rec[0] ?? '').replace(/\s+/g, ' ').trim();
    if (code) codes.add(code);
  }
  return codes;
}

// --- Row building -------------------------------------------------------

const clean = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
const orNull = (v) => (clean(v) === '' ? null : clean(v));

// Map V1 companies onto `companies` columns. Returns problems instead of logging
// them, so main() can refuse the write and tests can assert on them.
export function toSeedRows(v1Companies, fallbackMap, registryCodes) {
  const rows = [];
  const problems = [];
  const seen = new Set();

  for (const c of v1Companies) {
    const code = clean(c.code || c.id);
    const name = clean(c.name);

    if (!code || !name) {
      problems.push({ kind: 'incomplete-record', code: code || '(no code)', detail: `name="${name}"` });
      continue;
    }
    if (seen.has(code)) {
      problems.push({ kind: 'duplicate-code', code, detail: 'kept the first occurrence' });
      continue;
    }

    const location = clean(c.address);
    const { province, source } = resolveProvince(code, location, fallbackMap);
    if (!province) {
      problems.push({ kind: 'no-province', code, detail: `no province in "${location}" and no fallback entry` });
      continue;
    }
    if (source === 'fallback-map') {
      problems.push({ kind: 'fallback-province', code, detail: `province "${province}" came from v1-province-fallback.json` });
    }

    seen.add(code);
    rows.push({
      company_id: code,
      name,
      short_name: orNull(c.shortName),
      province,
      location: location || name,
      logo_filename: orNull(c.logoFilename),
      url: orNull(c.url),
    });
  }

  // Name them every run so the V1-vs-registry gap stays visible.
  for (const code of registryCodes) {
    if (!seen.has(code)) {
      problems.push({ kind: 'registry-only', code, detail: 'in the registry CSV but not in V1 — not seeded' });
    }
  }

  return { rows, problems };
}

// --- SQL value escaping -------------------------------------------------

export function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

// --- Migration entry point ----------------------------------------------

// Problems that mean an input company never reached seed.sql. Silent loss of this
// kind is how seed.sql sat at 81 rows against a 103-company input.
const DROPPING_PROBLEMS = new Set(['incomplete-record', 'duplicate-code', 'no-province']);

export function main({ force = process.argv.includes('--force') } = {}) {
  const v1Companies = JSON.parse(readFileSync(V1_COMPANIES, 'utf-8'));
  const fallbackMap = JSON.parse(readFileSync(PROVINCE_FALLBACK, 'utf-8'));
  const registryCodes = parseRegistryCodes(readFileSync(REGISTRY_CSV, 'utf-8'));

  const { rows, problems } = toSeedRows(v1Companies, fallbackMap, registryCodes);

  const dropped = problems.filter((p) => DROPPING_PROBLEMS.has(p.kind));
  if (dropped.length && !force) {
    throw new Error(
      `${rows.length} row(s) built from ${v1Companies.length} input companies — ` +
      `${dropped.length} were dropped:\n` +
      dropped.map((p) => `  - ${p.code}: ${p.kind} — ${p.detail}`).join('\n') +
      `\nRefusing to write ${path.relative(ROOT, OUT_SQL)}. Fix the input, or pass --force.`
    );
  }

  const header = `-- Seed: ${rows.length} companies\n` +
    `-- Source: infra/migrate/source/v1-companies.json (the V1 Employers page company list)\n` +
    `-- Cross-checked against: infra/migrate/source/companies-registry-2568.csv (ทะเบียนสถานประกอบการปฏิบัติสหกิจศึกษา_2568, last updated 13/01/2568)\n` +
    `-- Generated by infra/migrate/build-seed.mjs — do not hand-edit, re-run the script instead\n\n` +
    `INSERT INTO companies (company_id, name, short_name, province, location, logo_filename, url) VALUES\n`;

  const values = rows
    .map((r) => `  (${sqlStr(r.company_id)}, ${sqlStr(r.name)}, ${sqlStr(r.short_name)}, ${sqlStr(r.province)}, ${sqlStr(r.location)}, ${sqlStr(r.logo_filename)}, ${sqlStr(r.url)})`)
    .join(',\n');

  const upsert = `\nON CONFLICT (company_id) DO UPDATE SET\n` +
    `  name = EXCLUDED.name,\n` +
    `  short_name = EXCLUDED.short_name,\n` +
    `  province = EXCLUDED.province,\n` +
    `  location = EXCLUDED.location,\n` +
    `  logo_filename = EXCLUDED.logo_filename,\n` +
    `  url = EXCLUDED.url;\n`;

  writeFileSync(OUT_SQL, header + values + '\n' + upsert);

  console.log(`Wrote ${rows.length} of ${v1Companies.length} input companies to ${path.relative(ROOT, OUT_SQL)}`);

  const provinces = new Map();
  for (const r of rows) provinces.set(r.province, (provinces.get(r.province) ?? 0) + 1);
  console.log(`${provinces.size} distinct provinces: ` +
    [...provinces.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} (${n})`).join(', '));

  if (problems.length) {
    console.log(`\n${problems.length} note(s):`);
    for (const p of problems) console.log(`  - [${p.kind}] ${p.code}: ${p.detail}`);
  } else {
    console.log('\nNo notes.');
  }
}

// Run only as the process entry point, so importing this file does no disk I/O.
// Compare resolved OS paths, not import.meta.url against process.argv[1] — on Windows
// one is a file:/// URL and the other a backslash path, so that never matches.
const isMain = path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? '');
if (isMain) main();
