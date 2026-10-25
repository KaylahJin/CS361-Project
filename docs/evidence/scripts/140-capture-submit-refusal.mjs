// Evidence for #140: the reasons a refused submission shows are Thai.
//
// In a real Chrome on the live site: sign in as student1, open the plan, press
// "ยื่นแผน" and then "ยืนยันยื่นแผน". The API refuses the plan with every
// requirement it is missing. The script saves a screenshot of the dialog and
// checks that each reason on screen is Thai, with no code name in it.
//
// The seeded student is refused for two reasons (submission window closed,
// required course คพ.261 missing). To also get "GPA too low", lower the GPA
// first and put it back afterwards:
//   psql ... -v gpa=2.40 -f docs/evidence/scripts/140-set-student-gpa.sql
//   psql ... -v gpa=2.90 -f docs/evidence/scripts/140-set-student-gpa.sql
//
//   npm i --no-save playwright-core
//   EVIDENCE_SITE_URL=http://<bucket>.s3-website-us-east-1.amazonaws.com \
//   COOP_TEST_PASSWORD=... \
//   node docs/evidence/scripts/140-capture-submit-refusal.mjs <file-prefix>
//
//   file-prefix  e.g. 140-04-after-window-gpa-courses -> docs/evidence/<prefix>.png
//
// Exit code 1 when a reason on screen is not Thai or the API did not refuse.
// Env: EVIDENCE_OUT (default docs/evidence), CHROME_PATH.

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const SITE = process.env.EVIDENCE_SITE_URL;
const PASSWORD = process.env.COOP_TEST_PASSWORD;
const OUT = process.env.EVIDENCE_OUT || 'docs/evidence';
const prefix = process.argv[2];

if (!SITE || !PASSWORD || !prefix) {
  console.error('usage: EVIDENCE_SITE_URL=... COOP_TEST_PASSWORD=... node 140-capture-submit-refusal.mjs <file-prefix>');
  process.exit(2);
}

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => p && existsSync(p));

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'th-TH' });
const page = await context.newPage();

let refusal = null;
page.on('response', async (r) => {
  if (r.url().endsWith('/submit')) {
    refusal = { status: r.status(), body: await r.json().catch(() => null) };
  }
});

await page.goto(SITE, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).first().click();
await page.locator('input[type=email]').fill('student1@example.com');
await page.locator('input[type=password]').fill(PASSWORD);
const signedIn = page.waitForResponse((r) => r.url().endsWith('/me'), { timeout: 20000 });
await page.locator('form button[type=submit]').first().click();
await signedIn;
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'แผนสหกิจ', exact: true }).first().click();
await page.getByRole('button', { name: /ดูรายละเอียด/ }).first().waitFor({ timeout: 20000 });
await page.getByRole('button', { name: /ดูรายละเอียด/ }).first().click();
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /^ยื่นแผน/ }).first().click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'ยืนยันยื่นแผน' }).click();
await page.waitForResponse((r) => r.url().endsWith('/submit'), { timeout: 20000 }).catch(() => null);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/${prefix}.png` });

const shown = await page.locator('section ul li').allInnerTexts();
await browser.close();

const codes = (refusal?.body?.failures ?? []).map((f) => f.code);
const notThai = shown.filter((text) => !/[ก-๙]/.test(text) || /[A-Z]{3,}_[A-Z_]+/.test(text) || /required courses missing/i.test(text));
console.table(shown.map((text, i) => ({ apiCode: codes[i] ?? '?', onScreen: text })));

const ok = refusal?.status === 400 && shown.length > 0 && shown.length === codes.length && notThai.length === 0;
console.log(ok ? 'ok: every reason is shown in Thai' : 'FAILED: the dialog is missing a reason or shows English / a code name');
process.exitCode = ok ? 0 : 1;
