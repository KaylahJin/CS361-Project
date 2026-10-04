# Frontend hosting — S3 static website.
#
# No Terraform resources here on purpose. This account's service control
# policy denies s3:GetBucketObjectLockConfiguration, and the AWS provider
# calls that API inside aws_s3_bucket's read — which runs after every create
# and on every refresh. So `apply` fails after creating the bucket, and every
# later `plan` fails too. Confirmed on provider v5.100.0 and v6.67.0.
#
# All S3 writes the site needs ARE allowed, so infra/deploy-web.sh creates and
# configures the bucket with the AWS CLI. Terraform keeps only the two derived
# values the API's CORS needs, so the two can't disagree.
#
# Consequences: `terraform destroy` leaves the bucket (remove it with
# `npm run web:deploy -- --destroy`), and `plan` does not see bucket drift —
# deploy-web.sh re-applies the full bucket config on every run instead.
#
# No CloudFront: this lab role has no CloudFront permissions at all, so the
# site is HTTP only. Fine here — browsers block an HTTPS page calling an HTTP
# API, not an HTTP page calling the HTTPS API.

locals {
  # Account ID included because bucket names are globally unique.
  web_bucket = "${var.name_prefix}-coop-web-${data.aws_caller_identity.current.account_id}"

  # Older regions spell the endpoint with a dash, newer ones with a dot.
  # Wrong form = hostname that doesn't resolve.
  s3_website_dash_regions = [
    "us-east-1", "us-west-1", "us-west-2", "eu-west-1",
    "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "sa-east-1",
  ]

  web_endpoint = contains(local.s3_website_dash_regions, var.aws_region) ? "${local.web_bucket}.s3-website-${var.aws_region}.amazonaws.com" : "${local.web_bucket}.s3-website.${var.aws_region}.amazonaws.com"

  # HTTP: S3 website endpoints don't serve TLS.
  web_url = "http://${local.web_endpoint}"
}
