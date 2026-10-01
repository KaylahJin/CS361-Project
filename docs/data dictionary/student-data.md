# Data Dictionary: Student Data (V2)

## 1. ภาพรวม

1. **นักศึกษาคือใคร อยู่หลักสูตรไหน** → ตาราง `students`
2. **นักศึกษามีคุณสมบัติสมัครเข้าแผนสหกิจหรือไม่** → `curricula` + `coop_course_rules` + `student_courses` (+ `students.gpa`)
3. **นักศึกษาอยู่สถานะใดของสหกิจ** → ดึงจาก `coop_plans.status`

### ความสัมพันธ์ระหว่างตาราง

```
เงื่อนไขของแต่ละหลักสูตร
curricula (1) ──< coop_course_rules       

แยกนักศึกษาตามหลักสูตร
curricula (1) ──< students

ผลการเรียนเฉพาะวิชาที่อยู่ในเงื่อนไข
students  (1) ──< student_courses 

แผนสหกิจของนักศึกษา
students  (1) ──< coop_plans
```

### หลักการออกแบบ

- **เก็บเฉพาะวิชาที่อยู่ในกติกา** ไม่เก็บทุกรายวิชา (ประมาณ 10–12 วิชาต่อคน)
- **เงื่อนไขเป็นข้อมูลในตาราง ไม่ฝังในโค้ด** เพราะหลักสูตร 61 กับ 66 มีวิชาและเงื่อนไขต่างกัน
- **ผลการตรวจคุณสมบัติคำนวณจาก Query/View ไม่เก็บเป็นคอลัมน์** เพื่อไม่ให้ค่าค้างเก่าเมื่อเกรดเปลี่ยน
- **เก็บสถานะสหกิจที่เดียว** คือ `coop_plans.status` เพื่อไม่ให้ข้อมูลซ้ำและไม่สอดคล้องกัน

---

## 2. ตาราง `students`

เก็บข้อมูลประจำตัวของนักศึกษา 1 แถวต่อ 1 คน

| Field | Type | Null | Key | คำอธิบาย | ตัวอย่าง |
|---|---|---|---|---|---|
| `student_id` | varchar(10) | NOT NULL | PK | รหัสนักศึกษา ใช้เป็นตัวระบุหลักและเป็น FK ใน `coop_plans`, `student_courses` | `6609610001` |
| `first_name` | text | NOT NULL | | ชื่อจริง แยกจากนามสกุลเพื่อค้นหาและเรียงลำดับได้ | `กานต์` |
| `last_name` | text | NOT NULL | | นามสกุล | `สุขสม` |
| `email` | text | NOT NULL | UNIQUE | อีเมลติดต่อ และจะใช้ผูกกับบัญชี Login ใน V3 | `karn.s@example.ac.th` |
| `phone` | varchar(20) | NULL ได้ | | เบอร์โทรศัพท์ติดต่อนักศึกษา เก็บเป็นข้อความ (ไม่ใช่ตัวเลข) เพื่อไม่ให้เลข 0 นำหน้าหาย และรองรับรูปแบบ +66 | `0812345678` |
| `birth_date` | date | NULL ได้ | | วันเกิดของนักศึกษา เก็บเป็นวันที่ค.ศ. (แสดงผลเป็น พ.ศ. ที่ฝั่งหน้าเว็บ) | `2004-05-17` |
| `curriculum` | varchar(2) | NOT NULL | FK → `curricula` | ปีหลักสูตรที่นักศึกษาใช้ ใช้เลือกกติกาวิชาและ Filter หลัก ต้องตรงกับ `coop_info.curriculum` | `61`, `66` |
| `gpa` | decimal(3,2) | NULL ได้ | | ผลการเรียนเฉลี่ยสะสม (GPAX) เมื่อสิ้นภาคการศึกษาสุดท้ายก่อนสมัคร ใช้เทียบเกณฑ์ `curricula.min_gpa` | `3.25` |

**Constraints**

- `gpa` ต้องอยู่ในช่วง 0.00–4.00 หรือเป็น NULL
- `curriculum` ต้องเป็นตัวเลข 2 หลัก และมีอยู่ใน `curricula`
- `email` ต้องไม่ซ้ำ
- `birth_date` ต้องอยู่ระหว่าง 1900-01-01 ถึงวันปัจจุบัน หรือเป็น NULL
- `phone` ต้องมีเฉพาะตัวเลข, + และ - หรือเป็น NULL

