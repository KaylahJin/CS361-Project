resource "aws_db_proxy" "main" {
  name                   = "${var.name_prefix}-rds-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = data.aws_iam_role.lab_role.arn
  vpc_security_group_ids = [aws_security_group.rds_proxy.id]
  vpc_subnet_ids         = data.aws_subnets.default.ids
  require_tls            = false # confirmed against the live setup — the client never negotiates TLS, so this must stay false or every connection gets dropped

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db.arn
  }

  # RDS Proxy doesn't support every AZ in every account (us-east-1e has been
  # observed silently dropped here, twice, across two independent creates).
  # AWS decides which of our subnets it actually uses, not us — re-sending
  # the full data.aws_subnets.default.ids list would otherwise show a
  # permanent, un-fixable diff and force a destroy+recreate on every single
  # `apply`, for every teammate, forever.
  lifecycle {
    ignore_changes = [vpc_subnet_ids]
  }
}

resource "aws_db_proxy_default_target_group" "main" {
  db_proxy_name = aws_db_proxy.main.name

  connection_pool_config {
    max_connections_percent      = 100
    max_idle_connections_percent = 50
    connection_borrow_timeout    = 120
  }
}

# This is the step that's easy to forget in the console (see
# project-setup-guide.md 4c) and the one that actually broke the live API
# the first time around: a proxy with no registered target accepts TCP
# connections and drops them instantly, which looks exactly like a
# credentials or TLS problem but isn't.
resource "aws_db_proxy_target" "main" {
  db_proxy_name          = aws_db_proxy.main.name
  target_group_name      = aws_db_proxy_default_target_group.main.name
  db_instance_identifier = aws_db_instance.coop_db.identifier
}

# Registering the target doesn't mean it's usable yet — it goes
# REGISTERING -> UNAVAILABLE (PENDING_PROXY_CAPACITY) -> AVAILABLE, and the
# middle state was observed taking ~4 minutes. Nothing in the AWS provider
# blocks `apply` on that transition, so this makes it explicit instead of
# letting the first Lambda invocation hit an still-scaling proxy.
resource "time_sleep" "wait_for_proxy_target" {
  depends_on      = [aws_db_proxy_target.main]
  create_duration = "5m"
}
