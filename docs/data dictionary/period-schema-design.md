# Period & Schedule Schema Design — Feature #47

`periods` and `coop_schedules` tables, defined in `infra/schema.sql`. Sample data: `infra/seed.sql`.

## 1. Overview & Relationship

เอกสารนี้กำหนดโครงสร้างข้อมูลสำหรับรอบเวลา (Period) และกิจกรรมกำหนดการ (Schedule Timeline) เพื่อย้ายจาก Static Data ไปสู่ Managed Data Source ตามข้อตกลงใน `v2.md`:

```text
รอบเวลาของสหกิจศึกษา (ปีการศึกษา/ภาคเรียน)
periods (1) ──< coop_schedules (N) [ON DELETE CASCADE]

แผนสหกิจของนักศึกษาในรอบนั้น
periods (1) ──< coop_plans (N) [belongs_to ตาม v2.md]
```

## 2. Fields Specification

### ตาราง `periods` (รอบเวลา/ภาคการศึกษา)

เก็บข้อมูลรอบปีการศึกษาและภาคเรียน 1 แถวต่อ 1 รอบเวลาหลัก

| **Field** | **Type** | **Required?** | **Key** | **Used for** | **คำอธิบาย** | **ตัวอย่าง** |
| --- | --- | --- | --- | --- | --- | --- |
| `period_id` | varchar(10) | **Yes** | **PK** | Unique ID, FK | รหัสเฉพาะของรอบเวลา ใช้ผูกกับ `coop_schedules`, `coop_plans` | `P2568-1` |
| `name` | text | **Yes** | | Display | ชื่อรอบการศึกษาแบบเต็มสำหรับแสดงผล | `ภาคการศึกษาที่ 1/2568` |
| `academic_year` | integer | **Yes** | | **Filter**, Sort | ปีการศึกษา (พ.ศ.) ใช้เป็นตัวกรองหลักบนหน้าเว็บ | `2568` |
| `semester` | varchar(5) | **Yes** | | Display, Filter | ภาคการศึกษา (`1`, `2`, `summer`) | `1` |
| `is_active` | boolean | **Yes** | | **Initial State** | ระบุว่าเป็นรอบปัจจุบันที่เปิดรับสมัครอยู่หรือไม่ (Default: false) | `true` |
| `created_at` | timestamptz | auto | | Internal only | วันเวลาที่สร้างเรคอร์ด | `now()` |

### ตาราง `coop_schedules` (กิจกรรมใน Timeline)

เก็บขั้นตอนและกำหนดการย่อยในแต่ละรอบเวลา 1 แถวต่อ 1 กิจกรรม

| **Field** | **Type** | **Required?** | **Key** | **Used for** | **คำอธิบาย** | **ตัวอย่าง** |
| --- | --- | --- | --- | --- | --- | --- |
| `schedule_id` | varchar(10) | **Yes** | **PK** | Unique ID | รหัสเฉพาะของกิจกรรม | `SCH-2568-01` |
| `period_id` | varchar(10) | **Yes** | **FK** | Relation | ผูกกับ `periods.period_id` (ลบแบบ CASCADE) | `P2568-1` |
| `step_order` | integer | **Yes** | | Timeline Sort | ลำดับขั้นตอนในไทม์ไลน์ เรียงจาก 1 ไป N | `1` |
| `title` | text | **Yes** | | Display, Search | ชื่องานหรือหัวข้อกิจกรรม | `เปิดรับสมัครสหกิจศึกษา` |
| `description` | text | **No** | | Display | รายละเอียด คำแนะนำ หรือสิ่งที่นักศึกษาต้องเตรียม | `นักศึกษายื่นความจำนงผ่านระบบ` |
| `activity_type` | varchar(30) | **Yes** | | Filter | ประเภทกิจกรรม (`APPLICATION`, `ORIENTATION`, `INTERVIEW`, `WORK_PERIOD`, `SUBMISSION`) | `APPLICATION` |
| `start_date` | date | **Yes** | | Display, Sort | วันเริ่มต้นกิจกรรม (ค.ศ.) | `2025-06-01` |
| `end_date` | date | **Yes** | | Display | วันสิ้นสุดกิจกรรม (ค.ศ.) | `2025-06-15` |
| `created_at` | timestamptz | auto | | Internal only | วันเวลาที่สร้างเรคอร์ด | `now()` |

