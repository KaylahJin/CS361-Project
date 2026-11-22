# คู่มือการตั้งค่า Environment Configuration

เอกสารนี้อธิบาย Environment Variables และการตั้งค่าที่จำเป็นสำหรับการพัฒนา ทดสอบ และ Deploy ระบบจัดการแผนสหกิจ เพื่อให้สมาชิกในทีมสามารถตั้งค่าสภาพแวดล้อมของตนเองได้อย่างถูกต้อง

## 1. ภาพรวมการตั้งค่า

ระบบแบ่งการตั้งค่าออกเป็น 5 กลุ่มหลัก

| กลุ่ม | จุดประสงค์ |
|---|---|
| Frontend | ตั้งค่าสำหรับ React และ Vite |
| Backend | ตั้งค่าการเชื่อมต่อ Lambda กับ PostgreSQL และ S3 |
| Database | ตั้งค่าการเชื่อมต่อ PostgreSQL สำหรับ Developer และ Scripts |
| Terraform | ตั้งค่าสำหรับสร้างและจัดการ AWS Infrastructure |
| Verification | ตั้งค่าสำหรับทดสอบระบบและตรวจสอบสิทธิ์ผู้ใช้ |

---

## 2. Frontend Environment Variables

Frontend ใช้ React และ Vite โดยกำหนดค่าผ่านไฟล์ `.env`

ไฟล์ตัวอย่างอยู่ที่ `.env.example`

| Variable | รายละเอียด |
|---|---|
| `VITE_API_URL` | URL ของ API Gateway |
| `VITE_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `VITE_COGNITO_CLIENT_ID` | Cognito App Client ID |

### วิธีตั้งค่า

1. คัดลอกไฟล์ตัวอย่าง

```bash
cp .env.example .env
```

2. กรอกค่าที่จำเป็นในไฟล์ `.env`

3. หากต้องการดึงค่าจาก Terraform Outputs สามารถใช้คำสั่ง

```bash
npm run env:sync
```

4. เริ่มต้น Frontend

```bash
npm run dev
```

**ข้อควรระวัง:** ตัวแปรที่ขึ้นต้นด้วย `VITE_` จะถูกนำไปใช้ในฝั่ง Browser จึงห้ามใส่ Database Password, AWS Secret หรือข้อมูลลับอื่น ๆ ลงในตัวแปรกลุ่มนี้

---

## 3. Backend Environment Variables

Backend ใช้ AWS Lambda เชื่อมต่อกับ PostgreSQL บน Amazon RDS และ S3 สำหรับจัดเก็บไฟล์แนบ

ค่าที่ Lambda ใช้มีดังนี้

| Variable | รายละเอียด |
|---|---|
| `DB_HOST` | Hostname ของ RDS |
| `DB_PORT` | Port ของ PostgreSQL (ปกติคือ `5432`) |
| `DB_NAME` | ชื่อ Database |
| `DB_USER` | Username สำหรับเชื่อมต่อ Database |
| `DB_PASSWORD` | Password สำหรับเชื่อมต่อ Database |
| `ATTACHMENTS_BUCKET` | ชื่อ S3 Bucket สำหรับจัดเก็บไฟล์แนบ |

ค่าบางส่วนถูกกำหนดผ่าน Terraform ใน `infra/terraform/lambda.tf` เช่น RDS Endpoint, Database Name และ S3 Bucket

**หมายเหตุเกี่ยวกับสถาปัตยกรรมปัจจุบัน:** Backend เชื่อมต่อกับ RDS โดยตรง ปัจจุบันระบบไม่ได้ใช้งาน RDS Proxy และ AWS Secrets Manager สำหรับจัดการ Database Credentials ดังนั้นไม่ควรตั้งค่าเอกสารหรือแผนภาพให้เข้าใจว่ามีการใช้งานบริการทั้งสองแล้ว

---

## 4. Database Environment Variables

สำหรับ Developer ที่ต้องเชื่อมต่อ PostgreSQL จากเครื่องตนเอง หรือเรียกใช้ Database Scripts สามารถกำหนดค่าผ่าน Environment Variables กลุ่ม `PG*`

| Variable | รายละเอียด |
|---|---|
| `PGHOST` | Hostname ของ PostgreSQL |
| `PGPORT` | Port ของ PostgreSQL |
| `PGDATABASE` | ชื่อ Database ที่ต้องการเชื่อมต่อ |
| `PGUSER` | Username |
| `PGPASSWORD` | Password |
| `PGSSLMODE` | รูปแบบการเชื่อมต่อ SSL |
| `PGCLIENTENCODING` | Encoding ที่ใช้ในการเชื่อมต่อ |

ตัวอย่างการตั้งค่าผ่าน Git Bash:

```bash
export PGHOST="your-rds-endpoint"
export PGPORT="5432"
export PGDATABASE="coop_db"
export PGUSER="your-username"
export PGPASSWORD="your-password"
export PGSSLMODE="require"
```

ตรวจสอบการเชื่อมต่อด้วยคำสั่ง:

```bash
psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE"
```

### การใช้ Terraform Outputs

สามารถใช้ Terraform Outputs เพื่อดูค่าการตั้งค่าบางส่วน เช่น RDS Endpoint, Database Name และ Database Username

ตัวอย่าง:

```bash
cd infra/terraform

