
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const commitArg = process.argv.find((arg) =>
  arg.startsWith('--commit='),
);

const COMMIT_SHA = (
  commitArg?.slice('--commit='.length) ||
  process.env.BENCHMARK_COMMIT_SHA ||
  execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
).trim();

if (!COMMIT_SHA) {
  throw new Error('Commit SHA cannot be empty.');
}

const urlArg = process.argv.find((arg) =>
  arg.startsWith('--url='),
);

const BENCHMARK_URL = (
  urlArg?.slice('--url='.length) ||
  process.env.BENCHMARK_URL ||
  ''
).trim();

if (!BENCHMARK_URL) {
  throw new Error(
    'Benchmark URL is required. Use --url= or BENCHMARK_URL.',
  );
}

try {
  const parsedUrl = new URL(BENCHMARK_URL);

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Unsupported protocol.');
  }
} catch {
  throw new Error(
    `Invalid benchmark URL: ${BENCHMARK_URL}. Use HTTP or HTTPS.`,
  );
}

const networkArg = process.argv.find((arg) =>
  arg.startsWith('--network='),
);

const BENCHMARK_NETWORK = (
  networkArg?.slice('--network='.length) ||
  process.env.BENCHMARK_NETWORK ||
  'Unknown'
).trim();

const CONFIG = {
  region: 'us-east-1',
  environment: 'Cloud/Dev',
  client: 'Microsoft Edge 157.0.4341.46 (Playwright 1.65.0)',
  expectedRows: {
    S1: 103,
    S2: 1,
    S3: 79,
    S4: 1,
  },
};

const DEFAULT_OUTPUT_DIR = 'docs/evidence/v6-01-employers-baseline';

const outputDirArg = process.argv.find((arg) => arg.startsWith('--out='));

const OUTPUT_DIR = outputDirArg
  ? outputDirArg.slice('--out='.length).trim()
  : DEFAULT_OUTPUT_DIR;

if (!OUTPUT_DIR) {
  throw new Error('Output directory cannot be empty.');
}

const OUTPUT_FILES = {
  warmup: {
    raw: path.join(OUTPUT_DIR, 'warmup-raw-results.csv'),
    summary: path.join(OUTPUT_DIR, 'warmup-run-summary.csv'),
  },
  measurement: {
    raw: path.join(OUTPUT_DIR, 'measurement-raw-results.csv'),
    summary: path.join(OUTPUT_DIR, 'measurement-run-summary.csv'),
  },
};

function getOutputFiles(runType) {
  const files = OUTPUT_FILES[runType];

  if (!files) {
    throw new Error(`Invalid run type: ${runType}`);
  }

  return files;
}

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

function appendCsv(file, headers, values) {
  const isNewFile = !fs.existsSync(file) || fs.statSync(file).size === 0;

  if (isNewFile) {
    fs.appendFileSync(file, `${headers.map(csv).join(',')}\n`);
  }

  fs.appendFileSync(file, `${values.map(csv).join(',')}\n`);
}

function hasMeasurementRun(scenario, runNumber) {
  const summaryFile = OUTPUT_FILES.measurement.summary;

  if (!fs.existsSync(summaryFile)) return false;

  const prefix = [
    csv(scenario),
    csv('measurement'),
    csv(runNumber),
  ].join(',');

  return fs
    .readFileSync(summaryFile, 'utf8')
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
  predicate = () => true
) {
  const responses = [];

  let resolveResponses;
  let rejectResponses;
  let quietTimer;
  let actionCompleted = false;
  let settled = false;

  const responsePromise = new Promise((resolve, reject) => {
    resolveResponses = resolve;
    rejectResponses = reject;
  });

  const timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    rejectResponses(
      new Error('Timed out waiting for companies responses.')
    );
  }, 30000);

  function scheduleQuietPeriod() {
    if (!actionCompleted || responses.length === 0 || settled) {
      return;
    }

    clearTimeout(quietTimer);

    quietTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolveResponses(responses);
    }, 500);
  }

  const listener = (response) => {
    if (settled || !isCompaniesResponse(response)) return;

    const url = new URL(response.url());

    if (!predicate(url)) return;

    const detailsPromise = getResponseDetails(response).then(
      (details) => ({ details }),
      (error) => ({ error })
    );

    responses.push(detailsPromise);
    scheduleQuietPeriod();
  };

  page.on('response', listener);

  const startTime = performance.now();

  try {
    await action();

    const actionEndTime = performance.now();

    actionCompleted = true;
    scheduleQuietPeriod();

    const collected = await responsePromise;
    const results = await Promise.all(collected);

    const failedResult = results.find((result) => result.error);

    if (failedResult) {
      throw failedResult.error;
    }

    return {
      responses: results.map((result) => result.details),
      startTime,
      actionEndTime,
    };
  } finally {
    settled = true;
    clearTimeout(timeout);
    clearTimeout(quietTimer);
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
    async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole(searchInput.role, {
        name: searchInput.name,
      }).waitFor();
      await waitForCards(page, 103);
    },
    (url) =>
      !url.searchParams.has('search') &&
      !url.searchParams.has('province')
  );

  const invalidResponse =
    initial.responses.length === 0 ||
    initial.responses.some(
      (response) => response.status !== 200 || response.rows !== 103
    );

  if (invalidResponse) {
    throw new Error(
      'Page reset failed: expected successful unfiltered responses with 103 rows.'
    );
  }
}

