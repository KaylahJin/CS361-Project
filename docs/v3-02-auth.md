# V3-02 auth: what it does, what you can change

Login, API-side identity checks and role rules are in place and verified
against the deployed stack. This doc is the map: how the pieces fit, which
knobs are yours to turn, and what is still missing.

## The path a request takes

1. The React app signs in with email + password through
   `amazon-cognito-identity-js` (SRP). The password goes to Cognito only —
   never to our API, never to the browser console, never to a log.
2. Cognito returns an **ID token** (valid 60 minutes). `AuthContext` keeps the
   session; `getIdToken()` reads it back through the library on every call,
   which is also what refreshes an expired one.
3. The app sends `Authorization: Bearer <ID token>` on coop-plan calls.
4. **API Gateway** checks the token's signature, issuer, audience and expiry.
   A missing, forged or expired token is refused with 401 at the edge — the
   Lambda never runs.
5. **`auth.mjs`** takes the verified `sub` claim and looks up the matching
   `app_users` row. No row, or an inactive row, answers 403: the token was
   valid, so the caller is authenticated but not yet authorised.
6. **`authorize.mjs`** applies the role rules: a student sees only their own
   plan, an advisor only assigned students, staff all of them. Unknown roles
   and `ADMIN` are refused — admins manage accounts, they do not review plans.

Cognito only answers *who is this*. The database answers *what may they do*.

## Where each piece lives

| Piece | File |
|---|---|
| Sign-in / sign-out / session restore | `src/auth/cognitoClient.ts` |
| App-wide auth state, token access | `src/auth/AuthContext.tsx` |
| Login form | `src/pages/Login.tsx` |
| Page gate for signed-out visitors | `src/components/ProtectedRoute.tsx` |
| Token on outgoing API calls | `src/data/coopPlanApi.ts` |
| User pool + app client + JWT authorizer | `infra/terraform/cognito.tf` |
| Which routes require a token | `infra/terraform/apigateway.tf` |
| `sub` to `app_users` lookup | `infra/lambda/companies/auth.mjs` |
| Role and ownership rules | `infra/lambda/companies/authorize.mjs` |
| Role rules in table form | `docs/permission-matrix.md` |
| End-to-end check against AWS | `infra/verify-auth.mjs` |

## Test accounts

Five accounts exist in the pool, all `CONFIRMED`:

| Email | Intended role | `app_users` row |
|---|---|---|
| `student1@example.com` | STUDENT (student) | yes |
| `advisor1@example.com` | ADVISOR (teacher / อาจารย์ที่ปรึกษา) | yes |
| `staff1@example.com` | STAFF (co-op office) | yes |
| `admin1@example.com` | ADMIN | yes |
| `nobody1@example.com` | none, on purpose | **no** |

`nobody1@` is a fixture, not an oversight. It is the only way to exercise the
"authenticated but not authorised" path: a real, confirmed Cognito account
that no admin has given a role to, which is the normal state of a brand-new
sign-up. `verify:auth` signs in as it and expects 403. Leave it unmapped —
`db:seed-users` skips it, because the address matches no role rule.

All five share one password, which is **not written down in this repository**.
Ask the team for it, or set your own with the `admin-set-user-password` recipe
below. `#99` requires that no credential be committed, and a throwaway lab
password is still a credential — so the scripts that sign in take it as an
argument or in `COOP_TEST_PASSWORD`:

```bash
COOP_TEST_PASSWORD='...' npm run verify:auth
COOP_TEST_PASSWORD='...' npm run verify:roles
```

These are demo accounts in a lab pool with a deliberately relaxed password
policy, so they are quick to type while marking. That relaxed policy is not a
pattern to reuse anywhere real.

The "intended role" column describes what each account is set up as, but the
role itself comes from the account's `app_users` row, not from Cognito. The
rows are created by `npm run db:seed-users`, which reads each `sub` from the
pool at run time — a rebuilt pool mints new subs, so re-run it after one.

Change a password:

```bash
POOL=$(terraform -chdir=infra/terraform output -raw cognito_user_pool_id)
aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL" --username student1@example.com \
  --password 'newpassword' --permanent
```

`--permanent` matters: without it the account lands in
`NEW_PASSWORD_REQUIRED`, and the login form has no screen for that challenge.

Add an account: `docs/cognito-setup.md` has the `admin-create-user` recipe.

## How an account is matched to a person

Cognito answers *who is this*; the database answers *what may they do*. The
join between the two is the `sub` claim, and only the `sub` claim.

### The rule

`app_users.cognito_sub` is the primary key, and it holds the `sub` from the
token. `auth.mjs` looks up exactly that, with the value bound as a parameter:

