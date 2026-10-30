# Quick Setup — Cooperative Education Planning & Management System

คู่มือนี้ใช้สำหรับสมาชิกที่ต้องการติดตั้งโปรเจกต์จากเครื่องใหม่ โดยใช้
AWS Academy Learner Lab, Terraform และ Git Bash บน Windows

> **ข้อควรระวัง:** ขั้นตอน Deploy สร้าง AWS resources ซึ่งอาจมีค่าใช้จ่าย
> และใช้เวลาได้หลายนาที ตรวจสอบ AWS account, region และ resource ที่จะสร้าง
> ก่อนยืนยัน `terraform apply` เสมอ
>
> ห้าม commit หรือแชร์ `terraform.tfvars`, Terraform state, DB password,
> AWS credentials หรือรหัสผ่านของบัญชีทดสอบ

## 1. ภาพรวม

ระบบประกอบด้วย React/Vite frontend, Amazon Cognito สำหรับยืนยันตัวตน,
API Gateway, Lambda และ PostgreSQL บน RDS

- การรันเว็บในเครื่องยังต้องมี API/backend ที่ deploy และใช้งานได้
- Terraform จัดการ AWS resources หลัก
- SQL schema และข้อมูลตั้งต้นโหลดด้วย `npm run db:load`
- Role `STUDENT`, `ADVISOR`, `STAFF`, `ADMIN` จัดเก็บใน `app_users`
  ไม่ได้กำหนดจากชื่ออีเมลหรือ Cognito groups
- การ publish เว็บไป S3 เป็นขั้นตอนเพิ่มเติม ไม่จำเป็นสำหรับ local development

## 2. เตรียมเครื่องมือ

ติดตั้งเครื่องมือต่อไปนี้ก่อนเริ่ม:

| เครื่องมือ | ตรวจสอบ |
|---|---|
| Git for Windows พร้อม Git Bash | `git --version` |
| Node.js 20+ | `node --version` |
| npm | `npm --version` |
| Terraform >= 1.5 | `terraform version` |
| AWS CLI | `aws --version` |
| PostgreSQL client (`psql`) | `psql --version` |

Windows สามารถติดตั้ง Terraform และ PostgreSQL 16 ผ่าน `winget` ได้
หากใช้ PostgreSQL installer ให้เพิ่มโฟลเดอร์ `bin` ลงใน PATH
และเปิด terminal ใหม่หลังแก้ PATH

## 3. ดาวน์โหลดโปรเจกต์และติดตั้ง dependencies

Clone repository แล้วเข้า root ของโปรเจกต์:

```bash
git clone https://github.com/KaylahJin/CS361-Project.git
cd CS361-Project
npm install
npm install --omit=dev --prefix infra/lambda/companies
```

คำสั่งที่สองติดตั้ง dependencies ที่ Lambda ใช้ตอนทำงานด้วย
อย่าข้ามขั้นตอนนี้ เพราะ Lambda ต้องใช้ PostgreSQL driver `pg`

ตรวจสอบ frontend และ tests:

```bash
npm run build
npm test
```

Unit tests ไม่จำเป็นต้องเชื่อมต่อ AWS

## 4. ตั้งค่า AWS credentials

### AWS Academy Learner Lab

1. เปิด Learner Lab และเริ่ม session ให้เป็นสถานะ running
2. เปิด **AWS Details → AWS CLI**
3. คัดลอก configuration block ทั้งชุด รวม `aws_access_key_id`,
   `aws_secret_access_key` และ `aws_session_token`
4. เปิด credentials file ใน Git Bash:

```bash
notepad ~/.aws/credentials
```

5. อัปเดต `[default]` ด้วย credentials ชุดล่าสุด แล้วบันทึกไฟล์

ตรวจสอบว่า credentials ใช้งานได้:

```bash
aws sts get-caller-identity
```

หากพบ `ExpiredToken` หรือ `InvalidClientTokenId` ให้ refresh
credentials จาก Learner Lab แล้วตรวจสอบอีกครั้ง

### Region

โปรเจกต์กำหนด region เริ่มต้นใน Terraform เป็น `us-east-1`
ตรวจสอบ `infra/terraform/variables.tf` และ `terraform.tfvars`
ให้แน่ใจว่าใช้ region เดียวกันกับ resources ที่จะจัดการ

```bash
aws configure get region
```

AWS CLI region ที่แสดงอาจต่างจาก Terraform ได้ แต่ห้ามสันนิษฐานว่า
resources ที่มีอยู่จะอยู่ใน region เดียวกัน ตรวจสอบก่อน deploy ทุกครั้ง

## 5. ตั้งค่า Terraform

จาก root ของ repository:

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

เปิด `terraform.tfvars` และกำหนดค่าต่อไปนี้:

- `name_prefix`: prefix เฉพาะของคุณ ใช้อักษรพิมพ์เล็ก ตัวเลข และขีดกลาง
  โดยต้องขึ้นต้นด้วยตัวอักษร และมีความยาวตามข้อกำหนดใน `variables.tf`
- `db_password`: รหัสผ่านฐานข้อมูลของคุณ อย่างน้อย 8 ตัวอักษร
  ห้ามมี `/`, `@`, `"` หรือช่องว่าง
