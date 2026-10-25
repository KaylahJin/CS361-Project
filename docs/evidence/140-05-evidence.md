# #140 เหตุผลที่ยื่นแผนไม่ผ่าน

ถ่ายจากเว็บจริงด้วย Chrome: ล็อกอิน student1 เปิดแผนของตัวเอง กด "ยื่นแผน" แล้ว "ยืนยันยื่นแผน" API ปฏิเสธด้วย `SUBMISSION_REQUIREMENTS_NOT_MET`

| ภาพ | เหตุผลจาก API | สิ่งที่หน้าจอแสดง |
|---|---|---|
| `140-02` ก่อนแก้ | `SUBMISSION_WINDOW_CLOSED`, `REQUIRED_COURSES_MISSING` | "ยังไม่ผ่านเงื่อนไขข้อ required courses missing" (ขึ้นชื่อรหัสเป็นตัวพิมพ์เล็ก) |
| `140-03` หลังแก้ | เหมือนกัน | ข้อความภาษาไทยทั้ง 2 ข้อ |
| `140-04` หลังแก้ | ช่วงยื่นปิด, GPA ไม่ถึง, วิชาไม่ครบ | ข้อความภาษาไทยทั้ง 3 ข้อ |

ภาพ `140-04` ตั้ง GPA ของ student1 เป็น 2.40 ใน DB ของ lab ชั่วคราวเพื่อให้เกิดเหตุผล GPA แล้วคืนเป็น 2.90 หลังถ่าย ครบ 3 กรณีที่ issue ขอ: GPA ไม่ถึง, วิชาไม่ครบ, หมดเวลายื่น

รหัสอื่นของ backend (13 รหัสทั้งหมด) ตรวจด้วย `submissionMessages.test.ts` ที่อ่านไฟล์ backend โดยตรง ผลอยู่ใน `140-01-test-output.txt`

## ทำซ้ำได้อย่างไร
สคริปต์อยู่ในโปรเจกต์ `scripts/evidence/140-capture-submit-refusal.mjs` (วิธีใช้อยู่ในหัวไฟล์) ล็อกอิน student1 ยื่นแผน ถ่ายภาพกล่องที่ขึ้นมา และตรวจว่าทุกเหตุผลบนหน้าจอเป็นภาษาไทยและไม่มีชื่อรหัส ผลที่รัน: `SUBMISSION_WINDOW_CLOSED` และ `REQUIRED_COURSES_MISSING` ขึ้นเป็นภาษาไทยทั้งคู่

```bash
npm i --no-save playwright-core
EVIDENCE_SITE_URL=http://<bucket>.s3-website-us-east-1.amazonaws.com COOP_TEST_PASSWORD=...   node scripts/evidence/140-capture-submit-refusal.mjs 140-03-after-window-and-courses
```

กรณี GPA ไม่ถึง ตั้ง GPA ก่อนและคืนค่าหลังถ่ายด้วย `scripts/evidence/140-set-student-gpa.sql`

