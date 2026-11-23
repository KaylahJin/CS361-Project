
import fs from 'node:fs';

const DEFAULT_OUTPUT_DIR = 'docs/evidence/v6-01-employers-baseline';

const outputDirArg = process.argv.find((arg) =>
  arg.startsWith('--out=')
);

const OUTPUT_DIR = (
  outputDirArg !== undefined
    ? outputDirArg.slice('--out='.length)
    : process.env.BENCHMARK_OUTPUT_DIR || DEFAULT_OUTPUT_DIR
).trim();

if (!OUTPUT_DIR) {
  throw new Error('Output directory cannot be empty.');
}

const SUMMARY_FILE = `${OUTPUT_DIR}/measurement-run-summary.csv`;
const RAW_FILE = `${OUTPUT_DIR}/measurement-raw-results.csv`;

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }

  fields.push(field);
  return fields;
}

function readCsv(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseCsvLine);
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;

  return sorted[lower] +
    (sorted[upper] - sorted[lower]) * fraction;
}

function printStatistics(label, values, expectedCount) {
  const count = values.length;

  if (count === 0) {
    console.log(`${label}: NO DATA`);
    return;
  }

  if (count !== expectedCount) {
    console.log(
      `${label}: WARNING - expected ${expectedCount}, got ${count}`
    );
  }

  console.log(
    `${label}: n=${count}, ` +
    `p50=${percentile(values, 0.50).toFixed(2)} ms, ` +
    `p95=${percentile(values, 0.95).toFixed(2)} ms, ` +
    `min=${Math.min(...values).toFixed(2)} ms, ` +
    `max=${Math.max(...values).toFixed(2)} ms`
  );
}

const summaryRows = readCsv(SUMMARY_FILE);
const rawRows = readCsv(RAW_FILE);

console.log('EMPLOYERS BENCHMARK SUMMARY');
console.log('Percentile method: Linear Interpolation (PERCENTILE.INC)');

console.log('\nSCENARIO E2E');

for (const scenario of ['S1', 'S2', 'S3', 'S4']) {
  const selected = summaryRows.filter(
    (row) => row[0] === scenario && row[1] === 'measurement'
  );

  const values = selected
    .map((row) => Number(row[10]))
    .filter(Number.isFinite);

  printStatistics(
    scenario,
    values,
    selected.length
  );
}

console.log('\nAPI RESPONSE DURATION');

for (const scenario of ['S1', 'S2', 'S3', 'S4']) {
  const selectedSummary = summaryRows.filter(
    (row) => row[0] === scenario && row[1] === 'measurement'
  );

  const expectedCount = selectedSummary.reduce(
    (total, row) => {
      const requestCount = Number(row[9]);

      return total + (
        Number.isFinite(requestCount) && requestCount >= 0
          ? requestCount
          : 0
      );
    },
    0
  );

  const selectedRaw = rawRows.filter(
    (row) => row[0] === scenario && row[1] === 'measurement'
  );

  const values = selectedRaw
    .map((row) => Number(row[13]))
    .filter(Number.isFinite);

  printStatistics(
    scenario,
    values,
    expectedCount
  );
}
