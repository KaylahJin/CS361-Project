resource "aws_apigatewayv2_api" "companies" {
  name          = "${var.name_prefix}-companies-api"
  protocol_type = "HTTP"

  # Native API Gateway CORS — the thing that was silently null in the
  # console-built version even though the setup doc said to configure it.
  # Declaring it here means `terraform plan` shows it; it can't be skipped.
  cors_configuration {
    allow_origins = [var.cors_allow_origin]
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["content-type"]
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

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.companies.id
  name        = "$default"
  auto_deploy = true
}
