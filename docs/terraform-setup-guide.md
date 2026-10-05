# Terraform Setup Guide — Companies API

This is the recommended way to stand up the whole backend. One command builds
every AWS resource; two more load the data and point the frontend at it.

[`project-setup-guide.md`](project-setup-guide.md) documents the same stack built by hand in the AWS
console. You do not need it to deploy — use it only to understand what a
resource is for, or if Terraform is unavailable to you.

**What gets created** (all named `<your-prefix>-*`):

| Resource | Purpose |
|---|---|
| RDS PostgreSQL 16.15, `db.t4g.micro` | the `coop_db` database |
| Secrets Manager secret | the credentials the proxy authenticates against |
| RDS Proxy + registered target | connection pooling in front of RDS |
| 3 security groups | Lambda → Proxy → RDS, each allowing only port 5432 |
| Lambda (Node.js 22.x), 10s timeout | `GET /companies`, `GET /companies/{id}` |
| API Gateway HTTP API + CORS | public HTTPS endpoint |

Nothing here creates an IAM role — the existing `LabRole` is reused, because
Learner Lab accounts block `iam:CreateRole`.

---

## 1. Prerequisites

| Need | Install / check |
|---|---|
| Terraform >= 1.5 | `terraform version` · `winget install -e --id Hashicorp.Terraform` |
| AWS CLI, configured | `aws sts get-caller-identity` — see below |
| Node.js 20+ | `node --version` |
| `psql` 16 | `psql --version` · `winget install -e --id PostgreSQL.PostgreSQL.16`, then add `C:\Program Files\PostgreSQL\16\bin` to PATH and reopen the terminal |
| Git Bash (Windows) | run every command in this guide from Git Bash, not PowerShell |

Install dependencies in **both** places — the root one is the frontend, the
Lambda one gets zipped into the deployment package:

```bash
npm install                                      # repo root
npm install --omit=dev --prefix infra/lambda/companies
```

Skipping the second one deploys a Lambda without the `pg` driver, and every
request fails with `Cannot find package 'pg'`.

### AWS credentials

**AWS Academy Learner Lab** (your role is `voclabs`): open the lab page → click
**AWS Details** → **AWS CLI** → copy the whole `[default]` block, including
`aws_session_token`, into `~/.aws/credentials`.

These expire after a few hours. When any `aws` or `terraform` command starts
returning `InvalidClientTokenId` or `ExpiredToken`, re-copy that block. Nothing
is broken — the credentials just aged out.

**Normal IAM user**: `aws configure`, then paste your access key and secret.

Verify before continuing — this must print your account, not an error:

```bash
aws sts get-caller-identity
```

---

## 2. Configure

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and set all three values:

| Variable | Value | Notes |
|---|---|---|
| `name_prefix` | your first name, lowercase | Everyone shares one AWS account and AWS rejects duplicate resource names. If two people use the same prefix, the second `apply` fails halfway. Keep it stable afterwards — changing it recreates the database. |
| `db_password` | your own, 8+ chars | No `/` `@` `"` or space. `!` is fine. |
| `my_ip_cidr` | `curl -s https://checkip.amazonaws.com`, then append `/32` | Opens port 5432 to just your machine, so you can run `psql` in step 4. |

Terraform rejects the placeholder values, so a forgotten edit fails
immediately rather than deploying something broken.

`terraform.tfvars` is gitignored because it holds a real password. Never commit
it, and never paste the password into chat, Slack, Discord, or a commit
message. If it ever has been, change it and `terraform apply` again.

```bash
terraform init
```

---

## 3. Deploy

```bash
terraform plan     # review what will be created; changes nothing
terraform apply    # type: yes
```

**Expect 12-18 minutes.** Most of it is two unavoidable waits: RDS instance
creation (5-10 min), then a deliberate 5-minute pause while the proxy target
scales from `REGISTERING` to `AVAILABLE`. A proxy whose target is not yet
`AVAILABLE` accepts TCP connections and drops them instantly, so the wait is
built into the config rather than left to you to remember.

Don't interrupt it. If you do, re-run `terraform apply` — it picks up where it
left off.

---

## 4. Load the data

**Terraform creates an empty database.** It does not run SQL. Without this step
everything looks healthy and `GET /companies` returns `[]`.

From the repo root:

```bash
npm run db:load
```

It reads the endpoint from Terraform, prompts for the `db_password` you set in
step 2, loads `infra/schema.sql` then `infra/seed.sql`, and prints
`companies loaded: 103`. Re-running it is safe — it detects an already-loaded
database and does nothing. Use `npm run db:load -- --reset` to wipe and reload.

---

## 5. Point the frontend at it

```bash
npm run env:sync   # writes VITE_API_URL into .env
npm run dev
```

Re-run `env:sync` after any `terraform apply` that recreated the API — the API
Gateway ID changes, and a stale URL gives the browser a bare network error with
no status code.

