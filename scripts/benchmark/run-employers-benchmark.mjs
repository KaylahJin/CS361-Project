
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const CONFIG = {
  url: 'http://aa-coop-web-617500348719.s3-website-us-east-1.amazonaws.com/#employers',
  commitSha: '0ae16a57576f065b89f016bc179bd366b019110f',
  region: 'us-east-1',
  environment: 'Cloud/Dev',
  client: 'Microsoft Edge 157.0.4341.46 (Playwright 1.65.0)',
  network: 'Mobile Hotspot',
  expectedRows: {
    S1: 103,
    S2: 1,
    S3: 79,
    S4: 1,
  },
};

const OUTPUT_DIR = 'docs/evidence/v6-01-employers-baseline';
const RAW_FILE = path.join(OUTPUT_DIR, 'measurement-raw-results.csv');
const SUMMARY_FILE = path.join(OUTPUT_DIR, 'measurement-run-summary.csv');

const warmupRuns = Number(
  process.argv.find((arg) => arg.startsWith('--warmup='))?.split('=')[1] ?? 0
);
const measurementRuns = Number(
  process.argv.find((arg) => arg.startsWith('--runs='))?.split('=')[1] ?? 1
);

const startRun = Number(
  process.argv.find((arg) => arg.startsWith('--start-run='))?.split('=')[1] ?? 1
);

const allScenarios = ['S1', 'S2', 'S3', 'S4'];

const scenariosArg = process.argv
  .find((arg) => arg.startsWith('--scenarios='))
  ?.split('=')[1];

const selectedScenarios = scenariosArg
  ? scenariosArg.split(',').map((scenario) => scenario.trim())
  : allScenarios;



if (
  !Number.isInteger(warmupRuns) ||
  !Number.isInteger(measurementRuns) ||
  !Number.isInteger(startRun) ||
  warmupRuns < 0 ||
  measurementRuns < 0 ||
  startRun < 1 ||
  (warmupRuns === 0 && measurementRuns === 0) ||
  selectedScenarios.length === 0 ||
  selectedScenarios.some((scenario) => !allScenarios.includes(scenario)) ||
  new Set(selectedScenarios).size !== selectedScenarios.length
) {
  throw new Error('Invalid run configuration.');
}


const searchInput = {
  role: 'textbox',
  name: 'ค้นหาด้วยชื่อสถานประกอบการ',
};

const provinceSelect = {
  role: 'combobox',
  name: 'กรองตามจังหวัด',
};

