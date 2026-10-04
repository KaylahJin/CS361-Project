// Issue #25 — build infra/seed.sql from the official 2568 company registry
// Source of truth: infra/migrate/source/companies-registry-2568.csv (Code, name, location)
// Enrichment (short_name/logo_filename/url — not in the registry): parsed from src/data/employersData.ts
//
// Run: npm run migrate:build-seed   (equivalently: node infra/migrate/build-seed.mjs)
//
// Importing this module has no side effects — the migration runs only via main(), which is
// invoked from the direct-execution guard at the bottom of the file.

import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const REGISTRY_CSV = path.join(__dirname, 'source', 'companies-registry-2568.csv');
const EMPLOYERS_SOURCE = path.join(ROOT, 'src', 'data', 'employersData.ts');
const OUT_SQL = path.join(ROOT, 'infra', 'seed.sql');
const PROVINCE_FALLBACK = path.join(__dirname, 'v1-province-fallback.json');

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

// English fallback for the handful of romanized addresses in the registry
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
  return null; // flagged for manual review below
}

// --- V1 enrichment (short_name / logo_filename / url) -------------------

export function parseV1Enrichment(tsxSource) {
  const map = new Map();
  const blockRe = /code:\s*'([^']+)'[\s\S]*?(?=\n\s*\{|\n\];)/g;
  let m;
  while ((m = blockRe.exec(tsxSource))) {
    const block = m[0];
    const code = m[1];
    const get = (field) => {
      const fm = block.match(new RegExp(`${field}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
      return fm ? fm[1] : undefined;
    };
    map.set(code, {
      shortName: get('shortName'),
      logoFilename: get('logoFilename'),
      url: get('url'),
    });
  }
  return map;
}

// --- SQL value escaping -------------------------------------------------

export function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

// --- Migration entry point ----------------------------------------------

// Fraction of registry rows allowed to come back with no V1 enrichment match before
// main() refuses to write a degraded seed.sql. Chosen loosely above the handful of
// genuinely-new-since-V1 companies we expect; a refactor of employersData.ts that breaks
// parseV1Enrichment's regex blows straight past this (typically to ~100% missing).
const MAX_MISSING_ENRICHMENT_RATIO = 0.2;

export function main({ allowMissingEnrichment = process.argv.includes('--allow-missing-enrichment') } = {}) {
  // --- Load inputs ------------------------------------------------------

  const csvRaw = readFileSync(REGISTRY_CSV, 'utf-8');
  const records = parse(csvRaw, {
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    from_line: 5, // skip title / "Last updated" / blank / header rows
  });

  const employersSource = readFileSync(EMPLOYERS_SOURCE, 'utf-8');
  const enrichment = parseV1Enrichment(employersSource);
  const provinceFallback = JSON.parse(readFileSync(PROVINCE_FALLBACK, 'utf-8'));

  // Fail loudly instead of silently emitting a seed.sql with every short_name/
  // logo_filename/url nulled out. This happens if EMPLOYERS_SOURCE has been refactored
  // away from the `code: '...'` object-literal shape parseV1Enrichment expects (it's a
  // live, actively-edited data file, not a frozen snapshot).
  if (enrichment.size === 0 && !allowMissingEnrichment) {
    throw new Error(
      `parseV1Enrichment() matched 0 companies in ${path.relative(ROOT, EMPLOYERS_SOURCE)}. ` +
      `Refusing to write ${path.relative(ROOT, OUT_SQL)} — that would null out short_name/logo_filename/url ` +
      `for every row. Re-run with --allow-missing-enrichment to force a write anyway.`
    );
  }

  // --- Build rows -------------------------------------------------------

  const rows = [];
  const needsReview = [];
  const seen = new Set();
  let missingEnrichmentCount = 0;

  for (const rec of records) {
    const [code, name, location] = rec.map((s) => (s ?? '').replace(/\s+/g, ' ').trim());
    if (!code || !name) continue;
    if (seen.has(code)) { needsReview.push(`${code}: duplicate row in registry, kept first`); continue; }
    seen.add(code);

    let province = extractProvince(location || '');
    let provinceSource = 'registry-address';
    if (!province && provinceFallback[code]) {
      province = provinceFallback[code];
      provinceSource = 'v1-fallback';
    }
    if (!province) {
      needsReview.push(`${code}: could not extract province from "${location}" and no V1 fallback — defaulted to กรุงเทพมหานคร, verify manually`);
      province = 'กรุงเทพมหานคร';
      provinceSource = 'default';
    } else if (provinceSource === 'v1-fallback') {
      needsReview.push(`${code}: province taken from V1 fallback ("${province}") — registry address "${location}" had no extractable province, spot-check`);
    }

    const enr = enrichment.get(code);
    if (!enr) {
      missingEnrichmentCount++;
      needsReview.push(`${code}: not found in ${path.relative(ROOT, EMPLOYERS_SOURCE)} — no short_name/logo/url, using NULL`);
    }

    rows.push({
      company_id: code,
      name,
      short_name: enr?.shortName ?? null,
      province: province ?? 'ไม่ระบุ',
      location: location || name,
      logo_filename: enr?.logoFilename ?? null,
      url: enr?.url ?? null,
    });
  }

  const missingRatio = rows.length ? missingEnrichmentCount / rows.length : 0;
  if (missingRatio > MAX_MISSING_ENRICHMENT_RATIO && !allowMissingEnrichment) {
    throw new Error(
      `${missingEnrichmentCount}/${rows.length} companies (${Math.round(missingRatio * 100)}%) had no V1 ` +
      `enrichment match in ${path.relative(ROOT, EMPLOYERS_SOURCE)} — refusing to write a seed.sql this degraded. ` +
      `Re-run with --allow-missing-enrichment to force a write anyway.`
    );
  }

  // --- Emit SQL ---------------------------------------------------------

  const header = `-- Seed: ${rows.length} companies from official registry\n` +
    `-- Source: infra/migrate/source/companies-registry-2568.csv (ทะเบียนสถานประกอบการปฏิบัติสหกิจศึกษา_2568, last updated 13/01/2568)\n` +
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

  console.log(`Wrote ${rows.length} companies to ${path.relative(ROOT, OUT_SQL)}`);
  if (needsReview.length) {
    console.log(`\n${needsReview.length} item(s) need manual review:`);
    for (const line of needsReview) console.log(`  - ${line}`);
  } else {
    console.log('No manual review items.');
  }
}

// Run the migration only when this file is the process entry point, so that importing
// it (e.g. from a unit test) performs no disk I/O.
//
// Do NOT use the common `import.meta.url === \`file://${process.argv[1]}\`` idiom: on
// Windows process.argv[1] is a raw OS path with backslashes and a drive letter
// (G:\...\build-seed.mjs) while import.meta.url is a percent-encoded file:/// URL
// (file:///G:/.../build-seed.mjs), so that comparison never matches. Normalizing both
// sides to resolved OS paths works on Windows, macOS, and Linux alike.
const isMain = path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? '');
if (isMain) main();
