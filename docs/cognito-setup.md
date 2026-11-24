# Cognito User Pool setup (V3-02.1)

Infrastructure is defined in `infra/terraform/cognito.tf` and provisioned through Terraform. This guide explains the additional steps required to configure test accounts and assign application roles after the infrastructure has been created, so any teammate can reproduce the Cognito setup.

## What Terraform creates

| Resource | Name | Purpose |
|---|---|---|
| `aws_cognito_user_pool.app` | `<name_prefix>-users` | the account directory |
| `aws_cognito_user_pool_client.spa` | `<name_prefix>-spa-client` | public SPA client, SRP auth, no secret |
| `aws_apigatewayv2_authorizer.cognito_jwt` | `<name_prefix>-cognito-jwt` | validates the token at API Gateway (added in V3-02.2) |

Deliberately **not** created: no `aws_cognito_user_pool_domain`, no Hosted
UI. The React app calls Cognito directly through
`amazon-cognito-identity-js`, so there is no redirect flow and no callback
URL to configure.

Application roles (`STUDENT`, `ADVISOR`, `STAFF`, `ADMIN`, and optionally `COMMITTEE`) are **not** Cognito groups. They are stored in `app_users.role` in the application database and assigned through administrator-approved Cognito `sub` values using `npm run db:seed-users`.

Cognito is responsible for user authentication, while the application database determines each user's role and permissions. An authenticated Cognito account without an approved `app_users` mapping cannot access protected application resources.

Cognito answers only "who is this"; the application answers "what may they do".

## Apply

```bash
terraform -chdir=infra/terraform apply
```

Requires a live AWS Academy Lab session — run `aws sts get-caller-identity`
first; Lab credentials expire every few hours and every Terraform command
fails with `ExpiredToken` once they do.

## After apply

### 1. Sync frontend environment variables

After Terraform finishes successfully, run the environment synchronization script from the repository root:

```bash
npm run env:sync
```

The script reads the latest Terraform outputs and updates the following variables in the root `.env` file:

| Environment variable | Terraform output |
|---|---|
| `VITE_API_URL` | `api_url` |
| `VITE_COGNITO_USER_POOL_ID` | `cognito_user_pool_id` |
| `VITE_COGNITO_CLIENT_ID` | `cognito_user_pool_client_id` |

The script only updates these three variables and preserves other existing environment variables.

Both Cognito IDs are public configuration values, not secrets. The SPA App Client has no client secret, and Vite includes these values in the frontend build.

Run `npm run env:sync` again after Terraform recreates the API or Cognito User Pool. Restart the Vite development server after synchronization because environment variables are loaded at startup.

### 2. Create test accounts

Public self-sign-up is disabled. All test accounts must be created by an administrator using the AWS CLI.

First, retrieve the User Pool ID:

```bash
POOL_ID=$(terraform -chdir=infra/terraform output -raw cognito_user_pool_id)
```

Create the four administrator-approved test accounts:

| Email | Intended application role |
|---|---|
| `student1@example.com` | STUDENT |
| `advisor1@example.com` | ADVISOR |
| `staff1@example.com` | STAFF |
| `admin1@example.com` | ADMIN |

Create each account using:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username student1@example.com \
  --message-action SUPPRESS \
  --user-attributes \
    Name=email,Value=student1@example.com \
    Name=email_verified,Value=true
```

Repeat the command for the other accounts, replacing the username and email accordingly.

If an account already exists, do not create it again.

Set a permanent password for each account:

```bash
read -rs -p "Enter a password: " USER_PASSWORD
echo

aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username student1@example.com \
  --password "$USER_PASSWORD" \
  --permanent

unset USER_PASSWORD
```

Repeat for each account using a different password.

Passwords must satisfy the policy defined in `infra/terraform/cognito.tf`:

- At least 12 characters.
- At least one lowercase letter.
- At least one uppercase letter.
- At least one number.
- At least one symbol.

The permanent password avoids the `NEW_PASSWORD_REQUIRED` challenge, which the current frontend login flow does not implement.

Also create `nobody1@example.com` as an additional test account. Give it a distinct password, but do not assign it an application role or insert it into `app_users`. This account is used by `npm run verify:auth` to test that a valid Cognito identity without an application mapping receives HTTP 403.

### 3. Map Cognito identities to application roles

Cognito authentication and application authorization are separate responsibilities.

Cognito identifies the user, while the application's PostgreSQL database determines the user's role through `app_users.role`.

After creating the accounts, retrieve their Cognito `sub` values:

```bash
aws cognito-idp admin-get-user \
  --user-pool-id "$POOL_ID" \
  --username student1@example.com \
  --query 'UserAttributes[?Name==`sub`].Value | [0]' \
  --output text
```

Repeat for each approved account.

Set the approved identities in the same shell used to run the database seed script:

```bash
export COOP_APPROVED_STUDENT_SUB='<student-cognito-sub>'
export COOP_APPROVED_ADVISOR_SUB='<advisor-cognito-sub>'
export COOP_APPROVED_STAFF_SUB='<staff-cognito-sub>'
export COOP_APPROVED_ADMIN_SUB='<admin-cognito-sub>'
```

If the COMMITTEE role is required, optionally configure:

```bash
# Optional: only when an approved COMMITTEE account exists
export COOP_APPROVED_COMMITTEE_SUB='<committee-cognito-sub>'
```

Only configure this variable when a corresponding administrator-approved COMMITTEE account exists.

Before seeding, ensure the database schema and V3 migrations have been applied:

```bash
npm run db:load
npm run db:migrate-v3
```

Then run:

```bash
npm run db:seed-users
```

The script validates the approved Cognito identities against the configured User Pool before updating `app_users`.

Important:
- Roles are assigned using explicitly approved Cognito `sub` values, not email addresses.
- The approved `sub` values must be distinct.
- The STUDENT account is linked to the configured student record.
- Accounts without an approved mapping remain unauthorized.
- After recreating the User Pool or an account, verify the new `sub` values and update the approved environment variables before running the seed script again.

Never commit Cognito passwords or personal credentials to the repository.

### 4. Verify authentication

Set the account-specific passwords in the current shell:

```bash
export COOP_STUDENT_PASSWORD='<student-password>'
export COOP_ADVISOR_PASSWORD='<advisor-password>'
export COOP_STAFF_PASSWORD='<staff-password>'
export COOP_ADMIN_PASSWORD='<admin-password>'
export COOP_UNMAPPED_PASSWORD='<unmapped-account-password>'
```

Run the authentication verification:

```bash
npm run verify:auth
```

The verification script checks:

- Public routes are accessible without an authentication token.
- Protected routes reject requests without a token.
- Protected routes reject forged tokens.
- A valid Cognito account can authenticate through SRP.
- The ID token contains the expected client audience and email.
- An authenticated account without an `app_users` mapping receives HTTP 403.

For role-based authorization checks, run:

```bash
npm run verify:roles
```

The verification scripts require the relevant test account passwords. Never commit these values to the repository.

See [`docs/v3-02-auth.md`](v3-02-auth.md) for details about the authentication flow, role assignment, and authorization rules.

## AWS Academy Lab limitations

If `admin-create-user` or another Cognito admin operation is denied by
`LabRole`, record the exact error and investigate the permissions available
in the current lab. Do not enable public self-sign-up as a workaround:
account creation must remain administrator-controlled. If the required
admin operations are unavailable, document the limitation and coordinate
with the team before changing the authentication design.

Known Lab constraint already hit by this stack: no CloudFront permissions
at all, which is why the site is an HTTP-only S3 website endpoint
(`infra/terraform/s3_web.tf`).
