# Project Setup — Full Stack (Local + AWS)

Copy-paste friendly. Every AWS step says exactly which console and where to click first.
Every step below was verified end-to-end against a real deployment — the gotchas called
out in bold are things that silently broke a working-looking setup before.

**Lab account note**: if your role is `voclabs` (AWS Academy Learner Lab), IAM role creation is usually blocked. Wherever this guide says "create new role," use **"choose existing role"** instead and pick the pre-existing `LabRole` if one exists in IAM → Roles. Also: `voclabs` sessions expire — if `aws sts get-caller-identity` starts returning `InvalidClientTokenId`, your temporary credentials expired; get fresh ones from the Learner Lab AWS CLI panel.

## 0. Prereqs

- Node.js 20+, npm, Git
- `psql` — Windows: `winget install -e --id PostgreSQL.PostgreSQL.16`, then add `C:\Program Files\PostgreSQL\16\bin` to PATH
- AWS CLI configured (`aws configure`)
- **Windows users**: do the Lambda zip packaging (step 6) from Git Bash, not PowerShell — see the warning in that step.

## 1. Naming

| Resource | Name |
|---|---|
| RDS instance | `coop-db-dev` |
| RDS Proxy | `cs361-rds-proxy` |
| Secrets Manager secret | `cs361-coop-db-credentials` |
| Lambda | `cs361-companies-lambda` |
| API Gateway | `cs361-companies-api` |
| Lambda security group | `cs361-companies-lambda-sg` |
| RDS Proxy security group | `cs361-rds-proxy-sg` |

## 2. Clone + run locally

```bash
git clone https://github.com/KaylahJin/CS361-Project.git
cd CS361-Project
npm install
npm run dev        # http://localhost:5173
```

`npm run test` — unit tests, no AWS needed. `npm run migrate:build-seed` — regenerate `infra/seed.sql`.

## 3. RDS PostgreSQL

**Go to: RDS console → Databases → Create database.**

| Field | Value |
|---|---|
| Creation method | Standard create |
| Engine | PostgreSQL |
| Version | 16.x |
| Template | Free tier |
| DB instance identifier | `coop-db-dev` |
| Master username | `postgres` |
| Credentials — Auto generate | Simplest, console can link it straight into Secrets Manager |
| Credentials — Self managed | Your own password. Rules: 8+ chars, no `/` `@` `"` or spaces (`!` is fine). You must manually create the Secrets Manager secret in step 4a. |
| Instance class | `db.t4g.micro` |
| Storage | 20 GB gp3 |
| VPC | default |
| Public access | Yes (dev only) |
| VPC security group | Create new → `coop-db-dev-sg` |
| DB name | `coop_db` |

Create → wait for "Available" (5-10 min).

**Go to: RDS console → Databases → `coop-db-dev` → Connectivity & security tab → click the security group link → Edit inbound rules.**
Add: Type `PostgreSQL`, Source `My IP`. Save.

**Fix a known bug before loading**: open `infra/schema.sql`, move the line `CREATE EXTENSION IF NOT EXISTS pg_trgm;` from the bottom to the very top, above `CREATE TABLE companies`.

**Load (from `CS361-Project/`, bash):**
```bash
PGCLIENTENCODING=UTF8 PGPASSWORD='<password>' psql -h <endpoint> -p 5432 -U postgres -d coop_db -f infra/schema.sql
PGCLIENTENCODING=UTF8 PGPASSWORD='<password>' psql -h <endpoint> -p 5432 -U postgres -d coop_db -f infra/seed.sql
```
Use single quotes around the password — a `!` in it breaks bash if double-quoted.

**Verify:**
```bash
PGCLIENTENCODING=UTF8 PGPASSWORD='<password>' psql -h <endpoint> -p 5432 -U postgres -d coop_db
```
```sql
SELECT count(*) FROM companies;   -- expect 81
```
`\q` to exit.

Save credentials in `CS361-Project/.env` (gitignored): `PGHOST`, `PGPORT=5432`, `PGDATABASE=coop_db`, `PGUSER=postgres`, `PGPASSWORD`.

**Never commit a real password anywhere** — not in this file, not in a commit message, not pasted into chat/Slack/Discord. Treat any password that *has* been exposed that way as compromised and rotate it.

## 4. RDS Proxy

### 4a. Create the secret first

**Go to: Secrets Manager console → Store a new secret.**

