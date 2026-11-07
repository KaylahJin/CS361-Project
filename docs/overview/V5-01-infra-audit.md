# V5-01: รายงานการตรวจสอบ Infrastructure และ Automation (Infrastructure & Automation Audit)

> **Issue:** [#222 — [V5-01] ตรวจสอบ Infrastructure และ Automation](https://github.com/KaylahJin/CS361-Project/issues/222)  
> **Milestone:** V5 – Automation  
> **วัตถุประสงค์:** สำรวจรายการ Infrastructure Resources, Deployment Scripts, ขั้นตอนที่ยังต้องตั้งค่าด้วยมือ (Manual Steps), การจัดการ Environment/Secrets/Terraform State และข้อจำกัดของ AWS Academy เพื่อระบุช่องว่าง (Gaps) สำหรับดำเนินการต่อใน V5-02 ถึง V5-05

---

## 1. รายการ Infrastructure Resources แยกตามกลไกการจัดการ

### 1.1 Resources ที่จัดการด้วย Terraform (`infra/terraform/`)

| หมวดหมู่ | Terraform Resource / Data Source | ไฟล์กำหนดค่า | หน้าที่และการตั้งค่าสำคัญ |
|---|---|---|---|
| **VPC & Subnets** | `data.aws_vpc.default`, `data.aws_subnets.default`, `data.aws_route_tables.default` | [`infra/terraform/data.tf`](../terraform/data.tf), [`infra/terraform/security_groups.tf`](../terraform/security_groups.tf) | อ้างอิง Default VPC, Subnets และ Route Tables ของบัญชี AWS |
| **IAM & Identity** | `data.aws_iam_role.lab_role`, `data.aws_caller_identity.current` | [`infra/terraform/data.tf`](../terraform/data.tf) | อ้างอิง `LabRole` ที่มีอยู่แล้วใน AWS Academy และ Account ID สำหรับตั้งชื่อ Bucket ให้ไม่ซ้ำ |
| **Security Groups** | `aws_security_group.lambda`, `aws_security_group.rds`, `aws_security_group_rule.*` (4 กฎ) | [`infra/terraform/security_groups.tf`](../terraform/security_groups.tf) | แยก SG ของ Lambda และ RDS; ใช้ SG Chaining (`lambda` -> `rds` บน TCP 5432), เปิด Egress 443 ไปยัง S3 Prefix List และเปิด Ingress 5432 เฉพาะ `my_ip_cidr` สำหรับเครื่องนักพัฒนา |
| **VPC Endpoint** | `aws_vpc_endpoint.s3` (Gateway) | [`infra/terraform/security_groups.tf`](../terraform/security_groups.tf) | เชื่อมต่อ Lambda ใน VPC ไปยัง S3 ผ่าน AWS Internal Network โดยไม่ใช้ NAT Gateway |
| **Database** | `aws_db_instance.coop_db` | [`infra/terraform/rds.tf`](../terraform/rds.tf) | RDS PostgreSQL 16 (`db.t3.micro`, storage 20 GB, `skip_final_snapshot = true`) |
| **Compute (Lambda)** | `data.archive_file.lambda`, `aws_lambda_function.companies`, `aws_lambda_permission.api_gateway` | [`infra/terraform/lambda.tf`](../terraform/lambda.tf) | แพ็กเกจโค้ดจาก `infra/lambda/companies/` (ตัด `*.test.mjs` ออก), รัน Node.js 22.x ใน VPC พร้อมฉีด `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `ATTACHMENTS_BUCKET` |
| **API Gateway** | `aws_apigatewayv2_api.companies`, `aws_apigatewayv2_integration.lambda`, `aws_apigatewayv2_stage.default`, `aws_apigatewayv2_route.*` (22 routes) | [`infra/terraform/apigateway.tf`](../terraform/apigateway.tf) | HTTP API พร้อม CORS (`cors_allow_origin` + `local.web_url`), ผูก Route Policy ระหว่าง Public Routes (6 routes) และ JWT-Protected Routes (16 routes) |
| **Authentication** | `aws_cognito_user_pool.app`, `aws_cognito_user_pool_client.spa`, `aws_apigatewayv2_authorizer.cognito_jwt` | [`infra/terraform/cognito.tf`](../terraform/cognito.tf) | Cognito User Pool (Email sign-in, SRP Auth) และ JWT Authorizer ที่ขอบ API Gateway |
| **S3 Naming (Locals)** | `local.web_bucket`, `local.web_url`, `local.attachments_bucket` | [`infra/terraform/s3_web.tf`](../terraform/s3_web.tf), [`infra/terraform/s3_attachments.tf`](../terraform/s3_attachments.tf), [`infra/terraform/outputs.tf`](../terraform/outputs.tf) | คำนวณชื่อ Bucket และ URL เป็น Output ให้ Script ภายนอกนำไปใช้ โดยไม่สร้าง `aws_s3_bucket` ใน Terraform (เนื่องจากติด SCP `s3:GetBucketObjectLockConfiguration`) |

### 1.2 Resources ที่จัดการด้วย AWS CLI Scripts (อยู่นอก Terraform State)

| Resource | Script ที่ดูแล | ไฟล์กำหนดค่า | การตั้งค่าและความสามารถในการรันซ้ำ (Idempotency) |
|---|---|---|---|
| **S3 Frontend Website Bucket** (`<prefix>-coop-web-<account_id>`) | `npm run web:deploy` | [`infra/deploy-web.sh`](../../infra/deploy-web.sh) | ตรวจ `head-bucket` ก่อนสร้าง, ปิด Public Access Block, ตั้ง `BucketOwnerEnforced`, เปิด Static Website Hosting, ตั้ง Policy `s3:GetObject` เฉพาะ Public Read, สั่ง `npm run build` และ `aws s3 sync` แยก Cache-Control ระหว่าง `assets/` กับ `index.html` |
| **S3 Private Attachments Bucket** (`<prefix>-coop-attachments-<account_id>`) | `bash infra/deploy-attachments-bucket.sh` | [`infra/deploy-attachments-bucket.sh`](../../infra/deploy-attachments-bucket.sh) | ตรวจ `head-bucket` ก่อนสร้าง, เปิด Block Public Access ทั้ง 4 ข้อ, ตั้ง `BucketOwnerEnforced`, เปิดการเข้ารหัส `AES256`, ตั้ง Bucket Policy ปฏิเสธ HTTP (`aws:SecureTransport = false`), และตั้ง CORS สำหรับ Presigned POST |
| **Cognito Test Users & `app_users` Mapping** | `npm run db:seed-users` (หรือผ่าน `db:load`) | [`infra/seed-app-users.sh`](../../infra/seed-app-users.sh) | สร้างผู้ใช้ทดสอบ 7 บัญชีใน Cognito User Pool (`student1`, `student2`, `advisor1`, `advisor2`, `staff1`, `committee1`, `admin1`), ตั้งรหัสผ่านถาวร, ดึง `sub` จริงจาก Cognito แล้ว `INSERT ... ON CONFLICT DO UPDATE` ลงตาราง `app_users` และ `advisor_student_assignments` |

---

## 2. การตรวจสอบ Scripts สำหรับ Database, Lambda และ Deployment

| ขั้นตอน / งาน | คำสั่ง / Script | ไฟล์ที่เกี่ยวข้อง | สถานะปัจจุบันและข้อสังเกต |
|---|---|---|---|
| **สร้างไฟล์ SQL Seed จาก Source** | `npm run migrate:build-seed` | [`infra/migrate/build-seed.mjs`](../../infra/migrate/build-seed.mjs), [`infra/migrate/build-positions-seed.mjs`](../../infra/migrate/build-positions-seed.mjs) | แปลงข้อมูลบริษัทและตำแหน่งงานเป็น `infra/seed.sql` |
| **เตรียมฐานข้อมูลและรัน Migrations** | `npm run db:load` (`--reset`, `--no-seed-users`) | [`infra/load-db.sh`](../../infra/load-db.sh), [`infra/schema.sql`](../../infra/schema.sql), [`infra/seed-students.sql`](../../infra/seed-students.sql), [`infra/seed.sql`](../../infra/seed.sql), `infra/migrate/migrations/v3_01` ถึง `v3_05` | สร้างตารางพื้นฐาน, โหลดข้อมูลเริ่มต้น, รัน Migration `v3_01` ถึง `v3_05` ตามลำดับ และเรียก `seed-app-users.sh` ให้อัตโนมัติ |
| **ชุดข้อมูลทดสอบ Co-op Seed (V3 P5)** | รัน `psql -f` ด้วยมือ | [`infra/migrate/source/coop-seed/coop-seed.sql`](../../infra/migrate/source/coop-seed/coop-seed.sql), [`reset-coop-seed.sql`](../../infra/migrate/source/coop-seed/reset-coop-seed.sql), [`seed-ownership.sql`](../../infra/migrate/source/coop-seed/seed-ownership.sql) | มีไฟล์ SQL สำหรับ Seed และ Reset ข้อมูลทดสอบรอบสหกิจ แต่ยังไม่ได้ผูกเข้ากับ `package.json` หรือ `load-db.sh` |
| **นำเข้าข้อมูลนักศึกษาและผลการเรียน** | รันผ่าน Node/TS script | [`infra/migrate/source/student-import/import-students-grades.ts`](../../infra/migrate/source/student-import/import-students-grades.ts) | มีสคริปต์นำเข้า CSV พร้อม Validation แต่ยังไม่มี npm script มาตรฐานใน `package.json` |
| **ทดสอบ Migration Roundtrip** | `npm run db:test-migration` | [`infra/migrate/test-migration-roundtrip.sh`](../../infra/migrate/test-migration-roundtrip.sh) | ทดสอบ Upgrade -> Verify -> Rollback -> Upgrade ซ้ำสำหรับ `v3_01` ถึง `v3_05` |
| **ซิงก์ค่า Environment หน้าบ้าน** | `npm run env:sync` | [`infra/sync-env.sh`](../../infra/sync-env.sh) | อัปเดตเฉพาะ `VITE_API_URL` ใน `.env` แต่**ยังไม่อัปเดต** `VITE_COGNITO_USER_POOL_ID` และ `VITE_COGNITO_CLIENT_ID` |
| **ตรวจสอบระบบหลัง Deploy** | `npm run verify:api`, `verify:auth`, `verify:roles`, `verify:scope` | [`infra/verify-api.mjs`](../../infra/verify-api.mjs), [`infra/verify-auth.mjs`](../../infra/verify-auth.mjs), [`infra/verify-roles.mjs`](../../infra/verify-roles.mjs), [`infra/verify-scope.mjs`](../../infra/verify-scope.mjs) | ตรวจสอบสถานะ HTTP, การป้องกันด้วย JWT, สิทธิ์ตามบทบาท (RBAC) และขอบเขตข้อมูล (Data Scope) |

---

## 3. ขั้นตอนที่ยังต้องตั้งค่าด้วยมือ (Manual Steps)

1. **การอัปเดต AWS Session Credentials ของ AWS Academy:**  
   ต้องคัดลอก `aws_access_key_id`, `aws_secret_access_key` และ `aws_session_token` จากหน้า Learner Lab มาใส่ใน `~/.aws/credentials` ทุกครั้งเมื่อเริ่มเซสชันใหม่ (อายุประมาณ 4 ชั่วโมง)
2. **การตั้งค่า `infra/terraform/terraform.tfvars`:**  
   ต้องคัดลอกจาก `terraform.tfvars.example` และกรอก `name_prefix`, `db_password` และ `my_ip_cidr` (ต้องรัน `curl -s https://checkip.amazonaws.com` แล้วเติม `/32` ทุกครั้งที่ Public IP ของผู้พัฒนาเปลี่ยน มิฉะนั้น `psql` จะเชื่อมต่อ RDS Time out)
3. **การคัดลอกค่า Cognito ลงไฟล์ `.env`:**  
   เนื่องจาก `npm run env:sync` (`infra/sync-env.sh`) เขียนเฉพาะ `VITE_API_URL` ผู้พัฒนาจึงยังต้องคัดลอก `cognito_user_pool_id` และ `cognito_user_pool_client_id` จาก `terraform output` มาใส่ใน `.env` ด้วยมือ
4. **การส่งค่า Cognito Environment ตอน Build หน้าเว็บขึ้น S3 (`deploy-web.sh`):**  
   `infra/deploy-web.sh` ส่งเฉพาะ `VITE_API_URL="$API_URL" npm run build` โดยไม่ได้ดึง `cognito_user_pool_id` และ `cognito_user_pool_client_id` จาก Terraform Output มาส่งให้ขั้นตอน `npm run build` หากเครื่องที่รันไม่มีไฟล์ `.env` ที่ตรงกับ Stack ปัจจุบัน หน้าเว็บบน S3 จะล็อกอิน Cognito ไม่ได้
5. **การรันสคริปต์สร้าง Attachments Bucket:**  
   มีสคริปต์ `infra/deploy-attachments-bucket.sh` แล้ว แต่ยังไม่ได้เพิ่มคำสั่ง `"attachments:deploy"` ใน `package.json` (แม้ในหัวไฟล์สคริปต์จะระบุวิธีเรียกใช้เป็น `npm run attachments:deploy`)
6. **การจัดการ Stale Lock หรือ Dependency ของ Lambda:**  
   หากการรัน Terraform ถูกขัดจังหวะ อาจเกิดไฟล์ `.terraform.tfstate.lock.info` ค้างในเครื่อง และในส่วน `infra/lambda/companies/` ยังไม่มีสคริปต์ตรวจสอบหรือรัน `npm ci` อัตโนมัติก่อนที่ Terraform จะสร้าง `function.zip`

---

## 4. การตรวจสอบ Environment Variables, Secrets และ Terraform State

| รายการตรวจสอบ | สถานะปัจจุบัน | หลักฐานยืนยัน | ความเสี่ยง / ข้อควรระวัง |
|---|---|---|---|
| **การป้องกันไฟล์ลับใน Git (`.gitignore`)** | ป้องกันครบถ้วน | `.gitignore` ระบุ `.env`, `.env.*` (`!.env.example`), `infra/terraform/*.tfstate`, `infra/terraform/*.tfstate.*`, `infra/terraform/tfplan*`, `infra/terraform/terraform.tfvars` และตรวจด้วย `git ls-files` แล้วไม่พบไฟล์เหล่านี้ถูก Track ใน Repository | ต้องระวังไม่ให้ใช้ `git add -f` กับไฟล์ใน `infra/terraform/` |
| **การจัดเก็บ Terraform State** | Local Backend (`infra/terraform/terraform.tfstate`) | ไม่มีบล็อก `backend "s3"` ใน `versions.tf` มีไฟล์ `terraform.tfstate` และไฟล์สำรอง `.backup` อยู่ในเครื่องผู้พัฒนา | 1) ใน `terraform.tfstate` มีค่า `db_password` เก็บเป็น Plaintext ทั้งใน Resource RDS และ Lambda Environment<br>2) หากมีไฟล์ `.terraform.tfstate.lock.info` ค้างจากการปิดโปรเซสกะทันหัน จะทำให้คำสั่ง `terraform` ถัดไปติด Lock |
| **Database Password (`db_password`)** | รับผ่าน `terraform.tfvars` (`sensitive = true`) และส่งเข้า Lambda Environment Variable | [`infra/terraform/variables.tf`](../terraform/variables.tf), [`infra/terraform/lambda.tf`](../terraform/lambda.tf) | เลิกใช้ Secrets Manager และ RDS Proxy แล้ว (ตามการปรับปรุงใน V4) เพื่อลดเวลารอและหลีกเลี่ยงปัญหาการหมุนรหัสผ่านไม่ตรงกัน |
| **Test Account Password (`TEST_USERS_PASSWORD`)** | รับผ่าน Argument หรือ Prompt ใน `seed-app-users.sh` | [`infra/seed-app-users.sh`](../../infra/seed-app-users.sh) | ไม่ถูก Hardcode ลงในสคริปต์หลัก (`seed-app-users.sh`) แต่ในสคริปต์เสริม `infra/setup-all.ps1` ยังมีค่าเริ่มต้นสำหรับการทดสอบ локаล |

