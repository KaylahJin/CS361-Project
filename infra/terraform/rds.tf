resource "aws_db_instance" "coop_db" {
  identifier     = "${var.name_prefix}-coop-db-dev"
  engine         = "postgres"
  engine_version = "16.15"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = true # dev only, matches project-setup-guide.md step 3

  skip_final_snapshot = true # dev convenience — seed.sql regenerates the data anyway

  tags = {
    Project = "cs361-companies"
  }
}
