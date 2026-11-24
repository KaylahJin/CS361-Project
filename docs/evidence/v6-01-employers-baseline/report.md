# Employers Critical Path Benchmark Report

## 1. Objective

This benchmark establishes the performance baseline for the Employers page and its critical user workflows.

The benchmark covers four scenarios:

- S1: Open the Employers page
- S2: Search by company name
- S3: Filter companies by province
- S4: Search by company name and filter by province

The purpose is to record repeatable performance measurements for the Cloud/Dev environment.

## 2. Environment

| Item | Value |
|---|---|
| Environment | Cloud/Dev |
| Commit SHA | `0ae16a57576f065b89f016bc179bd366b019110f` |
| AWS Region | `us-east-1` |
| Frontend | React, TypeScript, Vite |
| Browser | Microsoft Edge 157.0.4341.46 |
| Automation | Playwright 1.65.0 |
| Browser Mode | Headless |
| Concurrency | 1 |
| Network | Mobile Hotspot |
| API Gateway | HTTP API |
| Lambda Runtime | Node.js 22.x |
| Lambda Memory | 128 MB |
| Lambda Timeout | 10 seconds |
| RDS Engine | PostgreSQL 16.15 |
| RDS Instance Class | `db.t4g.micro` |
| Database | `coop_db` |

The network was a mobile hotspot. Exact network throughput was not reliably measured.

## 3. Dataset and Database Indexes

- Dataset source: `infra/migrate/source/v1-companies.json`
- Dataset row count: 103 companies
- Database: `coop_db`

Indexes verified in the database:

| Index | Type | Column |
|---|---|---|
| `companies_pkey` | B-tree | `company_id` |
| `idx_companies_name` | GIN (`gin_trgm_ops`) | `name` |
| `idx_companies_short_name` | GIN (`gin_trgm_ops`) | `short_name` |
| `idx_companies_province` | B-tree | `province` |

## 4. Workload and Test Scenarios

| Scenario | Input | Expected Rows |
|---|---|---:|
| S1 | Open Employers page | 103 |
| S2 | Search `CDG` | 1 |
| S3 | Province `กรุงเทพมหานคร` | 79 |
| S4 | Search `CDG` + province `กรุงเทพมหานคร` | 1 |

The search input uses a 300 ms debounce.

In the collected baseline dataset, opening the Employers page produced two unfiltered `GET /companies` responses per S1 run. Therefore, the baseline contains 60 API response records across 30 S1 runs.

## 5. Measurement Procedure

- Browser automation: Playwright using Microsoft Edge.
- Browser cache was disabled through the Chrome DevTools Protocol.
- Concurrency: 1.
- Warm-up: 3 runs per scenario.
- Measurement: 30 runs per scenario.
- Measurement runs were recorded separately from warm-up runs.
- All four scenarios were executed in the Cloud/Dev environment.
- HTTP status, response duration, response bytes, response rows, and scenario E2E duration were recorded.

The warm-up and measurement datasets are stored separately.

## 6. Scenario E2E Results

Scenario E2E measures the elapsed time for the complete browser scenario, including the required page interaction and waiting for the expected UI result.

Percentiles use linear interpolation, equivalent to Excel `PERCENTILE.INC`.

| Scenario | Runs | p50 (ms) | p95 (ms) | Min (ms) | Max (ms) |
|---|---:|---:|---:|---:|---:|
| S1 | 30 | 3488.14 | 4101.07 | 3255.51 | 5870.32 |
| S2 | 30 | 851.25 | 880.72 | 763.00 | 885.45 |
| S3 | 30 | 686.49 | 813.47 | 600.64 | 923.25 |
| S4 | 30 | 760.58 | 816.21 | 691.11 | 821.05 |

## 7. API Response Duration Results

API Response Duration represents the browser-observed duration of each API response. It includes network and backend response time and is not equivalent to Lambda execution duration.

| Scenario | API Responses | p50 (ms) | p95 (ms) | Min (ms) | Max (ms) |
|---|---:|---:|---:|---:|---:|
| S1 | 60 | 497.70 | 576.56 | 442.29 | 873.21 |
| S2 | 30 | 422.05 | 451.29 | 324.00 | 462.26 |
| S3 | 30 | 484.01 | 583.78 | 429.28 | 655.78 |
| S4 | 30 | 355.80 | 409.58 | 305.38 | 446.95 |

S1 has 60 API responses because each of its 30 page-opening runs triggers two API requests.

## 8. Response Validation

All measured API responses returned HTTP 200.

| Scenario | Responses | HTTP Status | Response Rows | Response Bytes |
|---|---:|---:|---:|---:|
| S1 | 60 | 200 | 103 | 55,160 |
| S2 | 30 | 200 | 1 | 475 |
| S3 | 30 | 200 | 79 | 43,264 |
| S4 | 30 | 200 | 1 | 475 |

The observed row counts and response sizes were consistent across the measured responses for each scenario.

### Measurement Run Validation

- S1: 30 successful scenario runs.
- S2: 30 successful scenario runs.
- S3: 30 successful scenario runs.
- S4: 30 successful scenario runs.
- Total: 120 successful scenario runs.
- Failed runs in the final measurement dataset: 0.
- Preliminary trial runs and failed trial attempts are not included in the final measurement CSV files. Their total count cannot be verified from the final evidence.

S1 generated two API responses per scenario run, resulting in 60 API response records. S2, S3, and S4 generated 30 API response records each.

## 9. Execution Batches and Measurement Gaps

The benchmark measurements were collected in separate execution batches rather than one uninterrupted session.

S3 measurement runs 28–30 were separated from the preceding runs by an approximately 18-minute gap.

