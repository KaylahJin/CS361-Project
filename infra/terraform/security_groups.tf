# Three-SG chain, same order and purpose as project-setup-guide.md step 5.

resource "aws_security_group" "rds_proxy" {
  name        = "${var.name_prefix}-rds-proxy-sg"
  description = "RDS Proxy - inbound from Lambda, outbound to RDS"
  vpc_id      = data.aws_vpc.default.id
}

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

# Lambda -> Proxy
resource "aws_security_group_rule" "lambda_egress_to_proxy" {
  type                     = "egress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.lambda.id
  source_security_group_id = aws_security_group.rds_proxy.id
  description              = "To RDS Proxy"
}

resource "aws_security_group_rule" "proxy_ingress_from_lambda" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds_proxy.id
  source_security_group_id = aws_security_group.lambda.id
  description              = "From Lambda"
}

# Proxy -> RDS
resource "aws_security_group_rule" "proxy_egress_to_rds" {
  type                     = "egress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds_proxy.id
  source_security_group_id = aws_security_group.rds.id
  description              = "To RDS"
}

resource "aws_security_group_rule" "rds_ingress_from_proxy" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.rds.id
  source_security_group_id = aws_security_group.rds_proxy.id
  description              = "From RDS Proxy"
}

# Dev-only direct psql access — same as the manual "My IP" rule.
resource "aws_security_group_rule" "rds_ingress_from_dev_ip" {
  type              = "ingress"
  from_port         = 5432
  to_port           = 5432
  protocol          = "tcp"
  security_group_id = aws_security_group.rds.id
  cidr_blocks       = [var.my_ip_cidr]
  description       = "Dev direct access"
}
