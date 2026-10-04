# Position / Project Data Model

## 1. Purpose

ใช้เก็บข้อมูลตำแหน่งงานหรือโครงการสหกิจศึกษา เพื่อรองรับการแสดงผล การค้นหา การกรอง และการเชื่อมโยง Position / Project กับ Company

โครงสร้างนี้เป็นรายละเอียดของ Position / Project สำหรับ V2 และสอดคล้องกับ Data Model กลางที่กำหนดความสัมพันธ์ระหว่าง Company และ Position / Project แบบ 1:N

---

## 2. Schema

| Field | Type | Key | Required | Default | Description |
|---|---|---|---|---|---|
| `position_id` | VARCHAR(10) | PK | Yes | - | รหัส Position / Project เช่น `POS001` |
| `company_id` | VARCHAR(10) | FK | Yes | - | รหัส Company ที่ Position นี้สังกัด อ้างอิง `companies.company_id` |
| `title` | VARCHAR(255) | - | Yes | - | ชื่อตำแหน่งหรือโครงการ |
| `category` | VARCHAR(50) | - | Yes | - | หมวดงาน ใช้ค่ามาตรฐานสำหรับ Filter |
| `description` | TEXT | - | No | NULL | รายละเอียดของตำแหน่งหรือโครงการ |
| `qualification` | TEXT | - | No | NULL | คุณสมบัติของผู้สมัคร |
| `location` | TEXT | - | No | NULL | สถานที่ปฏิบัติงานของตำแหน่ง ซึ่งอาจแตกต่างจากที่อยู่หลักของ Company |
| `work_mode` | VARCHAR(20) | - | Yes | `unknown` | รูปแบบการทำงาน |
| `application_deadline` | DATE | - | No | NULL | วันปิดรับสมัคร หากต้นทางไม่ระบุให้เป็น NULL |
| `application_url` | TEXT | - | No | NULL | URL สำหรับสมัครตำแหน่งโดยตรง |
| `status` | VARCHAR(20) | - | Yes | `unknown` | สถานะการรับสมัคร |
| `source_url` | TEXT | - | No | NULL | URL ของแหล่งข้อมูลต้นทางที่ใช้เก็บหรือตรวจสอบข้อมูล |

`company_id` ใช้ `VARCHAR(10)` ให้ตรงกับ `companies.company_id` ของ Company Data Model

สำหรับ `category`, `work_mode` และ `status` ใช้ `VARCHAR` ร่วมกับ `CHECK constraint` แทน PostgreSQL ENUM เพื่อควบคุมค่าที่อนุญาต แต่ยังสามารถปรับชุดค่าในอนาคตได้ง่าย

---

## 3. Allowed Values and Constraints

### 3.1 Category

`category` ใช้สำหรับ Filter ตำแหน่ง จึงต้องเก็บในรูปแบบมาตรฐานเดียวกัน เพื่อไม่ให้เกิดค่าที่มีความหมายเหมือนกันแต่เขียนต่างกัน เช่น `UX_UI`, `UX/UI` และ `UX UI`

ค่าที่กำหนดให้ใช้มีดังนี้

| Value | Meaning |
|---|---|
| `software_development` | Software, Application, Web หรือ Mobile Development |
| `data_ai` | Data, Analytics, AI หรือ Machine Learning |
| `cloud_infrastructure_devops` | Cloud, Infrastructure, DevOps หรือ Platform |
| `qa_testing` | QA, Software Testing หรือ Test Automation |
| `business_enterprise_systems` | Business Analysis, System Analysis หรือ Enterprise Systems |
| `it_support_operations` | IT Support, Operations หรือ System Administration |
| `ux_ui_design` | UX/UI หรือ Product Design |
| `cybersecurity` | Cybersecurity หรือ Information Security |
| `technical_sales` | Technical Sales หรือ Solution Sales |
| `it_solutions` | งานด้าน IT Solution ที่ไม่เข้าหมวดเฉพาะด้านบน |
| `other` | ตำแหน่งที่ไม่สามารถจัดเข้าหมวดที่กำหนดได้ |

Frontend สามารถใช้ค่าดังกล่าวเป็น Filter value โดยตรง และแปลงเป็น Display Label สำหรับแสดงผลให้ผู้ใช้

### 3.2 Work Mode

