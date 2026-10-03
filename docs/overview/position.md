# Position / Project Data Model

## 1. Purpose
ใช้เก็บข้อมูลตำแหน่งงานหรือโครงการสหกิจ
เพื่อรองรับการแสดงผล Search / Filter และเชื่อมกับ Company

## 2. Schema

| Field | Type | Key | Required | Description |
|---|---|---|---|---|
| position_id | string | PK | Yes | รหัส Position/Project |
| company_id | string | FK | Yes | อ้างอิง Company |
| title | string | - | Yes | ชื่อตำแหน่ง/โครงการ |
| category | string | - | Yes | หมวดงาน เช่น Software, Data, AI |
| description | text | - | No | รายละเอียด |
| qualification | text | - | No | คุณสมบัติ |
| location | string | - | No | สถานที่ทำงาน |
| work_mode | enum | - | No | onsite / hybrid / remote / unknown |
| application_deadline | date | - | No | วันปิดรับสมัคร |
| application_url | string | - | No | Link สมัคร |
| status | enum | - | Yes | open / closed / expired / unknown |
| source_url | string | - | No | แหล่งข้อมูลต้นทาง |

## 3. Relationship

Company 1 - N Position

Position.company_id -> Company.company_id

## 4. Example

{
  "position_id": "POS001",
  "company_id": "COM028",
  "title": "UX/UI Designer",
  "category": "UX_UI",
  "description": "ออกแบบ UI/UX สำหรับระบบ",
  "qualification": "นักศึกษาสาขาคอมพิวเตอร์หรือสาขาที่เกี่ยวข้อง",
  "location": "Bangkok",
  "work_mode": "hybrid",
  "application_deadline": null,
  "application_url": null,
  "status": "unknown",
  "source_url": "https://sites.google.com/..."
}
