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

2. Create one test user per role for manual QA:

   ```bash
   POOL=$(terraform -chdir=infra/terraform output -raw cognito_user_pool_id)

   aws cognito-idp admin-create-user \
     --user-pool-id "$POOL" \
     --username student1@example.com \
     --user-attributes Name=email,Value=student1@example.com Name=email_verified,Value=true \
     --message-action SUPPRESS

   # Make the password permanent so the login form does not hit the
   # NEW_PASSWORD_REQUIRED challenge (which the SPA does not implement).
   aws cognito-idp admin-set-user-password \
     --user-pool-id "$POOL" \
     --username student1@example.com \
     --password 'coop1234' \
     --permanent
   ```

   Repeat for `advisor1@`, `staff1@`, `admin1@` to exercise the full
   permission matrix in `docs/permission-matrix.md`.

   The pool's password policy is relaxed on purpose (8 characters, no
   character-class rules) so these demo passwords are quick to type during
   marking. **Tighten `password_policy` in `infra/terraform/cognito.tf`
   before any non-lab use** — the pool's sign-in endpoint is public.

3. Role assignment — inserting the matching `app_users` row — is blocked on
   issue #98 (V3-03.1), which creates the `app_users` and
   `advisor_student_assignments` tables. Until that lands, a Cognito account
   authenticates successfully (API Gateway returns a valid token) but
   `getAuthenticatedUser` finds no row and the API answers `401`. That is
   the designed behaviour, not a bug.

## AWS Academy Lab limitations

If `admin-create-user` or any `cognito-idp` admin call is denied by
`LabRole`, record the exact error here and fall back to self-service
sign-up (`CognitoUser.signUp` from the frontend) plus
`admin-confirm-sign-up`. That is the fallback plan ("แผนสำรอง") issue #99
asks to be documented before V3-02.2 starts.

Known Lab constraint already hit by this stack: no CloudFront permissions
at all, which is why the site is an HTTP-only S3 website endpoint
(`infra/terraform/s3_web.tf`).
