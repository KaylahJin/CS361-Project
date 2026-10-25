// Evidence for #142: the review button on the plan page and the review history.
//
// In a real Chrome on the live site, as staff1: open a plan from the list (a row
// click, which is the plan page, not the list's own "ตรวจแผน" button), press
// "ตรวจพิจารณาแผน", check the comment box starts empty, record a decision, and
// open the plan again to show the history. Saves screenshots plus a screen
// recording as GIF and MP4 (frames joined with the ffmpeg on PATH).
//
// This WRITES a real review (a row in plan_reviews, and the plan's status
// changes). Use it on the lab database and reset afterwards:
//   psql ... -v plan=<id> -f docs/evidence/scripts/142-reset-plan.sql
// For a history with two entries, put the plan back to SUBMITTED between runs:
//   psql ... -v plan=<id> -v status=SUBMITTED -f docs/evidence/scripts/142-set-plan-status.sql
//
//   npm i --no-save playwright-core
//   EVIDENCE_SITE_URL=http://<bucket>.s3-website-us-east-1.amazonaws.com \
//   COOP_TEST_PASSWORD=... \
//   node docs/evidence/scripts/142-capture-review-history.mjs <file-prefix> <student-id> <decision> "<comment>"
//
//   decision  APPROVED, RETURNED or REJECTED (RETURNED and REJECTED need a comment)
//
// Exit code 1 when the comment box did not start empty, the review was not
// saved, or the history does not list the decision just made first.
// Env: EVIDENCE_OUT (default docs/evidence), CHROME_PATH.

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SITE = process.env.EVIDENCE_SITE_URL;
const PASSWORD = process.env.COOP_TEST_PASSWORD;
const OUT = process.env.EVIDENCE_OUT || 'docs/evidence';
const [prefix, studentId, decision, comment] = process.argv.slice(2);
const RADIO = { APPROVED: 'approved', RETURNED: 'returned', REJECTED: 'rejected' }[decision];
const LABEL = { APPROVED: 'อนุมัติ', RETURNED: 'ส่งกลับให้แก้ไข', REJECTED: 'ไม่อนุมัติ' }[decision];

if (!SITE || !PASSWORD || !prefix || !studentId || !RADIO || (decision !== 'APPROVED' && !comment)) {
  console.error(
    'usage: EVIDENCE_SITE_URL=... COOP_TEST_PASSWORD=... node 142-capture-review-history.mjs <file-prefix> <student-id> <decision> "<comment>"',
  );
  process.exit(2);
}

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => p && existsSync(p));

mkdirSync(OUT, { recursive: true });
const framesDir = `${OUT}/.frames-${prefix}`;
mkdirSync(framesDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'th-TH' });
const page = await context.newPage();

// Steady full-page frames while the flow runs, joined into the recording below.
let frame = 0;
let recording = true;
const recorder = (async () => {
  while (recording) {
    await page.screenshot({ path: `${framesDir}/f${String(frame++).padStart(4, '0')}.png` }).catch(() => {});
    await page.waitForTimeout(150);
  }
})();

const checks = {};
let saved = null;
page.on('response', (r) => {
  if (r.url().endsWith('/review') && r.request().method() === 'POST') saved = r.status();
});

await page.goto(SITE, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).first().click();
await page.locator('input[type=email]').fill('staff1@example.com');
await page.locator('input[type=password]').fill(PASSWORD);
const signedIn = page.waitForResponse((r) => r.url().endsWith('/me'), { timeout: 20000 });
await page.locator('form button[type=submit]').first().click();
await signedIn;
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'แผนสหกิจ', exact: true }).first().click();

// Open the plan page by clicking the student's row.
await page.getByText(studentId, { exact: true }).first().waitFor({ timeout: 20000 });
await page.getByText(studentId, { exact: true }).first().click();
await page.getByRole('button', { name: 'ตรวจพิจารณาแผน' }).waitFor({ timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/${prefix}-1-plan-page-review-button.png`, fullPage: true });

// The review button on the plan page opens the form.
await page.getByRole('button', { name: 'ตรวจพิจารณาแผน' }).click();
await page.getByRole('dialog').waitFor({ timeout: 10000 });
await page.waitForTimeout(800);
checks.commentStartsEmpty = (await page.getByRole('dialog').getByRole('textbox').inputValue()) === '';
await page.screenshot({ path: `${OUT}/${prefix}-2-review-form-comment-empty.png` });

// Record the decision.
await page.locator(`#label-decision-${RADIO}`).click();
if (comment) await page.getByRole('dialog').getByRole('textbox').fill(comment);
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/${prefix}-3-decision-filled.png` });
await page.getByRole('dialog').locator('button[type=submit]').click();
await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);
checks.saved = saved === 200;

// Open the plan again: the history lists this decision first.
await page.getByText(studentId, { exact: true }).first().click();
await page.getByRole('list', { name: 'ประวัติการพิจารณา' }).first().waitFor({ timeout: 20000 });
await page.waitForTimeout(800);
const history = await page
  .getByRole('list', { name: 'ประวัติการพิจารณา' })
  .first()
  .getByRole('listitem')
  .allInnerTexts();
checks.historyEntries = history.length;
checks.newestFirst = history[0]?.includes(LABEL) ?? false;
await page.screenshot({ path: `${OUT}/${prefix}-4-plan-page-history.png`, fullPage: true });

recording = false;
await recorder;
await browser.close();

const input = ['-y', '-loglevel', 'error', '-framerate', '5', '-i', `${framesDir}/f%04d.png`];
try {
  execFileSync('ffmpeg', [
    ...input,
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    `${OUT}/${prefix}-review-button.mp4`,
  ]);
  execFileSync('ffmpeg', [
    ...input,
    '-vf', 'scale=800:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse',
    `${OUT}/${prefix}-review-button.gif`,
  ]);
  rmSync(framesDir, { recursive: true, force: true });
} catch {
  console.error('ffmpeg is not on PATH: the frames stay in', framesDir);
}

console.log({ ...checks, history });
process.exitCode = checks.commentStartsEmpty && checks.saved && checks.newestFirst ? 0 : 1;
