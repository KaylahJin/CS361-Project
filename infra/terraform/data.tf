# Default VPC — matches the manual setup guide (project-setup-guide.md step 3),
# which uses the account's default VPC rather than a custom one.
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Pre-existing IAM role (see variables.tf lab_role_name). Used as both the
# Lambda execution role and the RDS Proxy role, same as the manual setup.
data "aws_iam_role" "lab_role" {
  name = var.lab_role_name
}
