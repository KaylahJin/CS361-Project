# ============================================================
# CS361 V3-02.1 — Cognito User Pool for SPA login
# ============================================================
# No Hosted UI, no domain: the frontend talks to Cognito directly via
# amazon-cognito-identity-js (SRP auth), so no aws_cognito_user_pool_domain
# is needed. Role (Student/Advisor/Staff/Admin) is NOT a Cognito group —
# per docs/overview/V3-01-data-model.md it lives in app_users.role in the
# app DB, assigned by an Admin. Cognito's only job here is "who is this".
# ============================================================

resource "aws_cognito_user_pool" "app" {
  name = "${var.name_prefix}-users"

  auto_verified_attributes = ["email"]

  # Deliberately permissive for the V3 demo: test accounts are created by
  # hand for each role (student/advisor/staff/admin) and typed into a login
  # form during marking, so a complex-password rule would only slow that
  # down. 8 characters is Cognito's practical floor for a pool that may
  # later be reused. TIGHTEN THIS (require_uppercase / require_numbers /
  # require_symbols = true) before any non-lab use — the pool's sign-in
  # endpoint is reachable from the public internet.
  password_policy {
    minimum_length    = 8
    require_lowercase = false
    require_uppercase = false
    require_numbers   = false
    require_symbols   = false
  }

  # Sign in with email rather than a separate username: the account-matching
  # rule in V3-02.2 pairs a Cognito account to students.email, so email is
  # the identifier that has to be unique anyway.
  username_attributes = ["email"]

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_client" "spa" {
  name         = "${var.name_prefix}-spa-client"
  user_pool_id = aws_cognito_user_pool.app.id

  # SPA: no client secret (a public client cannot keep one safe).
  generate_secret = false

  # SRP only — the password never crosses the wire. No ALLOW_USER_PASSWORD_AUTH.
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

# ============================================================
# V3-02.2 — JWT authorizer on the HTTP API
# ============================================================
# API Gateway validates signature, issuer, audience and expiry before the
# Lambda is ever invoked, so a missing/forged/expired token is rejected
# with 401 at the edge and never reaches our code. That is why
# infra/lambda/companies/auth.mjs does not verify the token itself.
#
# `audience` is the SPA App Client ID because the frontend sends the ID
# token (whose `aud` is the client id). An access token would need
# `scope`-based checks instead and carries no email claim.
#
# Attached to routes individually in apigateway.tf, not to the whole API:
# the public content routes (companies / positions / coop-info / periods)
# must keep working with no token at all, per
# docs/overview/V3-01-workflow-permissions.md §1 (Public role).
# ============================================================

resource "aws_apigatewayv2_authorizer" "cognito_jwt" {
  api_id           = aws_apigatewayv2_api.companies.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.name_prefix}-cognito-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.spa.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.app.id}"
  }
}