```sql
SELECT cognito_sub, role, student_id, is_active FROM app_users WHERE cognito_sub = $1
```

A STUDENT row additionally carries `student_id`, which is what links the
account to a row in `students` and therefore to their coop plan. A database
constraint refuses a STUDENT row with no `student_id`, because such an account
would see an empty list rather than the misconfiguration it is.

`npm run db:seed-users` writes these rows for the demo accounts, reading each
`sub` from the pool at run time. A rebuilt pool mints new subs, so it has to be
re-run after one.

### Why not match on email

Email is stored in `app_users` and is the sign-in attribute, but nothing
resolves identity through it. Two reasons:

- A user can change their email in the identity provider. The `sub` never
  changes, so a row keyed on `sub` survives it.
- Matching `students.email` to a token's email claim would mean anyone who can
  get a Cognito account at a given address inherits that student's plan. The
  link has to be granted deliberately, by an admin writing the row.

The email column exists so a human reading the table can tell whose row it is.

### What happens in each case

| Situation | Answer | Why |
|---|---|---|
| No token, or the signature, issuer, `aud` or `exp` fails | **401** | Refused by the API Gateway authorizer; the Lambda never runs |
| Valid token, no `app_users` row for that `sub` | **403** | Authenticated, but holds no permission yet |
| Valid token, row exists with `is_active = false` | **403** | Same: the account is known and currently not allowed |
| Valid token, active row, role has no access to the route | **403** | `authorize.mjs`; see `docs/permission-matrix.md` |
| Valid token, active row, role allows it | **200** | Scoped to what that role may see |
| `app_users` table missing, or the database unreachable | **500** | A server fault, not the caller's problem |

An unmapped account is the normal state for a brand-new sign-up: the account
exists, and an admin has not yet given it a role. 403 says exactly that.
Answering 401 instead would tell the person their password was wrong, sending
them to re-enter credentials that were fine.

### Email mismatch is not an error

The Cognito email and `students.email` are allowed to differ, and nothing
checks them against each other. A student may sign in with a personal address
while the registry holds their university one. The `student_id` on the
`app_users` row is the authority on who they are; the two email fields are
labels, not identity.

### Nothing is taken from the request body or query string

`student_id` arriving as a query parameter is caller-supplied data. It may act
as a filter that narrows what the caller can already see, never as a claim
about who they are — the role filter is ANDed in alongside it. Proven against
the deployed API in `docs/evidence/100-05-student-id-not-trusted.txt`.

## Knobs you can turn

### `.env` (gitignored, frontend only)

| Variable | What it is |
|---|---|
| `VITE_API_URL` | API Gateway base URL, no trailing slash |
| `VITE_COGNITO_USER_POOL_ID` | which pool to sign in against |
| `VITE_COGNITO_CLIENT_ID` | the public SPA app client |

All three come from `terraform output`; `npm run env:sync` writes them for
you. None is a secret — a public SPA client has no client secret and all three
are compiled into the shipped bundle. They live in `.env` because they differ
per stack. Vite reads the file only at startup, so restart `npm run dev` after
editing it.

### `infra/terraform/cognito.tf`

| Setting | Current | Notes |
|---|---|---|
| `password_policy` | 8 chars, no character classes | Relaxed for the demo. Tighten before any real use — the sign-in endpoint is public. |
| `id_token_validity` | 60 minutes | Lower it to exercise the refresh path sooner. |
| `refresh_token_validity` | 30 days | How long a user stays signed in across reloads. |
| `explicit_auth_flows` | SRP + refresh | Leaving `USER_PASSWORD_AUTH` out is why the AWS CLI cannot mint a token for these accounts. Keep it that way. |
| `username_attributes` | `["email"]` | Sign-in is by email, so email is the unique identifier. |

### `infra/terraform/apigateway.tf`

Routes opt into the authorizer one at a time. Today only `GET /coop-plans` and
`GET /coop-plans/{planId}` do, because they are the only routes carrying
personal data. Adding `authorizer_id` + `authorization_type = "JWT"` to a route
makes it require a token; companies, positions, coop-info and periods stay
public on purpose.

### `infra/lambda/companies/authorize.mjs`

The role rules themselves. Edit here and `docs/permission-matrix.md` together,
or the matrix stops describing the running system.

## Room for University SSO later

Issue #99 asks that the structure allow a university identity provider to be
added through Cognito later, without requiring it now. Three things keep that
door open, and they are the reason the pieces are arranged this way:

**The pool is the seam, not the login form.** A SAML or OIDC provider is
attached to the existing user pool as an identity provider. Federated users
land in the same pool and receive tokens with the same `iss` and `aud`, so
`infra/terraform/apigateway.tf` and the authorizer need no change at all.