`work_mode` กำหนดเป็น

```sql
NOT NULL DEFAULT 'unknown'
```

เพื่อไม่ให้ `NULL` และ `unknown` มีความหมายซ้ำกัน

| Value | Meaning |
|---|---|
| `onsite` | ปฏิบัติงานที่สถานที่ทำงาน |
| `hybrid` | มีทั้ง On-site และ Remote |
| `remote` | ปฏิบัติงานแบบ Remote |
| `unknown` | แหล่งข้อมูลไม่ได้ระบุรูปแบบการทำงาน |

### 3.3 Status

`status` กำหนดเป็น

```sql
NOT NULL DEFAULT 'unknown'
```

| Value | Meaning |
|---|---|
| `open` | มีข้อมูลหรือหลักฐานยืนยันว่าตำแหน่งกำลังเปิดรับสมัคร |
| `closed` | แหล่งข้อมูลระบุชัดว่าปิดรับสมัครแล้ว |
| `expired` | Deadline หรือรอบการรับสมัครที่ระบุไว้ผ่านไปแล้ว |
| `unknown` | ไม่สามารถยืนยันสถานะการรับสมัครปัจจุบันจากแหล่งข้อมูลได้ |

`application_deadline = NULL` หมายถึงแหล่งข้อมูลไม่ได้ระบุ Deadline ไม่ได้หมายความว่าตำแหน่งยังเปิดรับสมัคร ดังนั้นต้องพิจารณาร่วมกับ `status`

### 3.4 Constraints

```sql
CONSTRAINT chk_position_category
CHECK (
    category IN (
        'software_development',
        'data_ai',
        'cloud_infrastructure_devops',
        'qa_testing',
        'business_enterprise_systems',
        'it_support_operations',
        'ux_ui_design',
        'cybersecurity',
        'technical_sales',
        'it_solutions',
        'other'
    )
)

CONSTRAINT chk_position_work_mode
CHECK (
    work_mode IN (
        'onsite',
        'hybrid',
        'remote',
        'unknown'
    )
)

CONSTRAINT chk_position_status
CHECK (
    status IN (
        'open',
        'closed',
        'expired',
        'unknown'
    )
)
```

---

## 4. Relationship with Company

หนึ่ง Company สามารถมี Position / Project ได้หลายรายการ

```text
Company 1 ---- N Position
```

โดย

```text
positions.company_id
        ↓
companies.company_id
```

กำหนด Foreign Key ดังนี้

```sql
FOREIGN KEY (company_id)
REFERENCES companies(company_id)
ON DELETE RESTRICT
```

### Delete Behavior

เลือกใช้ `ON DELETE RESTRICT`

หาก Company ยังมี Position / Project อ้างอิงอยู่ ระบบจะไม่อนุญาตให้ลบ Company นั้นทันที

ต้องจัดการ Position / Project ที่เกี่ยวข้องก่อน จึงช่วยป้องกันการสูญเสียข้อมูล Position จากการลบ Company โดยไม่ตั้งใจ

---

## 5. Search and Filter

Position / Project ต้องรองรับ Search และ Filter สำหรับ V2

| Use Case | Field | Index |
|---|---|---|
| เรียก Position ของ Company | `company_id` | B-tree |
| Search จากชื่อตำแหน่ง | `title` | GIN Trigram |
| Filter ตามหมวดงาน | `category` | B-tree |
| Filter ตามรูปแบบการทำงาน | `work_mode` | B-tree |
| Filter ตามสถานะ | `status` | B-tree |

Indexes ที่กำหนดไว้

```sql
CREATE INDEX idx_positions_company_id
ON positions(company_id);

CREATE INDEX idx_positions_category
ON positions(category);

CREATE INDEX idx_positions_work_mode
ON positions(work_mode);

CREATE INDEX idx_positions_status
ON positions(status);

CREATE INDEX idx_positions_title_trgm
ON positions USING GIN (title gin_trgm_ops);
```

การ Search `title` แบบ Trigram ต้องใช้ PostgreSQL extension `pg_trgm`

หากระบบเปิดใช้งาน `pg_trgm` สำหรับ Company Search อยู่แล้ว สามารถใช้ extension เดียวกันกับ Position Search ได้

---

## 6. Application URL and Source URL

