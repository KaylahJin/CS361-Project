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
npm run env:sync                               # point local dev at the new API
npm run web:deploy                             # build + publish the site to S3
```

`web:deploy` prints the public site URL (`terraform output -raw web_url`). It
also creates and configures the S3 bucket — that bucket is deliberately NOT a
Terraform resource, because this account's SCP denies the object-lock read
`aws_s3_bucket` performs. Details in `s3_web.tf`. `terraform destroy` leaves
the bucket behind; remove it with `npm run web:deploy -- --destroy`.

Never commit `terraform.tfvars`, `terraform.tfstate`, or a saved plan file —
all three contain the database password in plaintext. `.gitignore` covers them.