| Field | Value |
|---|---|
| Secret type | Credentials for Amazon RDS database |
| Username | `postgres` |
| Password | password from step 3 |
| Database | `coop-db-dev` (select from dropdown) |
| Secret name | `cs361-coop-db-credentials` |

Finish. Skip if you used "Auto generate" in step 3 AND the console already linked it to Secrets Manager — check Secrets Manager console for an existing secret tied to `coop-db-dev` first.

### 4b. Create the proxy

**Go to: RDS console → Proxies → Create proxy.**

| Field | Value |
|---|---|
| Proxy identifier | `cs361-rds-proxy` |
| Engine compatibility | PostgreSQL |
| Connect to database | `coop-db-dev` |
| Secrets Manager secret | `cs361-coop-db-credentials` |
| IAM role | Create new role (or **existing `LabRole`** — see lab account note at top) |
| Subnet group | auto-filled from the DB, leave as-is |
| VPC security group | leave default for now, changed in step 5 |
| Require TLS | off is fine (client code doesn't need TLS to connect through the proxy) — leave the console default either way, it isn't the thing that breaks |

If prompted **"Policy parameters incomplete"**: click **Define parameters**, it wants the secret's ARN (and KMS key ARN only if you chose a custom encryption key — otherwise leave blank). Use the dropdown to select the secret by name rather than typing the ARN.

Ignore any `access-analyzer:ValidatePolicy` AccessDenied banner — cosmetic, doesn't block saving.

Create → wait for "Available". Copy the proxy's **endpoint** (different from the RDS endpoint) — used in step 6.

### 4c. Register the target — **do not skip this**

Creating the proxy does **not** automatically attach it to the database. A proxy with zero targets accepts TCP connections and then drops them instantly — the client sees a generic `Connection terminated unexpectedly` with no explanation, which looks exactly like a credentials or TLS problem but isn't. This step is easy to miss because the console's "Create proxy" wizard doesn't make it obvious a separate step is still needed.

**Go to: RDS console → Proxies → `cs361-rds-proxy` → Targets tab → Register targets** (or via CLI):

```bash
aws rds register-db-proxy-targets --db-proxy-name cs361-rds-proxy --db-instance-identifiers coop-db-dev
```

**Verify** — this is the step that actually matters, the registration call succeeding doesn't mean the target is usable yet:

```bash
aws rds describe-db-proxy-targets --db-proxy-name cs361-rds-proxy --query "Targets[0].TargetHealth"
```

Expect `{"State": "REGISTERING"}` → `{"State": "UNAVAILABLE", "Reason": "PENDING_PROXY_CAPACITY"}` → `{"State": "AVAILABLE"}`. The middle state can last **several minutes** (observed ~4 min) while the proxy scales capacity — this is normal, not a failure. Don't move on to testing the Lambda until it reaches `AVAILABLE`.

## 5. Security groups

**Go to: EC2 console → Security Groups.** Create in this exact order — later rules reference earlier SGs.

**5a. Create `cs361-rds-proxy-sg`** — Create security group, name it, same VPC as `coop-db-dev`, no rules yet. Create.

**5b. Create `cs361-companies-lambda-sg`** — Create security group, name it, same VPC, no inbound rules.
Outbound rules tab → Edit outbound rules → **delete the default `0.0.0.0/0` row** → Add rule:

| Field | Value |
|---|---|
| Type | PostgreSQL |
| Destination type | Custom |
| Destination | `cs361-rds-proxy-sg` |
| Description | To RDS Proxy |

Save.

**5c. Edit `cs361-rds-proxy-sg`** (select it in the list → Actions, or click its ID):
Inbound rules tab → Edit inbound rules → Add rule:

| Field | Value |
|---|---|
| Type | PostgreSQL |
| Source type | Custom |
| Source | `cs361-companies-lambda-sg` |
| Description | From Lambda |

Outbound rules tab → Edit outbound rules → delete default `0.0.0.0/0` row → Add rule:

| Field | Value |
|---|---|
| Type | PostgreSQL |
| Destination type | Custom |
| Destination | `coop-db-dev-sg` |
| Description | To RDS |

Save both tabs.

**5d. Edit `coop-db-dev-sg`:**
Inbound rules tab → Edit inbound rules → Add rule (don't edit the existing My IP row — CIDR rules can't convert to SG-reference rules in place):

| Field | Value |
|---|---|
| Type | PostgreSQL |
| Source type | Custom |
| Source | `cs361-rds-proxy-sg` |
| Description | From RDS Proxy |

Save. (Keep the My IP rule too if you still want direct `psql` access.)

**5e. Attach the proxy SG**: RDS console → Proxies → `cs361-rds-proxy` → edit networking → change security group to `cs361-rds-proxy-sg`.

No NAT Gateway needed anywhere in this setup.

## 6. Lambda

**Go to: Lambda console → Create function.**

| Field | Value |
|---|---|
| Name | `cs361-companies-lambda` |
| Runtime | Node.js 20.x (or 22.x) |
| VPC | same as `coop-db-dev` |
| Subnets | private subnets with a route to the proxy |
| Security group | `cs361-companies-lambda-sg` |

**Set the timeout explicitly — do not leave the default.** Configuration tab → General configuration → Edit → **Timeout: 10 sec** (the default is 3 seconds, which is too short for a cold VPC ENI attach + RDS Proxy handshake; a timeout here surfaces to the client as a raw 500 with no useful message).

Environment variables (Configuration tab → Environment variables):

| Key | Value |
|---|---|
| `DB_HOST` | RDS Proxy endpoint from step 4b (not the raw RDS endpoint) |
| `DB_PORT` | `5432` |
| `DB_NAME` | `coop_db` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | password from step 3 |

Handler: `index.handler`.

**Package (from `infra/lambda/companies/`):**
```bash
npm install --omit=dev
zip -r function.zip .
```

**⚠️ Windows warning — do this in Git Bash, not PowerShell.** PowerShell's `Compress-Archive` (and Windows Explorer's "Send to → Compressed folder") write zip entries with backslash path separators (`node_modules\pg\...`) on this platform's .NET Framework. Lambda's Linux runtime cannot resolve that into real subdirectories, so the function fails at cold start with `Cannot find package 'pg' imported from /var/task/db.mjs` — even though the zip's file size and contents look completely normal. Git Bash's real `zip` command writes correct forward-slash paths. If you only have PowerShell, build the archive file-by-file with `System.IO.Compression.ZipFile`, forcing `/`-separated entry names — don't use `Compress-Archive`.

