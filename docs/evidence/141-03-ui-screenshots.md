# #141 หน้าเว็บตาม role: screenshot

ถ่ายจากเว็บจริงที่ deploy จาก branch นี้ รวม PR backend (`GET /me`) ด้วย Chrome ขนาด desktop 1280x800 และ mobile 390x844 ล็อกอินด้วยบัญชีทดสอบ student1, advisor1, staff1, admin1 ทุกครั้งที่ล็อกอิน `GET /me` ตอบ 200 และ role ตรงกับบัญชี

## ชุดที่ 1 (`141-03-<role>-<desktop|mobile>-*.png`)
แผนในระบบตอนนั้นของ student1 ยังเป็นฉบับร่าง

| Role | แท็บ "นักศึกษา" | ปุ่ม "ตรวจแผน" | ไฟล์ |
|---|---|---|---|
| STUDENT | ไม่มี | ไม่มี | `student-*-plans`, `student-desktop-no-students-tab`, `student-mobile-menu` |
| ADVISOR | มี | ไม่มี (ไม่มีแผนรอตรวจในที่ปรึกษา) | `advisor-*-plans`, `advisor-*-students`, `advisor-mobile-menu` |
| STAFF | มี | มี 3 ปุ่ม (3 แผนรอตรวจ) | `staff-*-plans`, `staff-*-students`, `staff-desktop-review-form` |
| ADMIN | มี | ไม่มี (ADMIN ไม่เห็นแผน) | `admin-*-plans`, `admin-*-students`, `admin-mobile-menu` |

## ชุดที่ 2 (`141-04-submitted-*.png`): แผนของ student1 เป็น `SUBMITTED`
ตั้งสถานะชั่วคราวใน DB ของ lab เพื่อถ่ายภาพ แล้วคืนเป็นฉบับร่างหลังถ่าย

| Role | สิ่งที่เห็น | ไฟล์ |
|---|---|---|
| STUDENT | เห็นแผนตัวเองแบบอ่านอย่างเดียว ไม่มีปุ่ม "ตรวจแผน" และไม่มีฟอร์มตรวจ | `student-desktop-plans`, `student-desktop-plan-detail-readonly`, `student-mobile-plans` |
| ADVISOR | มีปุ่ม "ตรวจแผน" และเปิดฟอร์มบันทึกผลได้ | `advisor-desktop-plans`, `advisor-desktop-review-form`, `advisor-mobile-plans` |

ไม่มีการกดบันทึกผลการตรวจในการถ่ายภาพ
