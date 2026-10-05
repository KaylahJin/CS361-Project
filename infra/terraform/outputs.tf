output "api_url" {
  description = "Invoke URL for the companies API — set this as VITE_API_URL"
  value       = aws_apigatewayv2_api.companies.api_endpoint
}

output "rds_endpoint" {
  description = "Raw RDS endpoint (NOT what the Lambda should use — that's rds_proxy_endpoint)"
  value       = aws_db_instance.coop_db.address
}

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint — this is DB_HOST for the Lambda"
  value       = aws_db_proxy.main.endpoint
}

output "lambda_function_name" {
  value = aws_lambda_function.companies.function_name
}

output "proxy_target_health_check_command" {
  description = "Run this after apply to confirm the proxy target reached AVAILABLE"
  value       = "aws rds describe-db-proxy-targets --db-proxy-name ${aws_db_proxy.main.name} --query \"Targets[0].TargetHealth\""
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
