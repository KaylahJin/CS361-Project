import { chromium } from 'playwright';

const urlArg = process.argv.find((arg) => arg.startsWith('--url='));

const url = (
  urlArg?.slice('--url='.length) ||
  process.env.BENCHMARK_URL ||
  ''
).trim();

if (!url) {
  throw new Error(
    'Benchmark URL is required. Use --url= or BENCHMARK_URL.'
  );
}

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
});

const apiResponses = [];

try {
  const page = await browser.newPage();

  page.on('response', (response) => {
    try {
      const pathname = new URL(response.url()).pathname;

      if (pathname.endsWith('/companies')) {
        apiResponses.push(response.status());
      }
    } catch {
      // Ignore invalid response URLs.
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });

  await page.getByRole('textbox', {
    name: 'ค้นหาด้วยชื่อสถานประกอบการ',
  }).waitFor();

  await page.waitForFunction(
    () => document.querySelectorAll('article').length === 103,
    null,
    { timeout: 30000 }
  );

  if (
    apiResponses.length === 0 ||
    apiResponses.some((status) => status !== 200)
  ) {
    throw new Error(
      `Unexpected API responses: ${apiResponses.join(', ')}`
    );
  }

  console.log('Browser launched: PASS');
  console.log('Employers page: PASS');
  console.log('Company cards:', await page.locator('article').count());
  console.log('API responses:', apiResponses);
} catch (error) {
  console.error('Browser test: FAILED');
  console.error('API responses:', apiResponses);
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
