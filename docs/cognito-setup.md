# Cognito User Pool setup (V3-02.1)

Infra is defined in `infra/terraform/cognito.tf`. This doc covers the
one-time manual steps `terraform apply` does not do for you, so any
teammate can reproduce the pool from scratch.

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

Roles (`STUDENT` / `ADVISOR` / `STAFF` / `ADMIN`) are **not** Cognito
groups. Per `docs/overview/V3-01-data-model.md` they live in
`app_users.role` in the application database and are assigned by an Admin.
Cognito answers only "who is this"; the app answers "what may they do".

## Apply

```bash
terraform -chdir=infra/terraform apply
```

Requires a live AWS Academy Lab session — run `aws sts get-caller-identity`
first; Lab credentials expire every few hours and every Terraform command
fails with `ExpiredToken` once they do.

## After apply

1. Copy the outputs into `.env` (gitignored):

   ```bash
   terraform -chdir=infra/terraform output -raw cognito_user_pool_id
   terraform -chdir=infra/terraform output -raw cognito_user_pool_client_id
   ```

   ```
   VITE_COGNITO_USER_POOL_ID=<cognito_user_pool_id>
   VITE_COGNITO_CLIENT_ID=<cognito_user_pool_client_id>
   ```

   Neither value is a secret — a public SPA client has no client secret and
   both are compiled into the shipped JavaScript bundle. They live in `.env`
   because they differ per stack, not because they need protecting.

2. Create the allowlisted test users for manual QA. Public self-sign-up is
   disabled; an administrator must create accounts through Cognito admin
   operations. The test accounts are `student1@example.com`,
   `advisor1@example.com`, `staff1@example.com`, and
   `admin1@example.com`.

   Create each account with `aws cognito-idp admin-create-user`, using
   `--message-action SUPPRESS` and setting `email_verified=true`. Then set
   a permanent password with `aws cognito-idp admin-set-user-password`
   so the SPA does not encounter the unsupported `NEW_PASSWORD_REQUIRED`
   challenge.

   Choose a **different password for each account** that satisfies the
   password policy in `infra/terraform/cognito.tf` (at least 12 characters,
   including lowercase, uppercase, numbers, and symbols). Do not commit
   passwords to the repository or share them in source files. Share
   credentials only through an appropriate private channel.

   Repeat for all four accounts to exercise the permission matrix in
   `docs/permission-matrix.md`.

3. Role assignment means inserting the matching `app_users` row. The tables
   arrived with issue #98 (V3-03.1), and `npm run db:seed-users` writes a row
   for each demo account. An account with no row authenticates successfully
   — API Gateway accepts the token — and then the API answers `403`: known
   caller, no permission yet. That is the designed behaviour, not a bug, and
   it is the normal state of a new account before an admin grants it a role.
   `nobody1@example.com` is kept unmapped on purpose so this path stays
   testable; see `docs/v3-02-auth.md`.

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