async function recordRun(page, scenario, runType, runNumber) {
  const outputFiles = getOutputFiles(runType);
  let result;

  if (scenario === 'S1') {
    result = await collectResponses(
      page,
      async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForCards(page, CONFIG.expectedRows.S1);
      }
    );
  }

  if (scenario === 'S2') {
    await resetPage(page);

    result = await collectResponses(
      page,
      async () => {
        await page.getByRole(searchInput.role, {
          name: searchInput.name,
        }).fill('CDG');

        await waitForCards(page, CONFIG.expectedRows.S2);
      }
    );
  }

  if (scenario === 'S3') {
    await resetPage(page);

    result = await collectResponses(
      page,
      async () => {
        await page.getByRole(provinceSelect.role, {
          name: provinceSelect.name,
        }).selectOption({ value: 'กรุงเทพมหานคร' });

        await waitForCards(page, CONFIG.expectedRows.S3);
      }
    );
  }

  if (scenario === 'S4') {
    await resetPage(page);

    // Set the province as a precondition, not part of the measured action.
    const setup = await collectResponses(
      page,
      async () => {
        await page.getByRole(provinceSelect.role, {
          name: provinceSelect.name,
        }).selectOption({ value: 'กรุงเทพมหานคร' });

        await waitForCards(page, 79);
      }
    );

    const invalidSetup =
      setup.responses.length === 0 ||
      setup.responses.some(
        (response) => response.status !== 200 || response.rows !== 79
      );

    if (invalidSetup) {
      throw new Error(
        'S4 province setup failed. Expected successful responses with 79 rows.'
      );
    }

    result = await collectResponses(
      page,
      async () => {
        await page.getByRole(searchInput.role, {
          name: searchInput.name,
        }).fill('CDG');

        await waitForCards(page, CONFIG.expectedRows.S4);
      }
    );
  }

  const scenarioE2e = result.actionEndTime - result.startTime;

  const details = result.responses;

  const allSuccessful =
    details.length > 0 &&
    details.every((item) => item.status === 200);
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

    appendCsv(outputFiles.raw, [
      'scenario',
      'run_type',
      'run_number',
      'response_number',
      'timestamp',
      'environment',
      'commit_sha',
      'region',
      'client',
      'network',
      'search',
      'province',
      'http_status',
      'api_duration_ms',
      'response_bytes',
      'response_rows',
      'note',
    ], [
      scenario,
      runType,
      runNumber,
      index + 1,
      item.timestamp,
      CONFIG.environment,
      COMMIT_SHA,
      CONFIG.region,
      CONFIG.client,
      BENCHMARK_NETWORK,
      item.search,
      item.province,
      item.status,
      item.duration,
      item.bytes,
      item.rows,
      'Automated Playwright run',
    ]);
  }

  appendCsv(outputFiles.summary, [
    'scenario',
    'run_type',
    'run_number',
    'timestamp',
    'environment',
    'commit_sha',
    'region',
    'client',
    'network',
    'request_count',
    'e2e_duration_ms',
    'note',
  ], [
    scenario,
    runType,
    runNumber,
    new Date().toISOString(),
    CONFIG.environment,
    COMMIT_SHA,
    CONFIG.region,
    CONFIG.client,
    BENCHMARK_NETWORK,
    details.length,
    scenarioE2e.toFixed(2),
    'Automated Playwright run',
  ]);

  console.log(
    `${scenario} ${runType} ${runNumber}: PASS | ` +
    `Requests: ${details.length} | ` +
    `E2E: ${scenarioE2e.toFixed(2)} ms`
  );
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
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

    await page.goto(BENCHMARK_URL, {
      waitUntil: 'domcontentloaded',
    });
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