- `my_ip_cidr`: public IP ปัจจุบันตามด้วย `/32`
  ตรวจสอบ IP ได้ด้วย `curl -s https://checkip.amazonaws.com`

ตัวอย่างรูปแบบ CIDR: `203.0.113.4/32`
ให้ใช้ IP จริงของตนเอง ไม่ใช้ IP ตัวอย่างนี้

ทุกคนในทีมใช้ AWS account ร่วมกัน จึงต้องใช้ `name_prefix` ที่ไม่ซ้ำ
และควรคงค่าเดิมหลัง deploy แล้ว เพราะเปลี่ยน prefix อาจทำให้ resources
รวมถึงฐานข้อมูลถูกสร้างใหม่

อย่าแชร์เนื้อหา `terraform.tfvars` เนื่องจากมี DB password

## 6. ตรวจสอบและ Deploy AWS resources

ยังอยู่ใน `infra/terraform`:

```bash
terraform init
terraform validate
terraform plan
```

อ่านผล `plan` ก่อนทุกครั้ง ตรวจสอบ account, region, resource names
และรายการที่จะสร้าง แก้ไข หรือลบ หากไม่แน่ใจให้หยุดก่อน

เมื่อยืนยันว่าถูกต้องแล้วจึงรัน:

```bash
terraform apply
```

ตรวจสอบผลลัพธ์ก่อนยืนยัน `yes` การสร้าง RDS อาจใช้เวลาหลายนาที
หาก credentials หมดอายุ ให้ refresh ก่อนลองใหม่

เมื่อเสร็จแล้วตรวจสอบ outputs:

```bash
terraform output
```

กลับไป root:

```bash
cd ../..
```

## 7. โหลด schema และข้อมูลตั้งต้น

จาก root ของ repository:

```bash
npm run db:load
```

สคริปต์จะอ่าน RDS endpoint, database name และ username จาก Terraform
outputs และขอ DB password ระหว่างทำงาน

ขั้นตอนนี้โหลด schema, seed data และ migration ของ V3
หากคำสั่งล้มเหลว ให้ตรวจสอบ DB password, RDS status, `my_ip_cidr`
และการเชื่อมต่อเครือข่ายก่อนรันซ้ำ

> **คำเตือน:** `npm run db:load -- --reset` จะลบ schema `public`
> และข้อมูลเดิมทั้งหมดก่อนโหลดใหม่ ห้ามใช้กับฐานข้อมูลที่มีข้อมูลที่ต้องเก็บรักษา

## 8. ตั้งค่า Cognito และบัญชีทดสอบ

ทำตามคู่มือ [Cognito Setup](cognito-setup.md) เพื่อดำเนินการขั้นตอนที่ต้องทำ
หลัง Terraform apply:

1. ตั้งค่า Cognito User Pool ID และ Client ID ในไฟล์ `.env`
   โดยใช้ output จาก Terraform ตามคู่มือ Cognito
2. สร้างบัญชีทดสอบผ่านขั้นตอนที่กำหนดในคู่มือ
3. ตรวจสอบ identity ของแต่ละบัญชี และกำหนด role ผ่าน approved Cognito
   `sub` values ตามขั้นตอนที่ระบุไว้
4. รันการ seed บัญชีและตรวจสอบ role ตามคู่มือ

ห้ามกำหนด role จาก email prefix และห้าม commit รหัสผ่านบัญชีทดสอบ
บัญชีที่ authenticate ได้แต่ยังไม่มี mapping ใน `app_users`
ควรได้รับ `403` ตามการออกแบบ

## 9. เชื่อมต่อ frontend และรันในเครื่อง

จาก root:

```bash
npm run env:sync
npm run dev
```

เปิด URL ที่ Vite แสดง โดยปกติคือ `http://localhost:5173`

ถ้า Vite เปลี่ยนเป็น port อื่น ให้ตรวจสอบ `cors_allow_origin`
ใน `terraform.tfvars` และปรับให้ตรงกับ origin ที่ใช้งาน จากนั้น apply
การเปลี่ยนแปลงที่จำเป็น

หาก API ถูกสร้างใหม่ ให้รัน `npm run env:sync` อีกครั้ง
แล้ว restart development server

## 10. ตรวจสอบระบบ

เริ่มจากตรวจสอบ frontend และ unit tests ซึ่งไม่ต้องใช้รหัสผ่าน AWS:

```bash
npm run build
npm test
```

ตรวจสอบ API:

```bash
npm run verify:api
```

สคริปต์นี้อ่าน DB password จาก `infra/terraform/terraform.tfvars`
อย่าแสดงหรือส่งเนื้อหาไฟล์นี้ให้ผู้อื่น

### เตรียมรหัสผ่านสำหรับ Cognito verification

ใช้บัญชีทดสอบที่สร้างไว้แล้วตาม
[Cognito Setup](cognito-setup.md) และตั้งค่ารหัสผ่านใน shell ปัจจุบัน
โดยไม่ใส่รหัสผ่านลงใน source code หรือ commit

