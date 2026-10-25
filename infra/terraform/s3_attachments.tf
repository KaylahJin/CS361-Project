locals {
  attachments_bucket = "${var.name_prefix}-coop-attachments-${data.aws_caller_identity.current.account_id}"
}