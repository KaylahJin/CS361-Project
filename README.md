# Cooperative Education Planning & Management System

## Getting started

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # unit tests, no AWS needed
```

The company list is served by a real AWS backend. To stand your own up:

| Doc | Use it for |
|---|---|
| [`docs/terraform-setup-guide.md`](docs/terraform-setup-guide.md) | **Deploying.** `terraform apply` + two helper commands builds the whole backend |
| [`docs/project-setup-guide.md`](docs/project-setup-guide.md) | Understanding what each AWS resource does, or building it by hand |
| [`docs/company-schema-design.md`](docs/company-schema-design.md) | The `companies` table and why its columns look like that |

Already have a stack? Point the frontend at it with `npm run env:sync`.

---


## Project Vision
ระบบที่สามารถให้บริการทางด้านข้อมูลได้อย่างครบถ้วนได้จากที่เดียว ในอนาคตสามารถให้นักศึกษายื่นแผนสหกิจและติดตามสถานะได้
## Primary User
นักศึกษาชั้นปีที่ 3 ที่สนใจจะเข้าแผนทางด้านสหกิจ
## Problem
นักศึกษาอาจพลาดข้อมูลสำคัญ เช่น กำหนดการ ข้อมูลไม่เพียงพอ
## V1 Goal
ช่วยให้นักศึกษาค้นหาและเข้าถึงข้อมูลที่จำเป็นสำหรับวางแผนสหกิจได้
## V1 In scope
- หน้าแสดงขั้นตอน คุณสมบัติ กำหนดการของสหกิจศึกษา
- ข้อมูลของสถานประกอบการ
## V1 Out of scope
- ระบบติดตาม อัพเดตสถานะความคืบหน้า ให้นักศึกษา
- ระบบเลือกหรือเสนอแผนสหกิจศึกษา
- ปรับปรุงและอนุมัติแผนสหกิจ
- พิจารณาและอนุมัติการสมัครของนักศึกษา โดยอาจารย์และเจ้าหน้าที่
## External actors / systems
- นักศึกษา
- เจ้าหน้าที่สหกิจศึกษา/สาขา
- ผู้ประสานงานสถานประกอบการ
## Open questions / To validate
- ข้อมูลเกี่ยวกับการยื่นแผนสหกิจมีการเปลี่ยนแปลงบ่อยครั้งมากแค่ไหน
- บริษัทสามารถให้ข้อมูลกับสถานศึกษาได้มากน้อยแค่ไหน
