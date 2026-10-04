// Issue #26 evidence — proves get-by-id, API-vs-RDS equality, and the not-found case.
//
//   npm run verify:api
//
// Reads the API URL and DB connection from Terraform outputs, password from
// infra/terraform/terraform.tfvars. Connects to the raw RDS endpoint, not the proxy
// (the proxy is VPC-only).

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TF_DIR = path.join(__dirname, 'terraform');

const tfOutput = (name) =>
  execFileSync('terraform', ['output', '-raw', name], { cwd: TF_DIR, encoding: 'utf-8' }).trim();

const dbPassword = () => {
  const tfvars = readFileSync(path.join(TF_DIR, 'terraform.tfvars'), 'utf-8');
  const m = tfvars.match(/^db_password\s*=\s*"(.*)"$/m);
  if (!m) throw new Error('db_password not found in infra/terraform/terraform.tfvars');
  return m[1];
};

const COLUMNS = ['company_id', 'name', 'short_name', 'province', 'location', 'description', 'logo_filename', 'url'];

// Compare as strings so a Date from pg and an ISO string from JSON still match.
const norm = (v) => (v === null || v === undefined ? '(null)' : String(v));

const pad = (s, n) => String(s).padEnd(n);

async function main() {
  const api = tfOutput('api_url');
  const client = new pg.Client({
    host: tfOutput('rds_endpoint'),
    port: 5432,
    database: tfOutput('db_name'),
    user: tfOutput('db_username'),
    password: dbPassword(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let failures = 0;
  const fail = (msg) => { failures++; console.log(`    FAIL: ${msg}`); };

  console.log(`API: ${api}`);
  console.log(`RDS: ${client.host}\n`);

  // Pick a real id from the database rather than hardcoding one.
  const { rows: [picked] } = await client.query(
    `SELECT company_id FROM companies ORDER BY length(company_id) DESC, company_id DESC LIMIT 1`
  );
  const id = picked.company_id;

  // --- [1] get by id ---
  console.log(`[1] GET BY ID  —  AC: ระบบสามารถเรียกข้อมูล Company ที่ระบุได้`);
  const res = await fetch(`${api}/companies/${id}`);
  const apiRow = await res.json();
  console.log(`    GET /companies/${id}  ->  HTTP ${res.status}`);
  console.log(`    ${JSON.stringify(apiRow)}`);
  if (res.status !== 200) fail(`expected 200, got ${res.status}`);
  if (Array.isArray(apiRow)) fail('expected a single object, got an array');

  // --- [2] API vs RDS ---
  console.log(`\n[2] API vs RDS  —  AC: ข้อมูลที่ได้ตรงกับข้อมูลใน Data Source`);
  const { rows: [dbRow] } = await client.query(
    `SELECT ${COLUMNS.join(', ')} FROM companies WHERE company_id = $1`, [id]
  );
  console.log(`    ${pad('field', 15)}| ${pad('API', 34)}| ${pad('RDS', 34)}| match`);
  console.log(`    ${'-'.repeat(15)}+-${'-'.repeat(34)}+-${'-'.repeat(34)}+------`);
  for (const col of COLUMNS) {
    const a = norm(apiRow[col]);
    const d = norm(dbRow[col]);
    const ok = a === d;
    if (!ok) failures++;
    console.log(`    ${pad(col, 15)}| ${pad(a.slice(0, 33), 34)}| ${pad(d.slice(0, 33), 34)}| ${ok ? 'OK' : 'DIFF'}`);
  }

  // --- [3] not found ---
  console.log(`\n[3] NOT FOUND  —  AC: กรณีไม่พบข้อมูลไม่ทำให้หน้าเว็บพัง`);
  for (const [label, pathSuffix, want] of [
    ['unknown id', 'C999999', 404],
    ['blank id', '%20', 400],
  ]) {
    const r = await fetch(`${api}/companies/${pathSuffix}`);
    const body = await r.text();
    console.log(`    ${pad(label, 12)} GET /companies/${pad(pathSuffix, 8)} -> HTTP ${r.status}  ${body}`);
    if (r.status !== want) fail(`${label}: expected ${want}, got ${r.status}`);
    if (r.status >= 500) fail(`${label}: 5xx means the handler threw instead of handling it`);
  }
  // The list endpoint is what the page actually calls, so prove a no-match search
  // returns an empty list rather than an error.
  const emptyRes = await fetch(`${api}/companies?search=ไม่มีบริษัทชื่อนี้`);
  const emptyBody = await emptyRes.json();
  console.log(`    ${pad('no match', 12)} GET /companies?search=ไม่มีบริษัทชื่อนี้ -> HTTP ${emptyRes.status}  ${JSON.stringify(emptyBody)}`);
  if (emptyRes.status !== 200 || emptyBody.length !== 0) fail('a no-match search should be 200 with an empty array');

  // --- [4] list count ---
  console.log(`\n[4] LIST COUNT vs RDS`);
  const listCount = (await (await fetch(`${api}/companies`)).json()).length;
  const { rows: [{ count }] } = await client.query('SELECT count(*)::int AS count FROM companies');
  console.log(`    GET /companies -> ${listCount} rows   |   SELECT count(*) -> ${count}   |   ${listCount === count ? 'OK' : 'DIFF'}`);
  if (listCount !== count) failures++;

  await client.end();
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