This gap indicates that these measurements were not collected continuously under identical timing conditions. The approximately 18-minute gap represents a discontinuity in the measurement timeline. Its impact on network conditions, service activity, or Lambda execution environments cannot be determined from the available evidence.

The original recorded measurements were retained. No additional benchmark runs were performed to replace these results.

The gap should be considered when interpreting the S3 latency distribution.

### Warm-up and Measurement Separation

The warm-up and measurement datasets were collected in separate execution batches.

- Automated warm-up runs were executed during 2026-11-13 21:53–21:55 UTC.
- Measurement runs started at approximately 21:57 UTC and continued until approximately 22:33 UTC.
- Warm-up results were stored separately and excluded from the measurement statistics.
- The time between warm-up and measurement varied by scenario. For example, S4 measurement started approximately 35 minutes after its warm-up run.

Therefore, the warm-up runs should not be interpreted as immediately preceding each corresponding measurement run. Browser warm-up also does not guarantee that the same AWS Lambda execution environment was reused during measurement.

### Cold Start Timestamps

Two Lambda `REPORT` records containing `Init Duration` were identified during the measurement period on 2026-11-13.

| Record | Timestamp (UTC) | Init Duration | Duration | Billed Duration |
|---|---|---:|---:|---:|
| 1 | 2026-11-13 22:28:02.415 | 393.95 ms | 854.71 ms | 1,249 ms |
| 2 | 2026-11-13 22:28:02.460 | 441.94 ms | 815.60 ms | 1,258 ms |

Both records occurred during the measurement period (approximately 21:57–22:33 UTC), not during the warm-up period (21:53–21:55 UTC).

The records were emitted by two different Lambda execution environments, as indicated by their distinct log streams. This confirms that cold starts occurred during measurement.

#### CloudWatch Logs Insights Query

The following query was used to identify Lambda `REPORT` records containing `Init Duration`:

```sql
fields @timestamp, @logStream, @message
| filter @message like /REPORT/
| filter @message like /Init Duration/
| sort @timestamp asc
```

## 10. Cold Start and Warm Invocation

The browser benchmark does not directly measure or isolate AWS Lambda Cold Start and Warm Invocation durations.

The three warm-up runs per scenario were used to exercise the browser workflow and API endpoints before measurement. However, browser warm-up does not guarantee that subsequent requests use the same Lambda execution environment.

Browser-observed API response duration includes network and backend response time. It must not be interpreted as Lambda execution duration.

### Lambda CloudWatch Evidence

CloudWatch Logs for `/aws/lambda/aa-companies-lambda` were inspected for the period **2026-11-13 21:53–22:33 UTC (2026-11-14 04:53–05:33 Thailand time)**.

The Logs Insights query identified 406 Lambda REPORT records:

| Record Classification | Invocations |
|---|---:|
| Records containing `Init Duration` | 2 |
| Records without `Init Duration` | 404 |
| **Total** | **406** |

Records containing `Init Duration` provide explicit evidence of Lambda cold starts. The two records appeared in separate Lambda execution log streams.

### Invocation Duration Statistics

The following statistics were calculated from CloudWatch REPORT records using Logs Insights percentiles.

| Metric | No `Init Duration` reported (n=404) | `Init Duration` reported (n=2) |
|---|---:|---:|
| Duration p50 | 120.8564 ms | 815.60 ms |
| Duration p95 | 244.5087 ms | 854.71 ms |
| Duration min | 3.52 ms | 815.60 ms |
| Duration max | 1,060.16 ms | 854.71 ms |
| Billed Duration p50 | 120.9773 ms | 1,249 ms |
| Billed Duration p95 | 244.9979 ms | 1,258 ms |

The two cold-start records reported the following initialization durations:

| Cold Start Record | Init Duration | Duration | Billed Duration |
|---|---:|---:|---:|
| 1 | 393.95 ms | 854.71 ms | 1,249 ms |
| 2 | 441.94 ms | 815.60 ms | 1,258 ms |

The two cold-start observations represent a very small sample and should be treated as descriptive evidence, not as a statistically reliable cold-start baseline.

The 404 records without `Init Duration` are classified as **records without explicit cold-start evidence**. They must not be treated as definitively warm invocations based on the absence of this field alone.

Individual Lambda REPORT records could not be reliably mapped to specific benchmark scenario runs because the benchmark CSV files do not contain matching Lambda request IDs. Therefore, CloudWatch Lambda statistics are reported separately from browser E2E and API response-time measurements.

## 11. Limitations

- This report covers Cloud/Dev only. Local environment measurements are not included.
- Network throughput was not reliably measured.
- Browser-observed API duration includes network and backend response time.
- CloudWatch Lambda REPORT records were analyzed separately, but individual invocations could not be mapped to benchmark scenario runs. Records without `Init Duration` cannot be conclusively classified as warm invocations.
- The cold-start statistics are based on only two observed invocations and are not a statistically reliable baseline.
- Results represent a single-client, concurrency-1 workload and should not be interpreted as a load or stress test.
- No production environment was used.

## 12. Evidence Files

The final benchmark evidence is stored under `docs/evidence/v6-01-employers-baseline/`.

- `procedure.md` — benchmark setup and repeatable procedure
- `measurement-raw-results.csv` — raw API response measurements
- `measurement-run-summary.csv` — scenario E2E measurements
- `warmup-raw-results.csv` — automated warm-up API response measurements
- `warmup-run-summary.csv` — automated warm-up scenario measurements
- `report.md` — benchmark results and analysis

Automation scripts:

- `scripts/benchmark/check-employers.mjs`
- `scripts/benchmark/run-employers-benchmark.mjs`
- `scripts/benchmark/summarize-employers-benchmark.mjs`

Preliminary trial datasets are excluded from the final percentile calculations.

No credentials, secrets, or personal information are included in the final benchmark evidence.