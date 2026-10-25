// Evidence for #139: log in from the plans page and see the plans right away.
//
// In a real Chrome on the live site: open the site signed out, go to the plans
// tab, sign in on the form that page shows, and record what happens. Saves
// screenshots (desktop and mobile), the API calls the page made, and a screen
// recording as MP4 and GIF. The recording is a run of full-page frames taken
// while the flow runs and joined with the ffmpeg on PATH, so Playwright's own
// browser downloads are not needed.
//
// Passing means: after sign-in no sign-in form is left, the plans heading is
// shown, and GET /coop-plans was answered 200 after the sign-in. Before the
// fix the only GET /coop-plans was a 401 sent without a token.
//
//   npm i --no-save playwright-core
//   EVIDENCE_SITE_URL=http://<bucket>.s3-website-us-east-1.amazonaws.com \
//   COOP_TEST_PASSWORD=... \
//   node scripts/evidence/139-capture-login-from-plans.mjs <file-prefix>
//
//   file-prefix  e.g. 139-07 -> docs/evidence/139-07-<size>-<shot>.png
//                               docs/evidence/139-07-login-from-plans-page.mp4/.gif
//
// Env: EVIDENCE_OUT (default docs/evidence), CHROME_PATH.

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SITE = process.env.EVIDENCE_SITE_URL;
const PASSWORD = process.env.COOP_TEST_PASSWORD;
const OUT = process.env.EVIDENCE_OUT || 'docs/evidence';
const prefix = process.argv[2];

if (!SITE || !PASSWORD || !prefix) {
  console.error('usage: EVIDENCE_SITE_URL=... COOP_TEST_PASSWORD=... node 139-capture-login-from-plans.mjs <file-prefix>');
  process.exit(2);
}

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => p && existsSync(p));

const SIZES = [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 390, height: 844 }],
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const report = [];

for (const [size, viewport] of SIZES) {
  const framesDir = `${OUT}/.frames-${size}`;
  const context = await browser.newContext({ viewport, locale: 'th-TH' });
  const page = await context.newPage();

  // Only the desktop run is recorded: steady full-page frames, no zoom.
  let frame = 0;
  let recording = size === 'desktop';
  if (recording) mkdirSync(framesDir, { recursive: true });
  const recorder = (async () => {
    while (recording) {
      await page
        .screenshot({ path: `${framesDir}/f${String(frame++).padStart(4, '0')}.png` })
        .catch(() => {});
      await page.waitForTimeout(150);
    }
  })();
  const calls = [];
  page.on('response', (r) => {
    const path = new URL(r.url()).pathname;
    if (/^\/(coop-plans|me)$/.test(path)) calls.push(`${r.request().method()} ${path} ${r.status()}`);
  });

  await page.goto(SITE, { waitUntil: 'networkidle' });
  if (size === 'mobile') await page.getByRole('button', { name: 'เปิดเมนู' }).click();
  await page.getByRole('button', { name: 'แผนสหกิจ', exact: true }).first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/${prefix}-${size}-1-signed-out-plans-page.png` });

  await page.locator('input[type=email]').fill('student1@example.com');
  await page.waitForTimeout(600);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${prefix}-${size}-2-form-filled.png` });

  await page.locator('form button[type=submit]').first().click();
  await page.waitForResponse((r) => r.url().endsWith('/coop-plans') && r.status() === 200, { timeout: 20000 }).catch(() => null);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/${prefix}-${size}-3-after-login.png`, fullPage: true });

  const afterLogin = {
    size,
    signInFormLeft: await page.locator('input[type=password]').count(),
    plansHeading: await page.getByText('รายการคำร้องแผนสหกิจศึกษา').count(),
    plansLoaded: calls.includes('GET /coop-plans 200'),
    calls: calls.join(', '),
  };
  report.push(afterLogin);

  recording = false;
  await recorder;
  await context.close();

  if (size === 'desktop') {
    const mp4 = `${OUT}/${prefix}-login-from-plans-page.mp4`;
    const gif = `${OUT}/${prefix}-login-from-plans-page.gif`;
    const input = ['-y', '-loglevel', 'error', '-framerate', '5', '-i', `${framesDir}/f%04d.png`];
    try {
      // Same settings the other role demos use: libx264, yuv420p, faststart.
      execFileSync('ffmpeg', [...input, '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
      execFileSync('ffmpeg', [...input, '-vf', 'scale=800:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', gif]);
    } catch {
      console.error('ffmpeg is not on PATH: the frames stay in', framesDir);
      continue;
    }
    rmSync(framesDir, { recursive: true, force: true });
  }
}

await browser.close();
console.table(report);
process.exitCode = report.every((r) => r.signInFormLeft === 0 && r.plansHeading > 0 && r.plansLoaded) ? 0 : 1;
