import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const seedPath = path.join(ROOT, 'infra', 'seed.sql');
const outPath = path.join(ROOT, 'src', 'data', 'positionsData.json');

const seed = fs.readFileSync(seedPath, 'utf8');

// Parse companies
const compRegex = /\('([^']+)',\s*'([^']+)',\s*(?:'([^']+)'|NULL),\s*(?:'([^']+)'|NULL),\s*(?:'([^']+)'|NULL),\s*(?:'([^']+)'|NULL),\s*(?:'([^']+)'|NULL)\)/g;
const companies = new Map();
let m;
while ((m = compRegex.exec(seed)) !== null) {
  companies.set(m[1], {
    company_id: m[1],
    name: m[2],
    short_name: m[3] || null,
    province: m[4] || null,
    location: m[5] || null,
    logo_filename: m[6] || null,
    url: m[7] || null
  });
}

// Parse positions
// e.g. ('POS001', 'C18', 'Programmer', 'software_development', '...', NULL, 'SCG บางซื่อ', 'unknown', NULL, NULL, 'expired', '...')
const posLines = seed.split('\n').filter(l => l.trim().startsWith("('POS"));
const positions = [];

for (const line of posLines) {
  const clean = line.trim().replace(/^INSERT INTO positions.*?VALUES\s*/, '').replace(/^[,\s]*\(/, '').replace(/\)[,;]?$/, '');
  // Parse SQL row values safely
  const values = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "'" && !inQuote) {
      inQuote = true;
    } else if (ch === "'" && inQuote) {
      if (clean[i + 1] === "'") {
        cur += "'";
        i++;
      } else {
        inQuote = false;
      }
    } else if (ch === ',' && !inQuote) {
      values.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  values.push(cur.trim());

  const parseVal = (v) => {
    if (v === 'NULL' || v === undefined) return null;
    return v.replace(/^'(.*)'$/, '$1');
  };

  const posId = parseVal(values[0]);
  const compId = parseVal(values[1]);
  const company = companies.get(compId) || {};

  positions.push({
    position_id: posId,
    company_id: compId,
    company_name: company.name || null,
    company_short_name: company.short_name || null,
    company_logo: company.logo_filename || null,
    company_province: company.province || null,
    title: parseVal(values[2]),
    category: parseVal(values[3]),
    description: parseVal(values[4]),
    qualification: parseVal(values[5]),
    location: parseVal(values[6]),
    work_mode: parseVal(values[7]),
    application_deadline: parseVal(values[8]),
    application_url: parseVal(values[9]),
    status: parseVal(values[10]),
    source_url: parseVal(values[11])
  });
}

console.log(`Parsed ${companies.size} companies and ${positions.length} positions.`);
fs.writeFileSync(outPath, JSON.stringify(positions, null, 2), 'utf8');
console.log(`Successfully wrote ${positions.length} positions to ${outPath}`);