terraform output
```

ไม่ควรนำ Database Password ไปเผยแพร่ผ่าน Outputs หรือ commit ลง Repository

**หมายเหตุ:** บาง Script อาจรองรับ `DATABASE_URL` เพิ่มเติม แต่ไม่ควรถือว่าทุก Script รองรับตัวแปรนี้ ให้ตรวจสอบ Script ที่ต้องการใช้งานก่อน

---

## 5. Terraform Environment Variables

Terraform ใช้สำหรับสร้างและจัดการ AWS Infrastructure ของระบบ

ไฟล์ที่เกี่ยวข้อง:

- `infra/terraform/variables.tf` — ประกาศตัวแปรที่ Terraform ใช้งาน
- `infra/terraform/terraform.tfvars.example` — ตัวอย่างค่าที่ใช้ตั้งค่า
- `infra/terraform/main.tf` และไฟล์ `.tf` อื่น ๆ — กำหนด Infrastructure

### ตัวแปรที่ใช้ตั้งค่า

| Variable | รายละเอียด | ค่าเริ่มต้น |
|---|---|---|
| `name_prefix` | Prefix สำหรับตั้งชื่อ Resource | ต้องกำหนด |
| `db_password` | Password ของ Database | ต้องกำหนด |
| `my_ip_cidr` | IP Address ของผู้ใช้งานในรูปแบบ CIDR | ต้องกำหนด |
| `aws_region` | AWS Region | `us-east-1` |
| `db_name` | ชื่อ Database | `coop_db` |
| `db_username` | Username ของ Database | `postgres` |
| `db_instance_class` | ขนาด RDS Instance | `db.t4g.micro` |
| `cors_allow_origin` | Origin ที่อนุญาตให้เรียก API | `http://localhost:5173` |
| `lab_role_name` | ชื่อ IAM Role ที่ใช้งาน | `LabRole` |

### วิธีตั้งค่า

1. เข้าไปที่โฟลเดอร์ Terraform

```bash
cd infra/terraform
```

2. คัดลอกไฟล์ตัวอย่าง

```bash
cp terraform.tfvars.example terraform.tfvars
```

3. แก้ไขค่าใน `terraform.tfvars` ให้ตรงกับสภาพแวดล้อมที่ต้องการใช้งาน

4. สำหรับ `db_password` สามารถใช้ Environment Variable แทนการเขียน Password ลงในไฟล์ได้ เช่น

```bash
export TF_VAR_db_password="your-password"
```

5. ตรวจสอบและวางแผนการเปลี่ยนแปลง Infrastructure

```bash
terraform init
terraform plan
```

6. หากตรวจสอบแผนการเปลี่ยนแปลงเรียบร้อยแล้ว จึงค่อยสั่งสร้างหรือปรับปรุง Infrastructure

```bash
terraform apply
```

**ข้อควรระวัง:** ควรตรวจสอบผลจาก `terraform plan` ก่อนทุกครั้ง โดยเฉพาะการเปลี่ยนแปลงหรือลบ Resource ที่มีข้อมูลสำคัญอยู่

---

## 6. AWS CLI Configuration

การใช้งาน Terraform และ AWS Scripts จำเป็นต้องมี AWS Credentials ที่สามารถเข้าถึง Resource ตามสิทธิ์ที่ได้รับ

ตรวจสอบตัวตนและสิทธิ์ของ AWS Account ด้วยคำสั่ง:

```bash
aws sts get-caller-identity
```

หากใช้ AWS Academy / Learner Lab ให้ใช้ Credentials ที่ได้รับจาก Lab และตรวจสอบว่า Session ยังไม่หมดอายุ

**ข้อควรระวัง:** ห้ามนำ AWS Access Key, Secret Access Key, Session Token หรือ Credentials อื่น ๆ commit ลง Repository

---

## 7. Verification Environment Variables

ระบบมี Scripts สำหรับตรวจสอบการทำงานและสิทธิ์ของผู้ใช้งาน โดยบาง Scripts จำเป็นต้องใช้ข้อมูลสำหรับทดสอบ

ตัวอย่างตัวแปรที่เกี่ยวข้อง:

