# Employers Critical Path Baseline - Benchmark Procedure

## 1. Objective

Establish a repeatable performance baseline for the Employers page and its `GET /companies` API before optimization.

The benchmark covers four user scenarios:
- Open the Employers page.
- Search for a company by name.
- Filter companies by province.
- Search and filter at the same time.

The baseline will be used to evaluate future performance improvements.

## 2. Environment

### Application Environment

- Environment: Cloud / Dev
- Git branch: `main` (baseline commit)
- Commit SHA: `0ae16a57576f065b89f016bc179bd366b019110f`
- AWS Region: `us-east-1`
- Frontend: React + TypeScript + Vite
- API: API Gateway HTTP API
- API endpoint: `https://3fcjs95m14.execute-api.us-east-1.amazonaws.com`
- API path: `GET /companies`
- Lambda runtime: Node.js 22.x
- Lambda memory: 128 MB
- Lambda timeout: 10 seconds
- RDS engine: PostgreSQL 16.15
- RDS instance class: `db.t4g.micro`
- Database: `coop_db`

### Client and Automation Environment

- Operating System: Windows Desktop
- Browser for automated measurements: Microsoft Edge 157.0.4341.46
- Automation tool: Playwright 1.65.0
- Browser mode: Headless
- Concurrency: 1 (sequential execution)

### Network

- Network: Mobile Hotspot
- Network throughput: Not reliably measured.
- Keep the same network throughout each benchmark session.
- Record any network changes that occur during testing.

### Browser Compatibility Note

- Initial manual smoke tests and preliminary warm-up samples were collected using Chrome DevTools.
- Automated benchmark measurements will use Microsoft Edge through Playwright.
- Windows Application Control blocks the Chromium executable downloaded by Playwright.
- Microsoft Edge was verified to launch successfully through Playwright.
- Manual preliminary results and automated measurements must be treated as separate measurement sets because they use different browser environments.

## 3. Dataset and Indexes

- Dataset source: `infra/migrate/source/v1-companies.json`
- Expected dataset size: 103 companies
- Actual database row count: 103 companies
- Dataset source is based on the project's company registry data.

### Database Indexes

| Index | Type | Indexed Column |
|---|---|---|
| companies_pkey | B-tree | company_id |
| idx_companies_name | GIN (gin_trgm_ops) | name |
| idx_companies_short_name | GIN (gin_trgm_ops) | short_name |
| idx_companies_province | B-tree | province |

### Expected Scenario Results

| ID | Scenario | Input | Expected Rows |
|---|---|---|---:|
| S1 | Open Employers page | No filters | 103 per request |
| S2 | Search company | `CDG` | 1 |
| S3 | Filter province | `กรุงเทพมหานคร` | 79 |
| S4 | Search and filter | `CDG` + `กรุงเทพมหานคร` | 1 |

Endpoint: `GET /companies`

## 4. Workload Scenarios

### S1: Open Employers Page

1. Open the Employers page.
2. Wait for the initial company data to load.
3. Verify that 103 company cards are displayed.
4. Record all initial `GET /companies` requests.

The current implementation triggers two initial requests when the page loads. Both requests must be recorded separately.

### S2: Search Company

1. Open the Employers page.
2. Enter `CDG` in the company search field.
3. Wait for the search request and UI update to complete.
4. Verify that one company is displayed.
5. Record the request and scenario duration.

The search field uses a 300 ms debounce.

### S3: Filter Province

1. Open the Employers page.
2. Select `กรุงเทพมหานคร` in the province filter.
3. Wait for the filter request and UI update to complete.
4. Verify that 79 companies are displayed.
5. Record the request and scenario duration.

### S4: Search and Filter

1. Open the Employers page.
2. Select `กรุงเทพมหานคร` as the province.
3. Wait for the province filter to complete.
4. Enter `CDG` in the search field.
5. Wait for the combined search request and UI update to complete.
6. Verify that one company is displayed.
7. Record the combined request and scenario duration.

For S4, selecting the province is a precondition. The measured action is entering the search query while the province filter is already active. This avoids counting an intermediate province-only request as the combined search request.

## 5. Benchmark Configuration

- Environment: Cloud / Dev only.
- Concurrency: 1 (sequential execution).
- Warm-up: 3 runs per scenario.
- Measurement: 30 runs per scenario after warm-up.
- Total measured runs: 120 scenario runs.
- Cold Start: Record separately only when verifiable through AWS logs or other reliable AWS metrics.
- Local and Cloud results must be reported separately.
- Keep the same client, browser, network, and test inputs throughout a test session.
- Use Playwright with Microsoft Edge for automated measurements.
- Disable browser cache through the browser debugging protocol when supported by the automation setup.
- Filter captured network responses by `/companies`.
- Wait for all relevant requests and expected UI updates before completing a run.
- Do not run other load tests against the environment during measurement.
- Execute all runs sequentially. Do not increase concurrency during baseline collection.