Upload `function.zip`: Lambda console → Code tab → Upload from → .zip file. Or:
```bash
aws lambda update-function-code --function-name cs361-companies-lambda --zip-file fileb://infra/lambda/companies/function.zip
```

**Sanity check after any deploy** — confirm the uploaded code actually contains your dependency:
```bash
unzip -l infra/lambda/companies/function.zip | grep node_modules/pg/package.json
```
If that prints nothing, the zip is broken and the Lambda will crash at init.

## 7. IAM execution role

On the Lambda's Configuration tab → Permissions → execution role.

Attach policy `AWSLambdaVPCAccessExecutionRole` — required for any VPC-attached Lambda to get an ENI. Without it, every invocation times out.

(Lab account: if you're using `LabRole`, check this policy is already attached — if not and you can't attach it yourself, ask your instructor.)

## 8. API Gateway

**Go to: API Gateway console → Create API → HTTP API** (not REST API).

| Field | Value |
|---|---|
| Name | `cs361-companies-api` |
| Routes | `GET /companies`, `GET /companies/{companyId}` |
| Integration | Lambda proxy → `cs361-companies-lambda`, both routes |

CORS (on the API itself, configure during creation or later under CORS tab — **never** add CORS headers to the Lambda code):

| Field | Value |
|---|---|
| Allow origin | `http://localhost:5173` |
| Allow methods | `GET, OPTIONS` |

Deploy to `$default` stage. Copy the invoke URL.

**Verify the CORS config actually saved** — the console wizard can let you click past this step without applying it, and the API will work fine from `curl` while every browser request silently fails CORS:
```bash
aws apigatewayv2 get-api --api-id <api-id> --query "CorsConfiguration"
```
If this prints `null`, CORS was never applied — go back and set it:
```bash
aws apigatewayv2 update-api --api-id <api-id> \
  --cors-configuration AllowOrigins=http://localhost:5173,AllowMethods=GET,OPTIONS,AllowHeaders=content-type
```

## 9. Verify the live API

```bash
API_URL="https://<api-id>.execute-api.<region>.amazonaws.com"
curl "$API_URL/companies"
curl "$API_URL/companies?province=กรุงเทพมหานคร"
curl "$API_URL/companies/C01"
curl -i "$API_URL/companies/DOES-NOT-EXIST"   # expect 404
```