**Identity is a `sub`, not a password.** Nothing downstream knows how the user
proved who they are. `auth.mjs` reads the `sub` claim and looks up `app_users`;
a federated account gets a row exactly the way a native one does. No handler,
and no part of `authorize.mjs`, would need touching.

**Sign-in is isolated in one file.** `src/auth/cognitoClient.ts` is the only
place that calls `amazon-cognito-identity-js`. Federation uses the Hosted UI
redirect flow rather than SRP, so that file would gain a second path and the
pool would need a domain and callback URLs. `AuthContext`, `ProtectedRoute`,
`Login.tsx` and every API caller read the session through the same interface
and would be unaffected.

What is deliberately *not* done yet: no Hosted UI domain, no callback URLs, no
identity providers configured in `cognito.tf`. Adding them is the work; the
shape above is what keeps it from becoming a rewrite.

## How it was verified

```bash
npm test                 # 168 tests, 18 files
npm run verify:auth      # identity, against the deployed stack
npm run verify:roles     # the permission matrix, against the deployed stack
npm run verify:scope     # a caller-supplied student_id cannot widen scope
```

The three `verify:*` scripts need the test-account password, which is not in
this repository: `COOP_TEST_PASSWORD='...' npm run verify:auth`.

`verify:auth` reads the API URL and pool ids from Terraform outputs, then
checks: public routes answer 200 with no token; coop-plan routes answer 401
with no token and 401 with a forged token; a real SRP sign-in produces a token
whose `aud` is the SPA client and whose `email` claim matches; and the unmapped
`nobody1@` account answers 403 on both coop-plan routes. Last run: all checks
passed.

### Why there is no test for an expired token

The criteria list "no token, forged, or expired" as the three cases that must
answer 401. The first two are scripted. An expired one is not, and cannot
honestly be: minting a token with a past `exp` needs Cognito's signing key, and
a hand-made one is rejected at the signature check before `exp` is ever read —
it would be the forged case again under a different name, proving nothing new.

What the script does instead is print the `iat` and `exp` of a real token and
assert the lifetime is finite and no more than 60 minutes. That shows the
authorizer is handed a token with a real expiry to enforce, and an expired one
fails the same authorizer check as the forged one, on `exp` rather than on
signature. The browser side of the rule — a session that cannot refresh sends
the user back to the login form — is captured in
`docs/evidence/99-09-after-token-expiry-signed-out.jpg`.

Proving it end to end would mean holding a token for over an hour and
replaying it. Worth doing once if a reviewer asks; it is not something to put
in a script that should finish in seconds.

It also prints the status of the coop-plan routes *with* a valid token without
grading it, because the right answer there depends on whether that `sub` has
an `app_users` row: 500 while the table is absent, 403 once it exists but the
sub is unmapped, 200 when mapped. Both now answer 200.

`verify:roles` goes further and signs in as all four accounts in turn, then
calls `GET /coop-plans`, the student's own plan and another student's plan with
each token. Last run: all twelve rows match `docs/permission-matrix.md` —
student sees 1 plan and is refused the other, advisor sees only the student
assigned to them, staff sees all 10 and may open any, admin is refused all
three. Saved output is in `docs/evidence/`.

## Bringing the database side up

Identity resolution needs the `app_users` and `advisor_student_assignments`
tables, which arrive with the V3 migration. On a fresh stack, in order:

```bash
npm run db:load          # V2 schema + seed data
npm run db:migrate-v3    # adds the V3 tables
npm run db:seed-users    # one app_users row per Cognito test account
```

The middle step belongs to V3-03.1 (#98) and arrives with that branch, along
with `docs/v3_database_migration_guide.md`. Until it is merged, run the
upgrade script from that branch by hand.

Until `app_users` exists, a valid token answers 500, with this in CloudWatch:

```
listCoopPlans auth failed error: relation "app_users" does not exist
```

That is the designed behaviour, not a bug: a missing table is a server fault,
and answering 401 would tell a signed-in user their credentials were rejected
while hiding an outage.

## If every route starts answering 500

Including the public ones — that is the Lambda failing to reach the database,
not an auth problem. Check CloudWatch for the host it is dialling:

```
Error: getaddrinfo ENOTFOUND coop-portal-rds-proxy.proxy-....rds.amazonaws.com
```

A host that is not `rds_endpoint` means the deployed Lambda's `DB_HOST` is
stale — the RDS Proxy was removed, and `lambda.tf` now points straight at the
instance. `terraform apply` in `infra/terraform` reconciles it. The same
symptom appears if `my_ip_cidr` in `terraform.tfvars` is no longer your
address, except that one only breaks local `psql`, never the Lambda.