**Indexes**

- `curriculum` (Filter หลัก)
- GIN trigram (`pg_trgm`) บน `first_name`, `last_name` (ค้นชื่อแบบบางส่วน)
- `student_id` มี Index จาก PK อยู่แล้ว (ค้นด้วยรหัส)

---

## 3. ตาราง `curricula`

เก็บเกณฑ์ตัวเลขของแต่ละหลักสูตร 1 แถวต่อ 1 หลักสูตร

| Field | Type | Null | Key | คำอธิบาย | ตัวอย่าง |
|---|---|---|---|---|---|
| `curriculum` | varchar(2) | NOT NULL | PK | ปีหลักสูตร | `61`, `66` |
| `min_gpa` | decimal(3,2) | NOT NULL | | GPA สะสมขั้นต่ำเพื่อสมัครเข้าแผนสหกิจ | `2.75` |
| `min_core_avg` | decimal(3,2) | NOT NULL | | เกรดเฉลี่ยขั้นต่ำของกลุ่มวิชาที่ต้องเคยศึกษา | `2.50` |

**ข้อมูลตั้งต้น**

| curriculum | min_gpa | min_core_avg |
|---|---|---|
| 61 | 2.75 | 2.50 |
| 66 | 2.75 | 2.50 |

> หมายเหตุ: สามารถตั้งเป็นค่าคงที่ในโค้ดได้ แต่จะแก้ไขลำบาก

---

## 4. ตาราง `coop_course_rules`

เก็บเงื่อนไขรายวิชาของแต่ละหลักสูตร 1 แถวต่อ 1 วิชา

| Field | Type | Null | Key | คำอธิบาย | ตัวอย่าง |
|---|---|---|---|---|---|
| `rule_id` | integer | NOT NULL | PK (auto) | รหัสแถว | `1` |
| `curriculum` | varchar(2) | NOT NULL | FK → `curricula` | หลักสูตรที่กติกานี้ใช้ | `61` |
| `rule_type` | varchar(20) | NOT NULL | | ประเภทกติกา ดูตารางด้านล่าง | `COMPLETED_GROUP` |
| `slot_no` | integer | NOT NULL | | ลำดับช่องของกติกา **แถวที่ `curriculum`, `rule_type`, `slot_no` เดียวกัน = เลือกอย่างใดอย่างหนึ่ง (OR)** | `4` |
| `course_code` | varchar(10) | NOT NULL | | รหัสวิชา (ใช้รูปแบบเดียวกันทั้งระบบ เช่น `คพ.101`) | `คพ.213` |

**Unique:** (`curriculum`, `rule_type`, `slot_no`, `course_code`)

### ค่าของ `rule_type`

| ค่า | ความหมาย | นักศึกษาผ่านเมื่อ |
|---|---|---|
| `COMPLETED_GROUP` | วิชาที่ต้องเคยศึกษาและผ่านแล้ว | ทุก slot มีอย่างน้อย 1 วิชาที่ `status = PASSED` และเกรดเฉลี่ยกลุ่ม ≥ `min_core_avg` |
| `TAKING_OR_COMPLETED` | วิชาที่กำลังศึกษาหรือเคยศึกษา | ทุก slot มีอย่างน้อย 1 วิชาที่ `status` เป็น `ENROLLED` หรือ `PASSED` |
| `PASS_BEFORE_WORK` | วิชาที่ต้องสอบได้ก่อนออกปฏิบัติงานจริง | วิชานั้น `status = PASSED` (ตรวจก่อนเปลี่ยนเป็น In Progress ไม่ใช่ก่อนสมัคร) |

### ข้อมูลตั้งต้น: หลักสูตร 61

| rule_type | slot_no | course_code |
|---|---|---|
| COMPLETED_GROUP | 1 | คพ.101 |
| COMPLETED_GROUP | 2 | คพ.102 |
| COMPLETED_GROUP | 3 | คพ.111 |
| COMPLETED_GROUP | 4 | คพ.213 |
| COMPLETED_GROUP | 4 | คพ.216 |
| COMPLETED_GROUP | 5 | คพ.251 |
| COMPLETED_GROUP | 6 | คพ.264 |
| TAKING_OR_COMPLETED | 1 | คพ.384 |
| TAKING_OR_COMPLETED | 2 | คพ.266 |
| TAKING_OR_COMPLETED | 2 | คพ.322 |
| TAKING_OR_COMPLETED | 2 | คพ.348 |
| PASS_BEFORE_WORK | 1 | คพ.302 |

