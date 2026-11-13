
import fs from 'node:fs';

const DIR = 'docs/evidence/v6-01-employers-baseline';

const SUMMARY_FILE = `${DIR}/measurement-run-summary.csv`;
const RAW_FILE = `${DIR}/measurement-raw-results.csv`;

function parseCsvLine(line) {
  return [...line.matchAll(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)]
    .map((match) =>
      match[1].startsWith('"')
        ? match[1].slice(1, -1).replaceAll('""', '"')
        : match[1]
    );
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

function summarize(label, rows, valueIndex, expectedCount) {
  console.log(`\n${label}`);

  for (const scenario of ['S1', 'S2', 'S3', 'S4']) {
    const selected = rows.filter(
      (row) => row[0] === scenario && row[1] === 'measurement'
    );

    const values = selected
      .map((row) => Number(row[valueIndex]))
      .filter(Number.isFinite);

    const count = values.length;

    if (count !== expectedCount) {
      console.log(
        `${scenario}: CHECK REQUIRED - expected ${expectedCount}, got ${count}`
      );
      continue;
    }

    console.log(
      `${scenario}: n=${count}, ` +
      `p50=${percentile(values, 0.50).toFixed(2)} ms, ` +
      `p95=${percentile(values, 0.95).toFixed(2)} ms, ` +
      `min=${Math.min(...values).toFixed(2)} ms, ` +
      `max=${Math.max(...values).toFixed(2)} ms`
    );
  }
}

const summaryRows = readCsv(SUMMARY_FILE);
const rawRows = readCsv(RAW_FILE);

console.log('EMPLOYERS BENCHMARK SUMMARY');
console.log('Percentile method: Linear Interpolation (PERCENTILE.INC)');

summarize(
  'SCENARIO E2E (30 scenario runs each)',
  summaryRows,
  10,
  30
);

console.log('\nAPI RESPONSE DURATION');

for (const scenario of ['S1', 'S2', 'S3', 'S4']) {
  const selected = rawRows.filter(
    (row) => row[0] === scenario && row[1] === 'measurement'
  );

  const values = selected
    .map((row) => Number(row[13]))
    .filter(Number.isFinite);

  const expectedCount = scenario === 'S1' ? 60 : 30;

  if (values.length !== expectedCount) {
    console.log(
      `${scenario}: CHECK REQUIRED - expected ${expectedCount}, got ${values.length}`
    );
    continue;
  }

  console.log(
    `${scenario}: n=${values.length}, ` +
    `p50=${percentile(values, 0.50).toFixed(2)} ms, ` +
    `p95=${percentile(values, 0.95).toFixed(2)} ms, ` +
    `min=${Math.min(...values).toFixed(2)} ms, ` +
    `max=${Math.max(...values).toFixed(2)} ms`
  );
}