ตัวอย่างการรับรหัสผ่านโดยไม่แสดงตัวอักษรบนหน้าจอ:

```bash
read -rsp "Student password: " COOP_STUDENT_PASSWORD; echo
export COOP_STUDENT_PASSWORD

read -rsp "Advisor password: " COOP_ADVISOR_PASSWORD; echo
export COOP_ADVISOR_PASSWORD

read -rsp "Staff password: " COOP_STAFF_PASSWORD; echo
export COOP_STAFF_PASSWORD

read -rsp "Admin password: " COOP_ADMIN_PASSWORD; echo
export COOP_ADMIN_PASSWORD

read -rsp "Unmapped account password: " COOP_UNMAPPED_PASSWORD; echo
export COOP_UNMAPPED_PASSWORD
```

แต่ละค่าต้องเป็นรหัสผ่านของบัญชีที่ตรงกันจริง และบัญชี unmapped
ต้องเป็นบัญชีที่ไม่ได้ถูกเพิ่มเข้า `app_users`

จากนั้นรัน verification:

```bash
npm run verify:auth
npm run verify:roles
npm run verify:scope
```

`verify:auth` ใช้บัญชี `student1@example.com` เป็นค่าเริ่มต้น
และตรวจสอบบัญชี unmapped ด้วย ส่วน `verify:roles` ต้องใช้รหัสผ่าน
ของทั้งสี่ role และ `verify:scope` ต้องใช้รหัสผ่านของ Student กับ Staff

เมื่อทดสอบเสร็จ สามารถลบตัวแปรรหัสผ่านออกจาก shell ได้:

```bash
unset COOP_STUDENT_PASSWORD COOP_ADVISOR_PASSWORD
unset COOP_STAFF_PASSWORD COOP_ADMIN_PASSWORD COOP_UNMAPPED_PASSWORD
```

ตรวจสอบหน้าเว็บและ permission ของแต่ละ role เพิ่มเติมด้วย
หากยังไม่ได้สร้างบัญชีทดสอบหรือตั้งค่า Cognito ให้ทำตามหัวข้อ 8 ก่อน

## 11. (ทางเลือก) Publish frontend ไปยัง S3

เมื่อ local setup และการทดสอบผ่านแล้ว หากต้องการเผยแพร่เว็บ:

```bash
npm run web:deploy
```

สคริปต์นี้ build frontend และเผยแพร่ไปยัง S3 website endpoint
ซึ่งเป็น public HTTP website ไม่ใช่ HTTPS ห้ามใส่ข้อมูลลับใน frontend
หรือ `VITE_` variables เพราะค่าที่ bundle ไว้ผู้เข้าชมเว็บสามารถอ่านได้

หากมีการเปลี่ยน API URL ให้ deploy frontend ใหม่ด้วย
เพราะ `VITE_API_URL` ถูกฝังใน bundle ตอน build

การลบ bucket ที่สคริปต์นี้จัดการเป็นขั้นตอนแยกจาก `terraform destroy`
อ่านคำเตือนของสคริปต์ก่อนใช้ตัวเลือก `--destroy`

## 12. ปัญหาที่พบบ่อย

| อาการ | สิ่งที่ควรตรวจ |
|---|---|
| `ExpiredToken` / `InvalidClientTokenId` | Refresh Learner Lab credentials |
| Terraform หา resource ไม่พบ | ตรวจ account, region และ `name_prefix` |
| Terraform สร้าง resource ชื่อซ้ำไม่ได้ | ใช้ prefix เฉพาะของตนเอง |
| `psql` timeout | ตรวจ RDS status, `my_ip_cidr` และ network access |
| หน้าเว็บโหลดข้อมูลไม่ได้ | ตรวจ API URL, CORS origin และ API status |
| Cognito login ได้แต่ API ตอบ `403` | ตรวจว่ามี mapping ใน `app_users` และ role ถูกกำหนดอย่างถูกต้อง |
| Lambda แจ้งว่าไม่พบ package `pg` | ติดตั้ง dependencies ของ `infra/lambda/companies` ใหม่ |
| Vite เปิด port 5174 แทน 5173 | ตรวจ `cors_allow_origin` ให้ตรงกับ port จริง |

## 13. การจัดการ resources หลังใช้งาน

`terraform destroy` จะลบ resources ที่ Terraform จัดการอยู่
และอาจทำให้ข้อมูลฐานข้อมูลสูญหาย ตรวจสอบแผนการลบก่อนยืนยันทุกครั้ง

ก่อน destroy ให้สำรองข้อมูลที่ต้องการเก็บ และตรวจสอบ resources ที่สคริปต์
แยกจัดการ เช่น S3 website bucket ห้ามลบ resources ที่สมาชิกคนอื่นกำลังใช้งาน

หากใช้ AWS Academy Learner Lab ร่วมกับทีม ให้ประสานงานก่อนลบ stack
หรือ resources ใด ๆ

## เอกสารเพิ่มเติม

- [Project Overview](project-overview.md)
- [Terraform Setup Guide](terraform-setup-guide.md)
- [Cognito Setup](cognito-setup.md)
- [V3 Authentication](v3-02-auth.md)
- [Permission Matrix](permission-matrix.md)