`application_url` และ `source_url` มีหน้าที่ต่างกัน แม้ในบางกรณีอาจมี URL เดียวกัน

### application_url

URL ที่ผู้ใช้สามารถใช้สมัครตำแหน่งโดยตรง เช่น

- Google Form
- Career Portal
- Recruitment Page
- Job Application Form

### source_url

URL ของแหล่งข้อมูลหรือประกาศที่ใช้เป็นที่มาของข้อมูล Position เช่น

- เว็บไซต์สหกิจศึกษา
- Job Announcement
- เว็บไซต์บริษัท
- หน้าประกาศตำแหน่ง

ตัวอย่าง

```text
เว็บไซต์สหกิจศึกษา
        ↓
source_url
        ↓
ประกาศรายละเอียด Position
        ↓
ปุ่มสมัคร
        ↓
Google Form
        ↓
application_url
```

ดังนั้นทั้งสอง Field ไม่ถือว่าซ้ำซ้อนกัน

---

## 7. Physical Schema Example

ตัวอย่างโครงสร้างตารางสำหรับ PostgreSQL

```sql
CREATE TABLE positions (
    position_id VARCHAR(10) PRIMARY KEY,

    company_id VARCHAR(10) NOT NULL,

    title VARCHAR(255) NOT NULL,

    category VARCHAR(50) NOT NULL,

    description TEXT,

    qualification TEXT,

    location TEXT,

    work_mode VARCHAR(20)
        NOT NULL
        DEFAULT 'unknown',

    application_deadline DATE,

    application_url TEXT,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'unknown',

    source_url TEXT,

    CONSTRAINT fk_position_company
        FOREIGN KEY (company_id)
        REFERENCES companies(company_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_position_category
        CHECK (
            category IN (
                'software_development',
                'data_ai',
                'cloud_infrastructure_devops',
                'qa_testing',
                'business_enterprise_systems',
                'it_support_operations',
                'ux_ui_design',
                'cybersecurity',
                'technical_sales',
                'it_solutions',
                'other'
            )
        ),

    CONSTRAINT chk_position_work_mode
        CHECK (
            work_mode IN (
                'onsite',
                'hybrid',
                'remote',
                'unknown'
            )
        ),

    CONSTRAINT chk_position_status
        CHECK (
            status IN (
                'open',
                'closed',
                'expired',
                'unknown'
            )
        )
);
```

Indexes

```sql
CREATE INDEX idx_positions_company_id
ON positions(company_id);

CREATE INDEX idx_positions_category
ON positions(category);

CREATE INDEX idx_positions_work_mode
ON positions(work_mode);

CREATE INDEX idx_positions_status
ON positions(status);

CREATE INDEX idx_positions_title_trgm
ON positions USING GIN (title gin_trgm_ops);
```

---

## 8. Example Data

```json
{
  "position_id": "POS001",
  "company_id": "C28",
  "title": "UX/UI Designer",
  "category": "ux_ui_design",
  "description": "ออกแบบ UI/UX สำหรับระบบ",
  "qualification": "นักศึกษาสาขาคอมพิวเตอร์หรือสาขาที่เกี่ยวข้อง",
  "location": "Bangkok",
  "work_mode": "unknown",
  "application_deadline": null,
  "application_url": null,
  "status": "unknown",
  "source_url": "https://sites.google.com/..."
}
```

`company_id = C28` เป็นตัวอย่างรูปแบบรหัสที่สอดคล้องกับ Company Data Model

ข้อมูลจริงของ Position ต้องใช้ `company_id` ที่มีอยู่จริงใน `companies` เพื่อให้ Foreign Key สามารถเชื่อมโยง Position / Project กับ Company ได้อย่างถูกต้อง

---

## 9. Alignment with V2 Data Model

โครงสร้างนี้ยังคงความสัมพันธ์ตาม Data Model กลางของ V2

```text
COMPANY
company_id PK
     │
     │ 1
     │
     │ N
     ▼
POSITION
position_id PK
company_id FK
```

การเพิ่มรายละเอียด Field, Constraint, Default Value และ Index เป็นรายละเอียดระดับ Physical Data Design เพื่อรองรับการจัดเก็บ Search และ Filter ใน V2 โดยไม่ได้เปลี่ยน Logical Relationship ที่กำหนดไว้ใน Data Model กลาง
