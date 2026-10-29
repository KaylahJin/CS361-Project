resource "aws_apigatewayv2_api" "companies" {
  name          = "${var.name_prefix}-companies-api"
  protocol_type = "HTTP"

  # Native API Gateway CORS — the thing that was silently null in the
  # console-built version even though the setup doc said to configure it.
  # Declaring it here means `terraform plan` shows it; it can't be skipped.
  cors_configuration {
    # Dev server and deployed site. Browsers match Origin exactly, so the
    # hosted site needs its own entry. local.web_url is built in s3_web.tf.
    allow_origins = [
      var.cors_allow_origin,
      local.web_url,
    ]
    allow_methods = ["GET", "POST", "PATCH", "OPTIONS"]
    # `authorization` has to be listed: the browser sends the ID token in that
    # header, and a header missing here fails the preflight before the real
    # request is sent. That shows up as a CORS error, not a 401, which is easy
    # to mistake for an auth bug.
    allow_headers = ["content-type", "authorization"]
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.companies.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.companies.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "list_companies" {
  api_id    = aws_apigatewayv2_api.companies.id
  route_key = "GET /companies"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_company" {
  api_id    = aws_apigatewayv2_api.companies.id
  route_key = "GET /companies/{companyId}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "list_positions" {
  api_id    = aws_apigatewayv2_api.companies.id
  route_key = "GET /positions"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "list_coop_info" {
  api_id    = aws_apigatewayv2_api.companies.id
  route_key = "GET /coop-info"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "get_position" {
  api_id    = aws_apigatewayv2_api.companies.id
  route_key = "GET /positions/{positionId}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# index.mjs has routed 'GET /periods' to listPeriods for a while, but no API
# Gateway route pointed at it, so every request 404'd at the edge.
resource "aws_apigatewayv2_route" "list_periods" {
  api_id    = aws_apigatewayv2_api.companies.id
  route_key = "GET /periods"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Student records are personal data in every column, so these two require a
# token like the coop-plan routes do. Which routes must is declared in
# route-policy.mjs and checked by route-policy.test.mjs — add a route here
# without declaring it there and that test fails.
resource "aws_apigatewayv2_route" "list_students" {
  api_id             = aws_apigatewayv2_api.companies.id
  route_key          = "GET /students"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "get_student" {
  api_id             = aws_apigatewayv2_api.companies.id
  route_key          = "GET /students/{studentId}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

# Everything above the student routes stays public on purpose: announcements,
# criteria and job positions must be readable without logging in.
resource "aws_apigatewayv2_route" "list_coop_plans" {
  api_id             = aws_apigatewayv2_api.companies.id
  route_key          = "GET /coop-plans"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "get_coop_plan" {
  api_id             = aws_apigatewayv2_api.companies.id
  route_key          = "GET /coop-plans/{planId}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "create_coop_plan" {
  api_id             = aws_apigatewayv2_api.companies.id
  route_key          = "POST /coop-plans"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "update_coop_plan" {
  api_id             = aws_apigatewayv2_api.companies.id
  route_key          = "PATCH /coop-plans/{planId}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "submit_coop_plan" {
  api_id             = aws_apigatewayv2_api.companies.id
  route_key          = "POST /coop-plans/{planId}/submit"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_route" "review_coop_plan" {
  api_id             = aws_apigatewayv2_api.companies.id
  route_key          = "POST /coop-plans/{planId}/review"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.companies.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_route" "request_attachment_upload" {
  api_id             = aws_apigatewayv2_api.companies.id
  route_key          = "POST /coop-plans/{planId}/attachments/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito_jwt.id
}