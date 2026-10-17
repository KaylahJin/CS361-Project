# Cognito user pool for SPA login. No Hosted UI and no domain: the frontend
# talks to Cognito directly over SRP.
#
# Cognito only answers "who is this". The role (Student, Advisor, Staff, Admin)
# is not a Cognito group — it lives in app_users.role in the app database and
# is assigned by an admin.

resource "aws_cognito_user_pool" "app" {
  name = "${var.name_prefix}-users"

  auto_verified_attributes = ["email"]

  # Loose on purpose for the demo: the test accounts are typed into a login
  # form by hand. Tighten these (require_uppercase, require_numbers,
  # require_symbols) before any real use — this sign-in endpoint is reachable
  # from the public internet.
  password_policy {
    minimum_length    = 8
    require_lowercase = false
    require_uppercase = false
    require_numbers   = false
    require_symbols   = false
  }

  # Sign in by email, not a separate username: accounts are matched to
  # students.email, so email has to be unique anyway.
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

  # A public client cannot keep a secret safe, so it gets none.
  generate_secret = false

  # SRP only, so the password never crosses the wire. Leaving
  # ALLOW_USER_PASSWORD_AUTH out also means no tool can trade a password for a
  # token outside this flow.
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

# JWT authorizer on the HTTP API. API Gateway checks the token's signature,
# issuer, audience and expiry before the Lambda is invoked, so a missing,
# forged or expired token is refused at the edge — which is why auth.mjs does
# not verify the token itself.
#
# The audience is the SPA client id because the frontend sends the ID token.
#
# Routes opt into this one at a time in apigateway.tf rather than the whole
# API being covered, because the public content routes have to keep working
# with no token at all.

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
