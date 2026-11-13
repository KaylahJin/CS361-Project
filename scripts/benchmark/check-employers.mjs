import { chromium } from 'playwright';

const url =
  'http://aa-coop-web-617500348719.s3-website-us-east-1.amazonaws.com/#employers';

const browser = await chromium.launch({
  headless: true,
  executablePath:
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
});

try {
  const page = await browser.newPage();
  const apiResponses = [];

  page.on('response', (response) => {
    if (response.url().includes('/companies')) {
      apiResponses.push(response.status());
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

  console.log('Browser launched: PASS');
  console.log('Employers page: PASS');
  console.log('Company cards:', await page.locator('article').count());
  console.log('API responses:', apiResponses);

} catch (error) {
  console.error('Browser test: FAILED');
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
