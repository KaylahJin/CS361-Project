# 🗄️ V3 Database Migration Guide (Issue V3-03.1 #98)

คู่มือสำหรับการ Backup ข้อมูล, รัน Migration อัปเกรดเป็น V3, ตรวจสอบความถูกต้อง (Verify) และการย้อนกลับสู่ V2 (Rollback)  
*(คำสั่งด้านล่างจะดึงค่าคอนฟิกการเชื่อมต่อจากไฟล์ `.env` ประจำเครื่องโดยอัตโนมัติ)*

---

## 1. การสำรองข้อมูลก่อนทำรายการ (Database Backup)

สร้างไฟล์สำรองข้อมูล V2 ก่อนเริ่มดำเนินการทุกครั้ง:

### สำหรับ macOS / Linux (Bash/Zsh):
```bash
# โหลดค่าตัวแปรจาก .env และรัน pg_dump ทันที
export $(grep -v '^#' .env | xargs)
pg_dump -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -F p -f backup_v2_before_migration.sql
```

### สำหรับ Windows (PowerShell):
```powershell
# อ่านค่าจาก .env เข้าตัวแปร Environment ของ PowerShell
Get-Content .env | Where-Object { $_ -notmatch '^#' -and $_ -match '=' } | ForEach-Object {
    $name, $value = $_.Split('=', 2)
    [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim())
}
pg_dump -h $env:DB_HOST -p ($env:DB_PORT ?? 5432) -U $env:DB_USER -d $env:DB_NAME -F p -f backup_v2_before_migration.sql
```

---

## 2. ขั้นตอนการรัน Migration (Upgrade: V2 -> V3)

สคริปต์นี้จะสร้างตาราง `users`, `advisor_students`, `plan_reviews`, เพิ่มฟิลด์ `cognito_sub` ในตาราง `students` และปรับปรุง Workflow สถานะแผนสหกิจศึกษา

### วิธีที่ 1: รันผ่าน VS Code (สะดวกและแนะนำที่สุด)
1. เปิดไฟล์ `migrate/migrations/v3_01_upgrade.sql`
2. เลือก Connection ฐานข้อมูลประจำเครื่องตัวเองที่แท็บ **PostgreSQL**
3. คลุมโค้ดทั้งหมด (`Ctrl + A`) แล้วกด **Execute Query** (`F5` หรือคลิกขวา)
4. ตรวจสอบแผง Query Results ว่าคำสั่งทำงานสำเร็จครบถ้วน ไม่มี Error สีแดง

### วิธีที่ 2: รันผ่าน CLI (Terminal)
* **macOS / Linux:**
  ```bash
  export $(grep -v '^#' .env | xargs)
  psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -f migrate/migrations/v3_01_upgrade.sql
  ```
* **Windows (PowerShell):**
  ```powershell
  psql -h $env:DB_HOST -p ($env:DB_PORT ?? 5432) -U $env:DB_USER -d $env:DB_NAME -f migrate/migrations/v3_01_upgrade.sql
  ```

---

## 3. การตรวจสอบความถูกต้อง (Verification Test)

เปิดไฟล์ `migrate/migrations/v3_01_verify.sql` แล้วเลือกรันทีละชุดคำสั่งเพื่อทดสอบความถูกต้องและเก็บหลักฐาน (Evidence):

1. **ตรวจสอบโครงสร้างใหม่:**
   * ตาราง `users`, `advisor_students`, `plan_reviews` ต้องมีอยู่ในระบบ
   * คอลัมน์ `cognito_sub` ปรากฏอยู่ในตาราง `students`
2. **ทดสอบ Constraints ป้องกันข้อผิดพลาด (ต้องถูกระบบปฏิเสธและขึ้น Error สีแดง):**
   * **ยื่นแผนซ้ำ:** นักศึกษาคนเดิมยื่นแผนในรอบเดียวกัน 2 ครั้ง $\rightarrow$ ต้องติด `uq_coop_plans_active_period`
   * **สถานะไม่ถูกต้อง:** ใส่สถานะนอกเหนือจาก Enum V3 $\rightarrow$ ต้องติด `chk_coop_plans_status`
   * **Cognito Sub ซ้ำ:** ผู้ใช้ลงทะเบียน Sub ซ้ำกัน $\rightarrow$ ต้องติด `users_cognito_sub_key`
3. **ล้างข้อมูลทดสอบ:** รันคำสั่ง `DELETE` ช่วงท้ายไฟล์ เพื่อเคลียร์เรคคอร์ดจำลองออกจากฐานข้อมูล

---

## 4. ขั้นตอนการย้อนกลับสู่ระบบเดิม (Rollback: V3 -> V2)

กรณีเกิดข้อผิดพลาดหรือต้องการย้อนระบบกลับไปเป็นโครงสร้าง V2:

### 4.1 รันสคริปต์ Rollback
* **ผ่าน VS Code:** เปิดไฟล์ `migrate/migrations/v3_01_rollback.sql` แล้วกด **Execute Query**
* **ผ่าน CLI:**
  ```bash
  psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -f migrate/migrations/v3_01_rollback.sql
  ```

### 4.2 ตรวจสอบผลลัพธ์การ Rollback
รันคำสั่ง SQL ด้านล่างเพื่อยืนยันว่า Object ทั้งหมดของ V3 ถูกถอนออกเรียบร้อย:
```sql
-- 1. ตาราง V3 ต้องไม่พบในระบบ (ผลลัพธ์ต้องได้ 0 แถว)
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('plan_reviews', 'advisor_students', 'users');

-- 2. คอลัมน์ cognito_sub ใน students ต้องถูกลบออก (0 แถว)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'students' AND column_name = 'cognito_sub';

-- 3. ตรวจสอบสถานะ coop_plans (ต้องไม่มี DRAFT หรือ RETURNED หลงเหลือ)
SELECT DISTINCT status FROM coop_plans;
```

---

## 5. การกู้คืนฉุกเฉิน (Emergency Disaster Recovery)

หากการย้อนกลับด้วยสคริปต์ Rollback เกิดปัญหา ให้กู้คืนฐานข้อมูลกลับมาจากไฟล์สำรองที่สร้างไว้ในข้อ 1:

```bash
# กู้คืนฐานข้อมูลเดิมจากไฟล์ backup
psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -f backup_v2_before_migration.sql
```