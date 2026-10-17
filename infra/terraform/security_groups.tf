# Two security groups: the Lambda talks straight to RDS. The RDS Proxy that
# used to sit between them is gone — it cost a 5-minute wait on every apply and
# bought nothing at this traffic level, and the team agreed to drop it.
#
# Both descriptions still mention the proxy. A security group description
# cannot be edited in place, so changing this text makes Terraform destroy and
# recreate the group — and deleting a group attached to a VPC Lambda waits on
# AWS detaching the function's ENIs, which has taken well over ten minutes.
# The stale wording is not worth that: leave it until the groups are replaced
# for some other reason.

resource "aws_security_group" "lambda" {
  name        = "${var.name_prefix}-companies-lambda-sg"
  description = "Companies Lambda - outbound to RDS Proxy only"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_security_group" "rds" {
  name        = "${var.name_prefix}-coop-db-sg"
  description = "coop-db-dev - inbound from RDS Proxy and dev IP"
  vpc_id      = data.aws_vpc.default.id
}

# Lambda -> RDS
resource "aws_security_group_rule" "lambda_egress_to_rds" {
  type                     = "egress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.lambda.id
  source_security_group_id = aws_security_group.rds.id
  description              = "To RDS"
}

resource "aws_security_group_rule" "rds_ingress_from_lambda" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.lambda.id
  description              = "From Lambda"
}

# Dev-only direct psql access — same as the manual "My IP" rule. Update
# my_ip_cidr whenever your public IP changes, or psql hangs until it times out.
resource "aws_security_group_rule" "rds_ingress_from_dev_ip" {
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  security_group_id = aws_security_group.rds.id
  cidr_blocks       = [var.my_ip_cidr]
  description       = "Dev direct access"
}