| Variable | รายละเอียด |
|---|---|
| `COOP_APPROVED_STUDENT_SUB` | Cognito Subject ของ Student |
| `COOP_APPROVED_ADVISOR_SUB` | Cognito Subject ของ Advisor |
| `COOP_APPROVED_STAFF_SUB` | Cognito Subject ของ Staff |
| `COOP_APPROVED_ADMIN_SUB` | Cognito Subject ของ Admin |
| `COOP_APPROVED_COMMITTEE_SUB` | Cognito Subject ของ Committee |
| `COOP_STUDENT_PASSWORD` | Password สำหรับบัญชี Student ที่ใช้ทดสอบ |
| `COOP_ADVISOR_PASSWORD` | Password สำหรับบัญชี Advisor ที่ใช้ทดสอบ |
| `COOP_STAFF_PASSWORD` | Password สำหรับบัญชี Staff ที่ใช้ทดสอบ |
| `COOP_ADMIN_PASSWORD` | Password สำหรับบัญชี Admin ที่ใช้ทดสอบ |
| `COOP_UNMAPPED_EMAIL` | Email ของบัญชีที่ยังไม่ได้กำหนด Mapping |
| `COOP_UNMAPPED_PASSWORD` | Password ของบัญชีดังกล่าว |

นอกจากนี้ Verification Scripts บางตัวอาจต้องใช้ข้อมูลตัวอย่าง เช่น

- `OWN_PLAN`
- `OTHER_PLAN`
- `OWN_STUDENT`
- `OTHER_STUDENT`
- `SAMPLE_COMPANY`
- `SAMPLE_POSITION`

ตัวแปรที่ต้องใช้จริงขึ้นอยู่กับ Verification Script แต่ละตัว ควรตรวจสอบไฟล์ Script ก่อนเรียกใช้งาน

---

## 8. ไฟล์ที่เกี่ยวข้องกับการตั้งค่า

| ไฟล์ | หน้าที่ |
|---|---|
| `.env.example` | ตัวอย่าง Environment Variables สำหรับ Frontend |
| `infra/terraform/variables.tf` | ประกาศ Terraform Variables |
| `infra/terraform/terraform.tfvars.example` | ตัวอย่าง Terraform Configuration |
| `infra/terraform/lambda.tf` | กำหนด Environment Variables ให้ Lambda |
| `infra/sync-env.sh` | Script สำหรับ Sync ค่าจาก Terraform Outputs |
| `infra/deploy-web.sh` | Script สำหรับ Build และ Deploy Frontend |
| `infra/load-db.sh` | Script สำหรับโหลดข้อมูลเข้า Database |
| `infra/seed.sql` | Seed ข้อมูลเริ่มต้น |
| `infra/seed-students.sql` | Seed ข้อมูลนักศึกษา |

---

## 9. แนวทางด้านความปลอดภัย

เพื่อป้องกันข้อมูลสำคัญรั่วไหล ควรปฏิบัติตามแนวทางต่อไปนี้

1. ห้าม Commit Database Password, AWS Credentials, Session Token หรือ Secret อื่น ๆ ลง GitHub
2. ใช้ไฟล์ตัวอย่าง เช่น `.env.example` และ `terraform.tfvars.example` สำหรับแสดงชื่อ Variables และรูปแบบการตั้งค่าเท่านั้น
3. ห้ามใส่ Database Credentials ใน Frontend Variables ที่ขึ้นต้นด้วย `VITE_`
4. ควรตรวจสอบ `.gitignore` ว่าไม่อนุญาตให้ไฟล์ที่มี Credentials จริงถูก Commit
5. ควรตรวจสอบ Git Diff ก่อน Push ทุกครั้ง
6. ห้ามใช้คำสั่งที่ลบหรือ Reset Database โดยไม่ตรวจสอบ Database เป้าหมายก่อน

---

## 10. คำสั่งที่ใช้บ่อย

| คำสั่ง | จุดประสงค์ |
|---|---|
| `npm run dev` | เริ่มต้น Frontend สำหรับ Development |
| `npm run env:sync` | Sync Environment Variables จาก Terraform Outputs |
| `npm run db:load` | โหลดข้อมูลเข้า Database |
| `npm run db:migrate-v3` | เรียกใช้ Migration Script |
| `npm run db:test-migration` | ทดสอบ Migration |
| `npm run verify:api` | ตรวจสอบ API |
| `npm run verify:auth` | ตรวจสอบ Authentication |

ควรตรวจสอบ Scripts ที่มีอยู่ใน `package.json` ก่อนเรียกใช้งาน เพื่อให้แน่ใจว่าชื่อคำสั่งตรงกับ Repository เวอร์ชันปัจจุบัน

---

## 11. เอกสารที่เกี่ยวข้อง

- `docs/project-setup-guide.md`
- `docs/terraform-setup-guide.md`
- `docs/v3-manual-import.md`
- `docs/v3_database_migration_guide.md`
- `docs/cognito-setup.md`