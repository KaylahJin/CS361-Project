# RDS Proxy (secrets.tf's auth block in proxy.tf) authenticates clients
# against this secret, not just any password — see proxy.tf's comment.
resource "aws_secretsmanager_secret" "db" {
  name = "${var.name_prefix}-coop-db-credentials"

  # Secrets Manager does not delete a secret immediately — it schedules it and
  # keeps the NAME reserved for a recovery window, 30 days by default. That
  # makes `terraform destroy` followed by `terraform apply` fail on the second
  # run with:
  #   InvalidRequestException: You can't create this secret because a secret
  #   with this name is already scheduled for deletion.
  # and the only fixes are waiting out the window or an out-of-band
  # `aws secretsmanager delete-secret --force-delete-without-recovery`. This is
  # a dev stack that gets torn down and rebuilt constantly (Learner Lab
  # sessions reset on their own), so take the immediate delete instead.
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password
  })
}
