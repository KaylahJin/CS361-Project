data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/companies"
  output_path = "${path.module}/.build/function.zip"

  excludes = [
    "index.test.mjs",
    "listCompanies.test.mjs",
    "getCompanyById.test.mjs",
    "function.zip",
  ]
}

resource "aws_lambda_function" "companies" {
  depends_on = [time_sleep.wait_for_proxy_target]

  function_name = "${var.name_prefix}-companies-lambda"
  role          = data.aws_iam_role.lab_role.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  timeout       = 10 # the AWS default of 3s isn't enough for a cold VPC ENI attach + proxy handshake
  memory_size   = 128

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  vpc_config {
    subnet_ids         = data.aws_subnets.default.ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      DB_HOST     = aws_db_proxy.main.endpoint
      DB_PORT     = "5432"
      DB_NAME     = var.db_name
      DB_USER     = var.db_username
      DB_PASSWORD = var.db_password
    }
  }
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.companies.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.companies.execution_arn}/*/*"
}