If you get `{"message":"Internal Server Error"}` (note: `message` key, not `error`), that's API Gateway's own generic failure response, meaning the Lambda invocation itself crashed or timed out before your code's own error handling ever ran. Go straight to CloudWatch Logs for that function — `curl`'s status code alone won't tell you why. If instead you get `{"error":"..."}`, your code's `jsonResponse` helper did run — the failure is inside the handler (e.g. the DB connection), not the invocation.

## 10. Wire frontend to the live API

`CS361-Project/.env` (gitignored):
```
VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com
```

## 11. Cleanup

Disable + delete CloudFront (if any) before deleting anything it points to. Then: API Gateway → delete API. Lambda → delete function. RDS → Proxies → delete proxy. RDS → Databases → delete instance (skip final snapshot only if you're sure — `seed.sql` regenerates the data anyway; if it says a snapshot name already exists, either rename it or delete the old one from RDS → Snapshots first).

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `psql` not recognized | Not on PATH | See prereqs |
| `psql` connection timeout | Your IP changed | Redo the security group "My IP" rule in step 3 |
| Encoding error loading `seed.sql` | Missing client encoding | Add `PGCLIENTENCODING=UTF8` before the command |
| Thai text garbled in terminal output | Cosmetic | Run `chcp 65001` in git-bash, or ignore — data is correct |
| Pasted SQL into bash, got `syntax error`/`command not found` | You're at the `$` prompt, not inside `psql` | Connect first, paste SQL only after seeing `coop_db=>` |
| `docdb-elastic` / other unrelated `AccessDenied` in console | Lab role scoped tight, unrelated service | Ignore |
| `iam:CreateRole` AccessDenied | Lab account blocks new roles | Use existing `LabRole` instead |
| `access-analyzer:ValidatePolicy` AccessDenied | Cosmetic console linter | Ignore |
| "Policy parameters incomplete" | — | Click Define parameters, select the secret from the dropdown |
| "You may not specify a referenced group id for an existing IPv4 CIDR rule" | Can't convert a CIDR rule to an SG-reference rule in place | Delete the row, add a new one instead |
| `aws` commands return `InvalidClientTokenId` | Learner Lab temp credentials expired | Get fresh credentials from the Lab's AWS CLI panel |
| `aws` command fails with a regex error on `logGroupName`/similar, but the value looks fine | Git Bash (MSYS) rewrites a leading `/` in arguments, mangling paths like `/aws/lambda/...` | Run that specific command in PowerShell or `cmd` instead, or prefix with `MSYS_NO_PATHCONV=1` |
| Live API returns `{"message":"Internal Server Error"}` | Lambda invocation itself failed (crash/timeout), not a handled error | Check CloudWatch Logs for the function, not `curl` |
| CloudWatch shows `Cannot find package 'pg' imported from ...` | Deploy zip built on Windows with `Compress-Archive` — backslash paths break on Linux | Rebuild the zip from Git Bash (`zip -r`), see step 6 |
| CloudWatch shows `Connection terminated unexpectedly`, but SG rules, secret, and TLS all check out | RDS Proxy has zero registered targets | `aws rds register-db-proxy-targets`, then wait for `AVAILABLE` — see step 4c |
| Lambda times out reaching DB | SG chain broken, or `AWSLambdaVPCAccessExecutionRole` missing | Recheck step 5 and step 7 |
| CORS error in browser, headers look fine in curl | Either the API's CORS config never actually saved, or the Lambda is also setting its own `Access-Control-Allow-Origin` (duplicate headers get rejected by the browser) | Check `aws apigatewayv2 get-api --query CorsConfiguration` isn't `null`; remove any CORS header from Lambda code — API Gateway already sets it |
| 403 from API Gateway before reaching Lambda | CORS preflight (`OPTIONS`) not allowed | Recheck step 8 CORS config includes `OPTIONS` |
| `function.zip` upload fails/too large | `node_modules` includes dev deps | Re-run `npm install --omit=dev` inside `infra/lambda/companies/`, not the repo root |
| `migrate:build-seed` throws "matched 0 companies" | `EMPLOYERS_SOURCE` path in `infra/migrate/build-seed.mjs` is stale | Update the path to point at the current source file |

## 13. What's manual vs automated

No IaC — every AWS step above is console click-through (or the equivalent `aws` CLI call) by design, done manually once per environment. `npm run migrate:build-seed` is the one scripted/repeatable piece — it regenerates `infra/seed.sql` from the source registry CSV so re-seeding the database never requires hand-editing SQL.