**Check the port Vite prints.** `cors_allow_origin` defaults to
`http://localhost:5173`. If 5173 is already in use, Vite silently starts on
5174 and the browser blocks every request as a CORS failure while `curl` keeps
working fine. Either free up 5173, or set `cors_allow_origin` in
`terraform.tfvars` to the port Vite actually chose and `terraform apply` again.

---

## 6. Publish the frontend to S3

Step 5 runs the site on your laptop. This step puts it on the internet, so
anyone with the URL can open it — no `npm run dev`, no Node.

From the repo root:

```bash
npm run web:deploy
```

It reads the bucket name and API URL from Terraform, creates the bucket if it
does not exist, configures it for public website hosting, runs `npm run build`
with `VITE_API_URL` set to the live API, uploads `dist/`, checks the site
returns HTTP 200, and prints the URL:

```
deployed: http://<prefix>-coop-web-<account-id>.s3-website-us-east-1.amazonaws.com
```

Re-run it after every frontend change, and after any `terraform apply` that
recreated the API — `VITE_API_URL` is compiled into the JS bundle at build
time, not read from `.env` in the browser, so a new API URL needs a new build.

Four things worth knowing:

- **The site is HTTP, not HTTPS.** S3 website endpoints don't serve TLS. The
  API is still HTTPS and that mix is fine: browsers only block an HTTPS page
  calling an HTTP endpoint, not the other way round.
- **The bucket is public on purpose.** A bucket policy grants `s3:GetObject`
  to everyone, which is what static hosting means. Nothing secret belongs in
  `dist/` — anything in the bundle is readable by anyone, `VITE_API_URL`
  included. Never put the DB password in a `VITE_` variable.
- **CORS is already handled.** `apigateway.tf` allows both `localhost:5173`
  and the site origin, which `s3_web.tf` computes from your `name_prefix`,
  the account ID, and the region.
- **This script owns the bucket, not Terraform.** `terraform destroy` leaves
  it behind on purpose; delete it with `npm run web:deploy -- --destroy`.
  The reason is a Learner Lab service control policy:

  ```
  Error: reading S3 Bucket (...) object lock configuration:
  api error AccessDenied: ... not authorized to perform:
  s3:GetBucketObjectLockConfiguration ... with an explicit deny in a
  service control policy
  ```

  The AWS provider calls `GetObjectLockConfiguration` inside
  `aws_s3_bucket`'s read, which runs after every create and on every refresh.
  Nothing skips it, so `apply` fails *after* creating the bucket and every
  later `plan` fails too — confirmed on provider v5.100.0 and v6.67.0. Every
  S3 **write** the site needs is allowed, so the CLI does the whole job
  instead, idempotently, on every deploy.

---
## 7. Verify

```bash
cd infra/terraform
API="$(terraform output -raw api_url)"

curl -s "$API/companies" | head -c 200          # a JSON array of companies
curl -s "$API/companies/C01"                    # one company
curl -si "$API/companies/NOPE" | head -1        # HTTP/2 404
curl -s "$API/companies?search=EY"              # filtered by name
curl -sD - -o /dev/null -H 'Origin: http://localhost:5173' "$API/companies" \
  | grep -i access-control-allow-origin         # must echo your origin back
```

Terraform's own health check, if the API misbehaves:

```bash
eval "$(terraform output -raw proxy_target_health_check_command)"   # want AVAILABLE
```

---

## 8. Tear down

```bash
cd infra/terraform
terraform destroy    # type: yes
```

Removes everything this stack created, database included. It does **not**
remove the website bucket — Terraform does not manage it (see step 6). Delete
that separately:

```bash
npm run web:deploy -- --destroy    # prompts for the bucket name
```

Leaving the bucket in place between lab sessions is fine and costs ~nothing:
the next `npm run web:deploy` reuses it. `seed.sql`
regenerates the data, so nothing is permanently lost. Learner Lab accounts also
wipe resources when the lab session ends — so after a lab reset, expect to
start from step 3 again with a fresh `terraform apply`.

`destroy` then `apply` works as many times as you like: the Secrets Manager
secret is set to delete immediately rather than sit in a 30-day recovery window
holding its name hostage. Remember step 4 again each time — a rebuilt database
is an empty one.

---

## 9. If something breaks

