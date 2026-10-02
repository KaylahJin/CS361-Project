# Terraform — Companies API stack

The setup and deploy guide for this directory lives at
[`docs/terraform-setup-guide.md`](../../docs/terraform-setup-guide.md).

Quick version, from the repo root:

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # set name_prefix, db_password, my_ip_cidr
terraform init
terraform apply                                # 12-18 min
cd ../..
npm run db:load                                # Terraform leaves the DB empty
npm run env:sync                               # point the frontend at the new API
```

Never commit `terraform.tfvars`, `terraform.tfstate`, or a saved plan file —
all three contain the database password in plaintext. `.gitignore` covers them.
