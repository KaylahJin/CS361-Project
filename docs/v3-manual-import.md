# คู่มือการเตรียมไฟล์, รันสคริปต์, ตรวจผล และแก้ไขข้อมูลที่ไม่ผ่าน

---


## 1. เอกสารรูปแบบไฟล์และวิธีจัดการข้อมูลเดิม

### 1.1 ข้อกำหนดรูปแบบไฟล์ (CSV File Format Specification)

ไฟล์ CSV ทุกไฟล์ต้องเข้ารหัสแบบ UTF-8 (Comma-delimited) โดยมีคอลัมน์ดังนี้:

#### ก. ข้อมูลนักศึกษา (students.csv)
- student_id (Text, 10 หลัก, Required, Primary Key): เช่น 6100000001
- first_name (Text, Required): ชื่อภาษาไทย เช่น เอเอ
- last_name (Text, Required): นามสกุล เช่น สะกะดุ้ง
- email (Text, Required): อีเมลมหาวิทยาลัย เช่น test.aa@example.ac.th
- phone (Text, Nullable): เบอร์โทรศัพท์ รองรับทั้ง 08xxxxxxxx และ +66xxxxxxxxx (อนุญาตให้ว่างได้)
- birth_date (Date, Nullable): รูปแบบ YYYY-MM-DD เช่น 2002-01-15 (อนุญาตให้ว่างได้)
- curriculum (Text/Integer, Required): รหัสหลักสูตร เช่น 61, 66
- gpa (Decimal 2 ตำแหน่ง, Nullable): เช่น 3.20 (อนุญาตให้ว่างได้)

#### ข. ข้อมูลผลการเรียนรายวิชา (student_courses.csv)
- student_id (Text, 10 หลัก, Foreign Key อ้างอิง students.student_id)
- course_code (Text, Required): รหัสวิชา รองรับภาษาไทย เช่น คพ.101, คพ.213
- status (Enum/Text, Required): สถานะการเรียน รับค่า PASSED, FAILED, ENROLLED
- grade_point (Decimal 2 ตำแหน่ง, Nullable): เช่น 3.50, 0.00 (กรณีสถานะ ENROLLED ให้เว้นว่าง ระบบจะแปลงเป็น NULL)

> **หมายเหตุ:** การผูกข้อมูลอาจารย์ที่ปรึกษา (`advisor_student_assignments`) จะถูกจัดการผ่านคำสั่ง `npm run db:seed-users` (`infra/seed-app-users.sh`) ตาม Cognito User Pool โดยตรง จึงไม่มีการนำเข้าผ่านสคริปต์นี้


### 1.2 นโยบายการระบุ Key และการจัดการข้อมูลเดิม (Idempotent Upsert Policy)

1. **Key ที่ใช้ระบุข้อมูล:**
   - ข้อมูลนักศึกษา: ใช้ student_id
   - ข้อมูลรายวิชา: ใช้คู่ student_id + course_code

2. **กติกาการจัดการข้อมูลเดิม:**
   - **กรณีข้อมูลใหม่:** ทำการ INSERT เข้าตาราง
   - **กรณีมีข้อมูลเดิมและค่าเปลี่ยนแปลง:** ทำการ UPDATE เฉพาะฟิลด์ที่เปลี่ยน
   - **กรณีมีข้อมูลเดิมและค่าตรงกันทั้งหมด:** นับเป็น SKIPPED และไม่สั่งเขียนข้อมูลซ้ำ
   - **Foreign Key Violation:** หากพบ student_id ในรายวิชาที่ไม่มีใน students.csv ระบบจะนับเป็น failed และข้ามแถวดังกล่าว

---

## 2. คู่มือการเตรียมไฟล์, รันสคริปต์, ตรวจผล และแก้ไขข้อมูลที่ไม่ผ่าน

### 2.1 การตั้งค่า Environment Variables
ระบุค่าในไฟล์ .env ที่ root directory ของโปรเจกต์:

```env
PGHOST=<RDS-Endpoint-หรือ-Host>
PGPORT=5432
PGDATABASE=coop_db
PGUSER=postgres
PGPASSWORD=<DB-Password>
PGSSLMODE=require
```

### 2.2 คำสั่งการทำงาน
1. **ทดสอบความถูกต้องโดยไม่เขียนลงฐานข้อมูล (Dry-run):**
   ```bash
   npx tsx infra/migrate/source/student-import/import-students-grades.ts --dry-run
   ```
2. **นำเข้าข้อมูลจริงลงฐานข้อมูล (Import Run):**
   ```bash
   npx tsx infra/migrate/source/student-import/import-students-grades.ts
   ```
3. **ทดสอบการทำงานซ้ำ (Idempotency Re-run):**
   ```bash
   npx tsx infra/migrate/source/student-import/import-students-grades.ts
   ```

### 2.3 การแก้ไขปัญหาเบื้องต้น (Troubleshooting)

หลังสคริปต์ทำงานเสร็จสิ้น ระบบจะสรุปผลออกทางหน้าจอ Console และบันทึกผลการทำงานแบบละเอียดลงในไฟล์ reports/import-report.json เสมอ

| ปัญหาที่พบ | สาเหตุ | วิธีการแก้ไข |
|---|---|---|
| failed > 0 ในตารางวิชา | student_id ในไฟล์วิชาไม่มีอยู่ใน students.csv (FK Violation) | เพิ่ม นศ. ลงใน students.csv หรือลบวิชาที่ไม่มีเจ้าของออก |
| failed > 0 จากข้อมูลผิด | วันที่ผิด, GPA ไม่ใช่ตัวเลข, หรือรหัส นศ. ไม่ครบ 10 หลัก | ตรวจดู row number ใน reports/import-report.json แล้วแก้ไฟล์ CSV |
| สคริปต์ค้าง ไม่ขยับ | ติด Lock Contention จากคำสั่ง SELECT ... FOR UPDATE | สั่งปลด lock ใน DB: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND datname = current_database();` |
| Error: no encryption | ไม่ได้ระบุ SSL ในการต่อ Remote RDS | ใส่ `PGSSLMODE=require` ในไฟล์ .env |