| Symptom | Cause | Fix |
|---|---|---|
| `InvalidClientTokenId` / `ExpiredToken` | Learner Lab credentials aged out | Re-copy the `[default]` block from the lab's AWS CLI panel |
| `apply` fails: *name already exists* | A teammate is using your `name_prefix` | Pick a different one, `apply` again |
| `apply` fails: `iam:CreateRole` AccessDenied | Lab account blocks new roles | Confirm `lab_role_name` is `LabRole` and that it exists in IAM → Roles |
| `GET /companies` returns `[]` | Database is empty | You skipped step 4 — `npm run db:load` |
| `{"message":"Internal Server Error"}` (`message` key) | The Lambda invocation itself crashed or timed out, before your code ran | CloudWatch → `/aws/lambda/<prefix>-companies-lambda`. In Git Bash, prefix the `aws logs` command with `MSYS_NO_PATHCONV=1` or the leading `/` gets mangled |
| `{"error":"..."}` (`error` key) | Your handler ran and failed — usually the DB connection | Same logs, but look at the SQL/connection error |
| `Cannot find package 'pg'` | Lambda zip has no dependencies | `npm install --omit=dev --prefix infra/lambda/companies`, then `terraform apply` |
| `Connection terminated unexpectedly` | Proxy target not `AVAILABLE` yet | Run the health check in step 7, wait, retry |
| CORS error in the browser, `curl` works | Vite is on a different port than `cors_allow_origin` | See the note in step 5 |
| `psql` connection timeout | Your public IP changed | Re-run the `checkip` command, update `my_ip_cidr`, `terraform apply` |
| Thai text garbled in the terminal | Cosmetic only, data is correct | `chcp 65001`, or ignore |
| Changed Lambda code, `apply` says no changes | — | It re-zips and redeploys on any file change in `infra/lambda/companies/`; if truly unchanged there is nothing to deploy |
| `apply` wants to destroy and recreate everything | You changed `name_prefix` | Change it back, or accept the rebuild and re-run step 4 |
| `apply` fails: *a secret with this name is already scheduled for deletion* | A secret destroyed by an older version of this config is still inside its 30-day recovery window | `aws secretsmanager delete-secret --secret-id <prefix>-coop-db-credentials --force-delete-without-recovery`, then `apply`. The config now sets `recovery_window_in_days = 0`, so new teardowns don't do this |
| Site URL returns `403 AccessDenied` for every file | Block Public Access got re-enabled on the bucket | `npm run web:deploy` again — it clears the block and re-puts the policy every run |
| `apply` fails: `GetObjectLockConfiguration` AccessDenied / explicit deny | You added an `aws_s3_bucket` resource back to the config | The account's SCP blocks that read. Keep the bucket in `deploy-web.sh`; see step 6 |
| Site loads, company list empty, console shows a CORS error | `name_prefix` changed after the API was created, so the allowed origin no longer matches the bucket | `terraform apply` — the origin is recomputed from `name_prefix` |
| Site still shows the old build after `web:deploy` | Your browser cached `index.html` | Hard reload (Ctrl+Shift+R). Assets are fingerprinted, so only `index.html` can go stale |
| `aws s3 sync` fails with `AccessDenied` | Learner Lab credentials aged out mid-session | Re-copy the `[default]` block from the lab's AWS CLI panel |
| `no matching EC2 VPC found` | The account has no default VPC | `aws ec2 create-default-vpc`, or ask your instructor — this stack deliberately uses the default VPC rather than building its own |

Never commit a saved plan file (`terraform plan -out=tfplan`). A plan is a zip
that embeds both the resolved variable values and a full copy of the state, so
it contains `db_password` in plaintext. `.gitignore` already blocks `tfplan*`.

---

## 10. Files

In `infra/terraform/`:

| File | What's in it |
|---|---|
| `versions.tf` | Terraform + provider version constraints, AWS region |
| `variables.tf` | Every input, with validation rules |
| `terraform.tfvars.example` | Template to copy; the real one is gitignored |
| `data.tf` | Default VPC/subnets, `LabRole` lookup |
| `security_groups.tf` | The Lambda → Proxy → RDS chain |
| `rds.tf` | Postgres instance |
| `secrets.tf` | Secret the proxy authenticates clients against |
| `proxy.tf` | RDS Proxy, target group, target, and the 5-minute wait |
| `lambda.tf` | Zips `infra/lambda/companies/`, Lambda function, API permission |
| `apigateway.tf` | HTTP API, CORS, the two routes, `$default` stage |
| `s3_web.tf` | Bucket name + site URL as locals. No resources — explains the SCP that blocks managing the bucket |
| `outputs.tf` | `api_url` and the values the helper scripts read |

Elsewhere in the repo:

| File | What's in it |
|---|---|
| `infra/schema.sql` | Tables and indexes |
| `infra/seed.sql` | The 103 companies. Generated — re-run `npm run migrate:build-seed` instead of hand-editing |
| `infra/load-db.sh` | `npm run db:load` (step 4) |
| `infra/sync-env.sh` | `npm run env:sync` (step 5) |
| `infra/deploy-web.sh` | `npm run web:deploy` (step 6) — creates/configures the bucket, builds, uploads, verifies |
| `infra/lambda/companies/` | Handler source; `npm test` covers it with no AWS needed |
| `.env.example` | Template for the one frontend variable, `VITE_API_URL` |

Every command in this guide is written to run from the repo root unless it says
`cd infra/terraform` first.