### Warm-up Rules

- Perform 3 warm-up runs for each scenario.
- Warm-up results must be saved with `run_type=warmup`.
- Warm-up results must not be included in p50 or p95 calculations.
- The previously collected manual S1 warm-up samples must remain identified as manual preliminary data.
- Automated warm-up samples must be identified separately from manual samples.

### Measurement Rules

- Perform 30 measured runs for each scenario.
- Three automated warm-up runs per scenario were completed before the measurement session.
- Warm-up and measurement data were collected in separate script executions.
- The separate warm-up execution does not guarantee reuse of the same Lambda execution environment.

## 6. Measurement Rules

### Request-Level Metrics

For each HTTP request, record:

- Scenario ID
- Run type (warmup or measurement)
- Run number
- Request number
- Timestamp
- HTTP status
- Request duration in milliseconds
- Response size in bytes
- Number of response rows
- Environment and commit SHA

Request duration is measured from the browser's request timing information.

It includes the browser-to-API network path and backend processing. It is not equivalent to Lambda execution time.

Response size must be measured consistently using the response body size in bytes.

### Scenario-Level Metrics

For each scenario run, record:

- Number of HTTP requests
- Scenario end-to-end duration in milliseconds
- Run type
- Run number
- Environment and commit SHA

Scenario end-to-end duration is measured by the benchmark script using browser-side elapsed time. The measurement starts when the scenario's measured action begins and ends when the expected UI result is displayed.

- S1: Page reload until 103 company cards are displayed.
- S2: Entering the search query `CDG` after the page has been reset, until the filtered result is displayed.
- S3: Selecting `กรุงเทพมหานคร` after the page has been reset, until the filtered result is displayed.
- S4: Entering `CDG` while the province filter is already set to `กรุงเทพมหานคร`, until the combined result is displayed.

For S4, selecting the province is a precondition and is not included in the measured scenario duration.

The search debounce time is included in the interaction end-to-end duration.

### S1 Request Handling

The initial Employers page load triggers two `GET /companies` requests.

- Record both requests as separate rows in `raw-results.csv`.
- Count them as one scenario run in `run-summary.csv`.
- Do not add the two request durations together and report the sum as page end-to-end duration.

## 7. Statistics

Calculate the following separately for each scenario:

- Number of successful measured runs.
- Number of failed measured runs.
- p50 latency.
- p95 latency.
- Metric unit: milliseconds (ms).

Report these metrics separately:

1. Request-level latency.
2. Scenario end-to-end latency.

Use only valid measurement runs for the primary latency statistics. Report excluded or failed runs and their reasons.

### Cold Start and Warm Invocation

- Cold Start and Warm Invocation must be reported separately when reliable evidence is available.
- Do not infer Lambda cold starts from browser request duration alone.
- Browser warm-up does not guarantee that the Lambda execution environment is warm.
- If cold-start evidence cannot be collected reliably, explicitly document this limitation instead of inventing a cold-start measurement.

## 8. Evidence Files

Store all benchmark evidence under:

`docs/evidence/v6-01-employers-baseline/`

| File | Purpose |
|---|---|
| `procedure.md` | Benchmark procedure and configuration |
| `measurement-raw-results.csv` | Raw API response measurements |
| `measurement-run-summary.csv` | Scenario-level measurement results |
| `warmup-raw-results.csv` | Automated warm-up API response measurements |
| `warmup-run-summary.csv` | Automated warm-up scenario results |
| `report.md` | Benchmark results, statistics, and limitations |

Benchmark automation scripts:

- `scripts/benchmark/check-employers.mjs`
- `scripts/benchmark/run-employers-benchmark.mjs`
- `scripts/benchmark/summarize-employers-benchmark.mjs`

Preliminary manual samples and trial datasets are not included in the final percentile calculations.

All final measurement results must remain distinguishable from warm-up and preliminary trial data.

## 9. Safety

- Use Cloud / Dev only.
- Do not run load tests against production.
- Do not include credentials, tokens, secrets, or personal data in evidence.
- Do not expose `.env`, AWS credentials, Terraform state, or secret values.
- Do not run destructive database or infrastructure commands.
- Do not run `terraform destroy`.
- Keep benchmark concurrency at 1.
- Stop testing if unexpected errors or signs of service instability occur.