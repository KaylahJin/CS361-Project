# คู่มือ Migration ฐานข้อมูล V3 (V3-03.1 #98)

Backup → Upgrade → Verify → Rollback

ชื่อตารางและคอลัมน์ทั้งหมดยึดตาม `docs/overview/V3-01-data-model.md` ซึ่งเป็น
ข้อตกลงร่วมของทีม และเป็นชื่อที่โค้ด Lambda ของ V3-02 เรียกใช้อยู่แล้ว

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `infra/migrate/migrations/v3_01_upgrade.sql` | สร้างตาราง V3 และปรับสถานะแผน |
| `infra/migrate/migrations/v3_01_verify.sql` | ตรวจผล อ่านอย่างเดียว ไม่เขียนข้อมูล |
| `infra/migrate/migrations/v3_01_rollback.sql` | ถอน V3 กลับเป็นโครงสร้าง V2 |

## 0. ค่าการเชื่อมต่อ

ไม่ต้องกรอกเอง ดึงจาก Terraform เหมือนที่ `infra/load-db.sh` ทำ (`.env` ของ repo นี้
เก็บเฉพาะตัวแปร `VITE_` ของฝั่งหน้าเว็บ ไม่มีค่าฐานข้อมูล)

```bash
export PGHOST=$(terraform -chdir=infra/terraform output -raw rds_endpoint)
export PGDATABASE=$(terraform -chdir=infra/terraform output -raw db_name)
export PGUSER=$(terraform -chdir=infra/terraform output -raw db_username)
export PGCLIENTENCODING=UTF8
# รหัสผ่านอยู่ใน infra/terraform/terraform.tfvars (ตั้งใจไม่ทำเป็น output)
read -rs PGPASSWORD && export PGPASSWORD
```

ต่อตรงไปที่ RDS endpoint เท่านั้น ถ้าต่อไม่ติดและค้างจนหมดเวลา แปลว่า `my_ip_cidr`
ใน `terraform.tfvars` ยังเป็น IP เดิม ให้แก้เป็น IP ปัจจุบันแล้ว `terraform apply` ก่อน

## 1. สำรองข้อมูลก่อนเสมอ

```bash
pg_dump -F c -f backup_v2_before_migration.dump
```

รูปแบบ custom (`-F c`) กู้คืนทีละตารางได้ และไฟล์เล็กกว่า plain SQL

## 2. Upgrade (V2 → V3)

```bash
psql -v ON_ERROR_STOP=1 -f infra/migrate/migrations/v3_01_upgrade.sql
```

สคริปต์ทั้งไฟล์อยู่ใน transaction เดียว ถ้าพังกลางทางจะไม่มีอะไรค้างครึ่งๆ
และรันซ้ำได้ไม่พัง

สิ่งที่เกิดขึ้น:

- สร้าง `app_users` (`cognito_sub`, `email`, `role`, `student_id`, `is_active`)
- สร้าง `advisor_student_assignments` (`advisor_sub`, `student_id`)
- สร้าง `plan_reviews` (`reviewer_sub`, `decision`, `comment`) โดย `plan_id` เป็น
  `INTEGER` ให้ตรงกับ `coop_plans.plan_id` ของจริง
- ย้ายแผนสถานะ `UNDER_REVIEW` ไปเป็น `SUBMITTED` แล้วเปลี่ยนชุดสถานะที่อนุญาต
  เป็น `PREPARING`, `SUBMITTED`, `RETURNED`, `APPROVED`, `REJECTED`
- เพิ่ม unique index กันยื่นซ้ำ: หนึ่งแผนที่ยังดำเนินการอยู่ต่อนักศึกษาต่อรอบ

## 3. Verify

```bash
psql -f infra/migrate/migrations/v3_01_verify.sql
```

ทุกแถวต้องอ่านว่า `ok` ถ้าเจอ `MISSING` หรือ `WRONG:` แปลว่า upgrade ไม่ครบ
สคริปต์นี้อ่านอย่างเดียว รันกี่ครั้งก็ได้ ไม่ทิ้งข้อมูลทดสอบไว้ในฐานข้อมูล

สิ่งที่ควรเห็น: ตาราง V3 ครบสามตาราง, `plan_reviews.plan_id` เป็น integer เท่ากับ
`coop_plans.plan_id`, constraint สถานะมี `RETURNED` และไม่มี `UNDER_REVIEW`,
และไม่มีแผนไหนค้างอยู่บนสถานะของ V2

ผลรันล่าสุดบนฐานข้อมูลจริงอยู่ใน `docs/evidence/98-01-v3-verify-output.txt`

## 4. Rollback (V3 → V2)

```bash
psql -v ON_ERROR_STOP=1 -f infra/migrate/migrations/v3_01_rollback.sql
```

ถอน `plan_reviews`, `advisor_student_assignments`, `app_users` และ unique index
ออก แล้วคืนชุดสถานะเดิมของ V2 แผนที่อยู่สถานะ `RETURNED` จะกลับไปเป็น
`PREPARING` เพราะ V2 ไม่มีสถานะนี้ ส่วนความเห็นของผู้ตรวจยังอยู่ใน
`coop_plans.review_comment`

ตรวจผล:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('app_users', 'advisor_student_assignments', 'plan_reviews');
-- ต้องได้ 0 แถว

SELECT DISTINCT status FROM coop_plans;
-- ต้องไม่มี RETURNED หลงเหลือ
```

## 4.1 ทดสอบทั้งรอบก่อนแตะฐานข้อมูลจริง

```bash
npm run db:test-migration
```

สร้างฐานข้อมูลชั่วคราวบน RDS instance เดิม โหลด schema และ seed ของ V2 ลงไป
แล้วรัน upgrade → ทดสอบ foreign key ด้วยข้อมูลจริง → rollback → ลบฐานข้อมูลนั้นทิ้ง
ฐานข้อมูลจริงไม่ถูกแตะต้อง รันซ้ำได้ตลอด

ต่างจาก `v3_01_verify.sql` ที่อ่านฐานข้อมูลที่ migrate แล้ว สคริปต์นี้รัน migration
เองทั้งรอบ จึงเป็นที่เดียวที่พิสูจน์เส้นทาง rollback ได้ รวมถึงสถานะ `RETURNED`
ที่ไม่มีใน V2 ผลรันล่าสุดอยู่ใน `docs/evidence/98-02-v2-v3-v2-roundtrip.txt`

## 5. กู้คืนฉุกเฉิน

ถ้า rollback เองก็ยังพัง ให้กู้จากไฟล์สำรองในข้อ 1:

```bash
pg_restore --clean --if-exists -d "$PGDATABASE" backup_v2_before_migration.dump
```