### ข้อมูลตั้งต้น: หลักสูตร 66

| rule_type | slot_no | course_code |
|---|---|---|
| COMPLETED_GROUP | 1 | คพ.100 |
| COMPLETED_GROUP | 2 | คพ.101 |
| COMPLETED_GROUP | 3 | คพ.102 |
| COMPLETED_GROUP | 4 | คพ.111 |
| COMPLETED_GROUP | 5 | คพ.213 |
| COMPLETED_GROUP | 5 | คพ.216 |
| COMPLETED_GROUP | 6 | คพ.251 |
| COMPLETED_GROUP | 7 | คพ.261 |
| TAKING_OR_COMPLETED | 1 | คพ.180 |
| TAKING_OR_COMPLETED | 2 | คพ.262 |
| TAKING_OR_COMPLETED | 2 | คพ.331 |
| TAKING_OR_COMPLETED | 2 | คพ.240 |
| PASS_BEFORE_WORK | 1 | คพ.301 |

---

## 5. ตาราง `student_courses`

เก็บผลการเรียนของนักศึกษา **เฉพาะวิชาที่อยู่ใน `coop_course_rules`** (และวิชาสหกิจศึกษาเมื่อถึง V4) 1 แถวต่อ 1 นักศึกษาต่อ 1 วิชา

| Field | Type | Null | Key | คำอธิบาย | ตัวอย่าง |
|---|---|---|---|---|---|
| `student_id` | varchar(10) | NOT NULL | PK (ส่วนที่ 1), FK → `students` | นักศึกษาเจ้าของผลการเรียน | `6609610001` |
| `course_code` | varchar(10) | NOT NULL | PK (ส่วนที่ 2) | รหัสวิชา ต้องใช้รูปแบบเดียวกับ `coop_course_rules.course_code` | `คพ.101` |
| `status` | varchar(10) | NOT NULL | | สถานะวิชา ดูตารางด้านล่าง | `PASSED` |
| `grade_point` | decimal(3,2) | NULL ได้ | | เกรดเป็นตัวเลข 0.00–4.00 เป็น NULL เมื่อยังเรียนอยู่หรือวิชาที่ไม่มีเกรดตัวเลข | `3.50` |

### ค่าของ `status`

| ค่า | ความหมาย | `grade_point` |
|---|---|---|
| `ENROLLED` | กำลังศึกษา | NULL |
| `PASSED` | เรียนและผ่านแล้ว | มีค่า (หรือ NULL ถ้าวิชาไม่มีเกรดตัวเลข) |
| `FAILED` | เรียนแล้วไม่ผ่าน | มีค่า (เช่น 0.00) หรือ NULL |

**Constraints**

- `grade_point` ต้องอยู่ในช่วง 0.00–4.00 หรือเป็น NULL
- `status` ต้องเป็นหนึ่งใน `ENROLLED`, `PASSED`, `FAILED`
- Primary key (`student_id`, `course_code`) หมายถึงเก็บผลล่าสุดของวิชานั้นเท่านั้น

---

## 6. ข้อมูลที่ไม่ได้เก็บเป็นคอลัมน์ (คำนวณเมื่อใช้งาน)

| ข้อมูล | คำนวณจาก | หมายเหตุ |
|---|---|---|
| ผ่านเกณฑ์ GPA หรือไม่ | `students.gpa` ≥ `curricula.min_gpa` | |
| เกรดเฉลี่ยกลุ่มวิชา | `grade_point` ของวิชาใน `COMPLETED_GROUP` | ดูคำถามที่ค้างหัวข้อ 8 |
| เคยศึกษาวิชาครบหรือไม่ | `student_courses` เทียบกับ `coop_course_rules` ทีละ slot | slot ที่มีหลายวิชา = OR |
| ผ่านคุณสมบัติโดยรวม | ผลรวมของสามข้อบน | |
| สถานะสหกิจของนักศึกษา | `coop_plans.status` ของแผนล่าสุด | ไม่มีแผน = ถือว่า Preparing |

---