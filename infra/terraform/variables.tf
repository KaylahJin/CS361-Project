variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = <<-EOT
    Prefix for every resource name this stack creates. REQUIRED, with no
    default on purpose — pick your own (e.g. "dev1", "team-a").

    Why there is no default: AWS rejects duplicate security group, RDS
    instance, secret, and Lambda names within the same account/VPC, and
    everyone on this project shares one account. A shared default means
    the second person to run `terraform apply` fails partway through with
    "already exists" and is left with a half-built stack to clean up by
    hand. A per-person prefix gives each of you a complete, independent
    stack you can apply and destroy without touching anyone else's.

    Keep it, and your terraform.tfstate, stable — changing it after an
    apply tells Terraform to destroy and recreate every resource,
    including the database.
  EOT
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,19}$", var.name_prefix))
    error_message = "name_prefix must start with a lowercase letter, contain only lowercase letters/digits/hyphens, and be 2-20 characters (leaves room for suffixes like -companies-lambda-sg under AWS length limits)."
  }

  validation {
    condition     = !contains(["cs361", "cs361-tf", "your-name", "changeme", "change-me"], var.name_prefix)
    error_message = "Pick a prefix that is actually yours (your first name works). The placeholder from terraform.tfvars.example and the old shared cs361/cs361-tf names are rejected because they collide between teammates."
  }
}

variable "db_password" {
  description = "Master password for the RDS instance. Set via terraform.tfvars (gitignored) or TF_VAR_db_password — never give this a default."
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 8 && !can(regex("[/@\" ]", var.db_password))
    error_message = "RDS password must be 8+ chars and must not contain / @ \" or spaces."
  }

  validation {
    condition     = !can(regex("(?i)change.?me", var.db_password))
    error_message = "db_password is still the placeholder from terraform.tfvars.example. Set a real password in terraform.tfvars (gitignored)."
  }
}

variable "my_ip_cidr" {
  description = "Your current public IP in CIDR form (e.g. 1.2.3.4/32), for direct psql access to the dev DB. Get it with: curl -s https://checkip.amazonaws.com"
  type        = string

  validation {
    condition     = can(regex("^(\\d{1,3}\\.){3}\\d{1,3}/\\d{1,2}$", var.my_ip_cidr))
    error_message = "my_ip_cidr must be an IPv4 CIDR like 1.2.3.4/32 (note the /32 suffix — a bare IP isn't valid here)."
  }
}

variable "cors_allow_origin" {
  description = "Origin allowed to call the API from a browser (the Vite dev server by default)"
  type        = string
  default     = "http://localhost:5173"
}

variable "lab_role_name" {
  description = <<-EOT
    Existing IAM role reused as BOTH the Lambda execution role and the RDS
    Proxy role. AWS Academy Learner Lab accounts (voclabs) block
    iam:CreateRole, so this stack deliberately creates no roles of its own
    and looks this one up instead (data.tf -> data.aws_iam_role.lab_role).

    The role must already have:
      - AWSLambdaVPCAccessExecutionRole (or equivalent ENI permissions), or
        every VPC Lambda invocation times out
      - secretsmanager:GetSecretValue on the proxy's secret
      - a trust policy allowing both lambda.amazonaws.com and
        rds.amazonaws.com to assume it
    LabRole satisfies all three. Check with:
      aws iam list-attached-role-policies --role-name LabRole

    Not on a Learner Lab and want least-privilege roles created for you?
    Add your own aws_iam_role resources and point the `role_arn` in
    proxy.tf and the `role` in lambda.tf at them instead of this lookup.
  EOT
  type        = string
  default     = "LabRole"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "coop_db"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "postgres"
}