## 3. Search & Filter

### Academic Year Dropdown

ใช้ `periods.academic_year`

- ใช้กรองข้อมูลตามปีการศึกษา

### Active Term Default

ใช้ `periods.is_active`

- ดึงรอบปัจจุบันมาแสดงผลเป็นค่าเริ่มต้นเมื่อเปิดหน้าเว็บ

### Activity Filter Tabs

ใช้ `coop_schedules.activity_type`

- ใช้กรองกิจกรรมตามประเภท
- ตัวอย่างเช่น:
  - `APPLICATION`
  - `INTERVIEW`
  - `ORIENTATION`
  - `WORK_PERIOD`
  - `SUBMISSION`

### Timeline Sorting

จัดเรียงข้อมูลตาม:

```sql
coop_schedules.step_order ASC,
coop_schedules.start_date ASC
```

### Searchable / Filterable Fields

ไม่มีฟิลด์อื่นที่สามารถ Search หรือ Filter ได้เพิ่มเติมในขอบเขต V2

## 4. Sample Data & JSON Structure (API Payload Example)

**Endpoint:**

```text
GET /api/schedules?period_id=P2568-1
```

**JSON:**

```json
{
  "period": {
    "period_id": "P2568-1",
    "name": "ภาคการศึกษาที่ 1/2568",
    "academic_year": 2568,
    "semester": "1",
    "is_active": true
  },
  "schedules": [
    {
      "schedule_id": "SCH-2568-01",
      "period_id": "P2568-1",
      "title": "เปิดรับสมัครและยื่นคำร้องสหกิจศึกษา",
      "description": "นักศึกษากรอกข้อมูลและเลือกสถานประกอบการผ่านระบบ",
      "activity_type": "APPLICATION",
      "start_date": "2025-06-01",
      "end_date": "2025-06-15",
      "step_order": 1
    },
    {
      "schedule_id": "SCH-2568-02",
      "period_id": "P2568-1",
      "title": "สัมภาษณ์และคัดเลือกโดยสถานประกอบการ",
      "description": "สถานประกอบการดำเนินการคัดเลือกและประกาศผล",
      "activity_type": "INTERVIEW",
      "start_date": "2025-06-16",
      "end_date": "2025-06-30",
      "step_order": 2
    },
    {
      "schedule_id": "SCH-2568-03",
      "period_id": "P2568-1",
      "title": "อบรมเตรียมความพร้อมก่อนปฏิบัติงาน",
      "description": "เข้าร่วมโครงการสัมมนาเชิงปฏิบัติการเตรียมความพร้อม",
      "activity_type": "ORIENTATION",
      "start_date": "2025-07-05",
      "end_date": "2025-07-10",
      "step_order": 3
    },
    {
      "schedule_id": "SCH-2568-04",
      "period_id": "P2568-1",
      "title": "ระยะเวลาปฏิบัติงานสหกิจศึกษา ณ สถานประกอบการ",
      "description": "ปฏิบัติงานจริงเต็มเวลาร่วมกับองค์กรพันธมิตร",
      "activity_type": "WORK_PERIOD",
      "start_date": "2025-08-01",
      "end_date": "2025-11-30",
      "step_order": 4
    },
    {
      "schedule_id": "SCH-2568-05",
      "period_id": "P2568-1",
      "title": "ส่งรายงานและประเมินผลการปฏิบัติงาน",
      "description": "ส่งรายงานผลการปฏิบัติงานสหกิจศึกษาฉบับสมบูรณ์",
      "activity_type": "SUBMISSION",
      "start_date": "2025-12-01",
      "end_date": "2025-12-15",
      "step_order": 5
    }
  ]
}
```