---

## 5. ตารางสรุป Current State / Automation Coverage / Gap

| ลำดับ | ด้าน (Area) | Current State (สิ่งที่มีอยู่) | Automation Coverage | Gap ที่พบ | งานที่ต้องปรับปรุงต่อ (Target Issue) |
|---|---|---|---|---|---|
| 1 | **Core AWS Infrastructure** | มี Terraform สำหรับ VPC SG, S3 Gateway Endpoint, RDS, Lambda, API Gateway (22 routes), Cognito | อัตโนมัติผ่าน `terraform apply` | มีโอกาสเกิด `.terraform.tfstate.lock.info` ค้างในเครื่อง และต้องตรวจสอบ `terraform validate` / `plan` รวมถึงแนวทางสำรอง Local State อย่างปลอดภัย | **V5-02 (#223)** |
| 2 | **S3 Buckets (`web` & `attachments`)** | จัดการผ่าน `deploy-web.sh` และ `deploy-attachments-bucket.sh` (เนื่องจากติด SCP ใน Terraform) | Idempotent bash scripts (`head-bucket` + ตั้งค่าซ้ำได้) | 1) `package.json` ยังไม่มี script `"attachments:deploy"`<br>2) ต้องยืนยันผลรันซ้ำและตรวจสอบ Security Configuration (Block Public Access, Encryption, CORS, HTTPS-only Policy) | **V5-02 (#223)** |
| 3 | **Lambda Packaging & Deployment** | `archive_file.lambda` ใน Terraform ซิปโฟลเดอร์ `infra/lambda/companies/` ยกเว้น `*.test.mjs` | แพ็กเกจและอัปเดตเมื่อรัน `terraform apply` | ยังไม่มีขั้นตอนอัตโนมัติสำหรับตรวจสอบ/ติดตั้ง Dependency (`npm ci` ใน `infra/lambda/companies`) ก่อนสร้าง `.build/function.zip` | **V5-03 (#224)** |
| 4 | **Frontend Build & Web Deployment** | `infra/deploy-web.sh` ดึง `api_url` จาก Terraform แล้วสั่ง `npm run build` และ `aws s3 sync` | อัตโนมัติผ่าน `npm run web:deploy` | `deploy-web.sh` ส่งเฉพาะ `VITE_API_URL` ตอนสั่ง `npm run build` แต่**ไม่ได้ส่ง** `VITE_COGNITO_USER_POOL_ID` และ `VITE_COGNITO_CLIENT_ID` จาก Terraform Output ทำให้ Build อาจขาดค่า Cognito | **V5-03 (#224)** |
| 5 | **Environment Sync (`.env`)** | `infra/sync-env.sh` อ่าน `api_url` จาก Terraform Output มาเขียนลง `.env` | อัตโนมัติเฉพาะ `VITE_API_URL` (`npm run env:sync`) | `sync-env.sh` ยังไม่ซิงก์ `VITE_COGNITO_USER_POOL_ID` และ `VITE_COGNITO_CLIENT_ID` จาก Terraform Output ลง `.env` | **V5-03 (#224) / V5-04 (#225)** |
| 6 | **Database Setup, Migration & Seed** | `infra/load-db.sh` รัน `schema.sql`, `seed-students.sql`, `seed.sql`, `v3_01`–`v3_05` และ `seed-app-users.sh` | อัตโนมัติผ่าน `npm run db:load` และ `npm run db:test-migration` | ต้องตรวจสอบและจัดระเบียบการรัน `coop-seed.sql` / `reset-coop-seed.sql`, การรันซ้ำโดยไม่ทำข้อมูลเสียหาย และการอธิบายตัวแปรแวดล้อมให้ครบถ้วน | **V5-04 (#225)** |
| 7 | **End-to-End Reproducibility & Guide** | มี `QUICK_SETUP.md`, `terraform-setup-guide.md`, และสคริปต์ `verify-*.mjs` | แยกเป็นรายคำสั่ง | ต้องรวบรวมลำดับคำสั่งตั้งแต่ต้นจนจบหลังปรับปรุง V5-02 ถึง V5-04 และให้สมาชิกอีกคนทดสอบทำตามคู่มือจริงพร้อมเก็บหลักฐาน | **V5-05 (#226)** |

---

## 6. ข้อจำกัดจาก AWS Academy และสิทธิ์ที่มี (Constraints)

1. **ข้อจำกัดด้าน IAM (`LabRole` Only):**  
   บัญชี AWS Academy ไม่อนุญาตให้สร้าง แก้ไข หรือลบ IAM Role และ IAM Policy ใหม่ (`iam:CreateRole`, `iam:PutRolePolicy` ถูกปฏิเสธ) ทุกบริการ (เช่น Lambda) จึงต้องใช้ `data.aws_iam_role.lab_role` (`LabRole`) ร่วมกัน
2. **ข้อจำกัดด้าน S3 Object Lock API ใน SCP:**  
   Service Control Policy (SCP) ของ AWS Academy ปฏิเสธการเรียก `s3:GetBucketObjectLockConfiguration` ซึ่ง Terraform AWS Provider (ทั้ง v5 และ v6) เรียกใช้อัตโนมัติเมื่ออ่านสถานะ `aws_s3_bucket` ทำให้การสร้าง S3 Bucket ผ่าน Terraform ล้มเหลวในขั้น Read/Refresh จึงต้องแยกการสร้างและตั้งค่า S3 Bucket ทั้ง 2 ถังออกมาใช้ AWS CLI Script แทน
3. **ข้อจำกัดด้าน CloudFront และ Custom Domain:**  
   ไม่มีสิทธิ์ใช้งาน CloudFront, ACM หรือ Route 53 ดังนั้น S3 Static Website จึงให้บริการผ่าน HTTP Endpoint มาตรฐานของ S3 ในขณะที่ API Gateway และ S3 Presigned URLs ให้บริการผ่าน HTTPS
4. **อายุของ AWS Session Credentials:**  
   Credentials ของ AWS Academy (`ASIA...` พร้อม `aws_session_token`) เป็นแบบชั่วคราวที่หมดอายุตามรอบเซสชันของ Lab ไม่สามารถสร้าง Long-lived IAM Access Key สำหรับทำ Unattended CI/CD Deployment ไปยัง AWS โดยตรงได้ การรัน Automation จึงต้องดำเนินการผ่าน CLI ในสภาพแวดล้อมที่มีการอัปเดต Session Token ที่ยังไม่หมดอายุ
5. **ข้อจำกัดด้านเครือข่ายในการเข้าถึง RDS จากเครื่องผู้พัฒนา:**  
   RDS อยู่ใน VPC และเปิดรับการเชื่อมต่อพอร์ต 5432 เฉพาะจาก `companies-lambda-sg` และ `my_ip_cidr` เท่านั้น หากผู้พัฒนาย้ายเครือข่าย (IP เปลี่ยน) ต้องอัปเดต `my_ip_cidr` และรัน `terraform apply` ก่อนเสมอจึงจะรัน `npm run db:load` ได้

---

## 7. หลักฐานการตรวจสอบ (Verification Evidence)

- ไฟล์หลักฐานการตรวจสอบรายการไฟล์, สถานะ `.gitignore` / `git ls-files` และรายการ Resources ใน Terraform:  
  [`docs/evidence/222-01-infra-audit-evidence.txt`](../evidence/222-01-infra-audit-evidence.txt)
