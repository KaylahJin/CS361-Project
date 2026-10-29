// Evidence for #141: what each role sees on the deployed site.
//
// Signs in as each test account in a real Chrome, on the live S3 site, and
// saves a screenshot of the plans page, the student page (or the page without
// the Students tab), and for reviewers the review form. Desktop 1280x800 and
// mobile 390x844. Nothing is submitted; the review form is opened and closed.
//
//   npm i --no-save playwright-core
//   EVIDENCE_SITE_URL=http://<bucket>.s3-website-us-east-1.amazonaws.com \
//   COOP_TEST_PASSWORD=... \
//   node docs/evidence/scripts/141-capture-role-screens.mjs <file-prefix> [roles]
//
//   file-prefix  e.g. 141-03  ->  docs/evidence/141-03-<role>-<size>-<shot>.png
//   roles        comma list of student,advisor,staff,admin (default: all four)
//
// To photograph the "plan is waiting for review" state, set the plan to
// SUBMITTED first and put it back afterwards:
//   psql ... -f docs/evidence/scripts/141-set-plan-status.sql -v status=SUBMITTED
//   psql ... -f docs/evidence/scripts/141-set-plan-status.sql -v status=PREPARING
//
// Env: EVIDENCE_OUT (default docs/evidence), CHROME_PATH (default: the usual
// Chrome / Edge install on Windows, macOS and Linux).

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const SITE = process.env.EVIDENCE_SITE_URL;
const PASSWORD = process.env.COOP_TEST_PASSWORD;
const OUT = process.env.EVIDENCE_OUT || 'docs/evidence';
const [prefix, rolesArg] = process.argv.slice(2);

if (!SITE || !PASSWORD || !prefix) {
  console.error('usage: EVIDENCE_SITE_URL=... COOP_TEST_PASSWORD=... node 141-capture-role-screens.mjs <file-prefix> [roles]');
  process.exit(2);
}

const ALL_ROLES = { student: 'student1', advisor: 'advisor1', staff: 'staff1', admin: 'admin1' };
const roles = (rolesArg ? rolesArg.split(',') : Object.keys(ALL_ROLES)).map((r) => [r, ALL_ROLES[r]]);
const SIZES = [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 390, height: 844 }],
];

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => p && existsSync(p));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const visible = (locator) => locator.first().isVisible().catch(() => false);

// On mobile the tabs sit in a drawer that has to be opened first.
async function openMenuIfNeeded(page, size, target) {
  if (size !== 'mobile' || (await visible(target))) return;
  const menu = page.getByRole('button', { name: 'เปิดเมนู' });
  if (await visible(menu)) {
    await menu.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

async function goTab(page, size, label) {
  const tab = page.getByRole('button', { name: label, exact: true });
  await openMenuIfNeeded(page, size, tab);
  if (!(await visible(tab))) return false;
  await tab.first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  return true;
}

async function hasTab(page, size, label) {
  const tab = page.getByRole('button', { name: label, exact: true });
  await openMenuIfNeeded(page, size, tab);
  return visible(tab);
}

const report = [];
for (const [size, viewport] of SIZES) {
  for (const [role, user] of roles) {
    const context = await browser.newContext({ viewport, locale: 'th-TH' });
    const page = await context.newPage();
    const file = (shot) => `${OUT}/${prefix}-${role}-${size}-${shot}.png`;
    const row = { role, size };
    try {
      await page.goto(SITE, { waitUntil: 'networkidle' });
      await goTab(page, size, 'เข้าสู่ระบบ');
      await page.locator('input[type=email]').fill(`${user}@example.com`);
      await page.locator('input[type=password]').fill(PASSWORD);
      const me = page.waitForResponse((r) => r.url().endsWith('/me'), { timeout: 20000 }).catch(() => null);
      await page.locator('form button[type=submit]').first().click();
      const meResponse = await me;
      row.meStatus = meResponse?.status() ?? null;
      row.meRole = meResponse ? (await meResponse.json().catch(() => null))?.role ?? null : null;
      await page.waitForTimeout(1500);

      await goTab(page, size, 'แผนสหกิจ');
      await page.screenshot({ path: file('plans'), fullPage: true });
      row.reviewButtons = await page.getByRole('button', { name: /ตรวจแผน/ }).count();

      row.studentsTab = await hasTab(page, size, 'นักศึกษา');
      if (size === 'mobile') await page.screenshot({ path: file('menu') });
      if (row.studentsTab) {
        await goTab(page, size, 'นักศึกษา');
        await page.screenshot({ path: file('students'), fullPage: true });
      } else if (size === 'desktop') {
        await page.screenshot({ path: file('no-students-tab') });
      }

      // Reviewers: open the form, do not save a decision.
      if (size === 'desktop' && row.reviewButtons > 0) {
        await goTab(page, size, 'แผนสหกิจ');
        await page.getByRole('button', { name: /ตรวจแผน/ }).first().click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: file('review-form') });
        row.reviewForm = await page.getByRole('dialog').count();
      }

      // Student: open own plan, which must be read-only.
      if (role === 'student' && size === 'desktop') {
        await goTab(page, size, 'แผนสหกิจ');
        const open = page.getByRole('button', { name: /ดูรายละเอียด/ }).first();
        if (await visible(open)) {
          await open.click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: file('plan-detail-readonly'), fullPage: true });
        }
        row.reviewActionInDetail = await page.getByRole('button', { name: /ตรวจพิจารณาแผน|ตรวจแผน/ }).count();
      }
    } catch (err) {
      row.error = String(err).slice(0, 160);
    }
    report.push(row);
    await context.close();
  }
}

await browser.close();
console.table(report);
process.exitCode = report.some((r) => r.error || r.meStatus !== 200) ? 1 : 0;
