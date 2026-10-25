output "api_url" {
  description = "Invoke URL for the companies API — set this as VITE_API_URL"
  value       = aws_apigatewayv2_api.companies.api_endpoint
}

output "rds_endpoint" {
  description = "RDS endpoint — DB_HOST for the Lambda, and what psql connects to"
  value       = aws_db_instance.coop_db.address
}

output "lambda_function_name" {
  value = aws_lambda_function.companies.function_name
}

# Consumed by infra/load-db.sh so the loader never has to be told the
# database name or user by hand. db_password is deliberately NOT an output —
# it would then show up in plaintext in any `terraform output` dump.
output "db_name" {
  value = var.db_name
}

output "db_username" {
  value = var.db_username
}

# ---- Frontend hosting (s3_web.tf) ----

# deploy-web.sh creates and configures this bucket; Terraform only computes
# its name. See s3_web.tf.
output "web_bucket_name" {
  description = "S3 bucket serving the built frontend (created by npm run web:deploy)"
  value       = local.web_bucket
}

output "web_url" {
  description = "Public URL of the deployed site (HTTP only — S3 website endpoints do not do TLS)"
  value       = local.web_url
}

# deploy-web.sh needs it: CreateBucket requires a LocationConstraint
# everywhere except us-east-1, which rejects it.
output "aws_region" {
  value = var.aws_region
}

# ---- Auth (cognito.tf) ----

# The first two go into .env as VITE_COGNITO_USER_POOL_ID and
# VITE_COGNITO_CLIENT_ID (see docs/cognito-setup.md). Neither is a secret:
# a public SPA client has no secret, and both ship inside the built bundle.
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID — set this as VITE_COGNITO_USER_POOL_ID"
  value       = aws_cognito_user_pool.app.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito SPA App Client ID — set this as VITE_COGNITO_CLIENT_ID"
  value       = aws_cognito_user_pool_client.spa.id
}

output "cognito_issuer" {
  description = "Token issuer URL — what the API Gateway JWT authorizer validates against"
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.app.id}"
}

# ---- Attachments (s3_attachments.tf) ----

output "attachments_bucket_name" {
  description = "Private S3 bucket for plan attachments (created by npm run attachments:deploy)"
  value       = local.attachments_bucket
}

# deploy-attachments-bucket.sh needs both browser origins for the bucket CORS.
output "cors_allow_origin" {
  value = var.cors_allow_origin
}