function csv(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function appendCsv(file, values) {
  fs.appendFileSync(file, `${values.map(csv).join(',')}\n`);
}


function hasMeasurementRun(scenario, runNumber) {
  if (!fs.existsSync(SUMMARY_FILE)) return false;

  const prefix = [
    csv(scenario),
    csv('measurement'),
    csv(runNumber),
  ].join(',');

  return fs
    .readFileSync(SUMMARY_FILE, 'utf8')
    .split(/\r?\n/)
    .some((line) => line.startsWith(`${prefix},`));
}


function isCompaniesResponse(response) {
  try {
    return new URL(response.url()).pathname.endsWith('/companies');
  } catch {
    return false;
  }
}

function extractRows(data) {
  if (Array.isArray(data)) return data.length;

  if (data && typeof data === 'object') {
    for (const key of ['companies', 'data', 'items', 'results']) {
      if (Array.isArray(data[key])) return data[key].length;
    }
  }

  return '';
}


async function collectResponses(
  page,
  action,
  expectedCount,
  predicate = () => true
) {
  const responses = [];

  let resolveResponses;
  let rejectResponses;

  const responsePromise = new Promise((resolve, reject) => {
    resolveResponses = resolve;
    rejectResponses = reject;
  });

  const timeout = setTimeout(() => {
    rejectResponses(
      new Error(`Timed out waiting for ${expectedCount} companies response(s).`)
    );
  }, 30000);

  const listener = (response) => {
    if (!isCompaniesResponse(response)) return;

    const url = new URL(response.url());

    // Collect only responses that match the supplied condition.
    if (!predicate(url)) return;

    // Start reading the response body immediately.
    const detailsPromise = getResponseDetails(response).then(
      (details) => ({ details }),
      (error) => ({ error })
    );

    responses.push(detailsPromise);

    if (responses.length === expectedCount) {
      clearTimeout(timeout);
      resolveResponses(responses);
    }
  };

  page.on('response', listener);

  const startTime = performance.now();

  try {
    await action();

    const collected = await responsePromise;
    const results = await Promise.all(collected);

    const failedResult = results.find((result) => result.error);

    if (failedResult) {
      throw failedResult.error;
    }

    return {
      responses: results.map((result) => result.details),
      startTime,
    };
  } finally {
    clearTimeout(timeout);
    page.off('response', listener);
  }
}

async function getResponseDetails(response) {
  const body = await response.body();

  let responseRows = '';

  try {
    responseRows = extractRows(JSON.parse(body.toString('utf8')));
  } catch {
    responseRows = '';
  }

  const timing = response.request().timing();

    const duration =
    timing.responseEnd >= 0
        ? timing.responseEnd
        : '';

  const url = new URL(response.url());

  return {
    timestamp: new Date().toISOString(),
    status: response.status(),
    duration,
    bytes: body.length,
    rows: responseRows,
    search: url.searchParams.get('search') ?? '',
    province: url.searchParams.get('province') ?? '',
  };
}

async function waitForCards(page, expectedRows) {
  await page.waitForFunction(
    (expected) => document.querySelectorAll('article').length === expected,
    expectedRows,
    { timeout: 30000 }
  );
}


async function resetPage(page) {
  const initial = await collectResponses(
    page,
    () => page.reload({ waitUntil: 'domcontentloaded' }),
    2,
    (url) =>
      !url.searchParams.has('search') &&
      !url.searchParams.has('province')
  );

  await page.getByRole(searchInput.role, {
    name: searchInput.name,
  }).waitFor();

  await waitForCards(page, 103);

  const invalidResponse = initial.responses.some(
    (response) => response.status !== 200 || response.rows !== 103
  );

  if (invalidResponse) {
    throw new Error(
      'Page reset failed: expected two successful unfiltered responses with 103 rows.'
    );
  }
}

async function recordRun(page, scenario, runType, runNumber) {
  let result;
  let expectedRequestCount;

  if (scenario === 'S1') {
    result = await collectResponses(
      page,
      () => page.reload({ waitUntil: 'domcontentloaded' }),
      2
    );

    await waitForCards(page, CONFIG.expectedRows.S1);
    expectedRequestCount = 2;
  }

  if (scenario === 'S2') {
    await resetPage(page);

    result = await collectResponses(
      page,
      () => page.getByRole(searchInput.role, {
        name: searchInput.name,
      }).fill('CDG'),
      1
    );

    await waitForCards(page, CONFIG.expectedRows.S2);
    expectedRequestCount = 1;
  }

  if (scenario === 'S3') {
    await resetPage(page);

    result = await collectResponses(
      page,
      () => page.getByRole(provinceSelect.role, {
        name: provinceSelect.name,
      }).selectOption({ value: 'กรุงเทพมหานคร' }),
      1
    );

    await waitForCards(page, CONFIG.expectedRows.S3);
    expectedRequestCount = 1;
  }

  if (scenario === 'S4') {
    await resetPage(page);

    // Set the province as a precondition, not part of the measured action.
    const setup = await collectResponses(
      page,
      () => page.getByRole(provinceSelect.role, {
        name: provinceSelect.name,
      }).selectOption({ value: 'กรุงเทพมหานคร' }),
      1
    );

    await waitForCards(page, 79);

    const setupDetails = setup.responses[0];

    if (setupDetails.status !== 200 || setupDetails.rows !== 79) {
    throw new Error('S4 province setup failed. Expected HTTP 200 and 79 rows.');
    }

    result = await collectResponses(
      page,
      () => page.getByRole(searchInput.role, {
        name: searchInput.name,
      }).fill('CDG'),
      1
    );

    await waitForCards(page, CONFIG.expectedRows.S4);
    expectedRequestCount = 1;
  }

  const scenarioE2e = performance.now() - result.startTime;

  const details = result.responses;

  const allSuccessful = details.every((item) => item.status === 200);
  const allExpectedRows = details.every(
    (item) => item.rows === CONFIG.expectedRows[scenario]
  );

  console.log(`${scenario} response details:`, details);

  if (!allSuccessful || !allExpectedRows) {
    throw new Error(
      `${scenario} validation failed. Check HTTP status and response rows.`
    );
  }

  for (let index = 0; index < details.length; index += 1) {
    const item = details[index];

    appendCsv(RAW_FILE, [
      scenario,
      runType,
      runNumber,
      index + 1,
      item.timestamp,
      CONFIG.environment,
      CONFIG.commitSha,
      CONFIG.region,
      CONFIG.client,
      CONFIG.network,
      item.search,
      item.province,
      item.status,
      item.duration,
      item.bytes,
      item.rows,
      'Automated Playwright run',
    ]);
  }

  appendCsv(SUMMARY_FILE, [
    scenario,
    runType,
    runNumber,
    new Date().toISOString(),
    CONFIG.environment,
    CONFIG.commitSha,
    CONFIG.region,
    CONFIG.client,
    CONFIG.network,
    expectedRequestCount,
    scenarioE2e.toFixed(2),
    'Automated Playwright run',
  ]);

  console.log(
    `${scenario} ${runType} ${runNumber}: PASS | ` +
    `Requests: ${expectedRequestCount} | ` +
    `E2E: ${scenarioE2e.toFixed(2)} ms`
  );
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath:
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Disable browser cache for more consistent request measurements.
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', {
      cacheDisabled: true,
    });

    await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded' });
    await page.getByRole(searchInput.role, {
      name: searchInput.name,
    }).waitFor();

    await waitForCards(page, 103);


    for (const scenario of selectedScenarios) {
    // Warm-up runs
    for (let run = 1; run <= warmupRuns; run += 1) {
        await recordRun(page, scenario, 'warmup', run);
    }

    // Measurement runs with configurable starting run number
    for (
        let run = startRun;
        run < startRun + measurementRuns;
        run += 1
    ) {
        if (hasMeasurementRun(scenario, run)) {
        throw new Error(
            `Duplicate measurement run detected: ${scenario} Run ${run}.`
        );
        }

        await recordRun(page, scenario, 'measurement', run);
    }
    }

    console.log(`Selected scenarios: ${selectedScenarios.join(', ')}`);
    console.log(`Warm-up runs per scenario: ${warmupRuns}`);
    console.log(`Measurement runs per scenario: ${measurementRuns}`);
    console.log(`Starting run number: ${startRun}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('\nBenchmark failed:', error);
  process.exitCode = 1;
});
