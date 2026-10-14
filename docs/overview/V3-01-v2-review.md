# V2 Architecture Review for V3

## 1. Existing V2 Architecture

จากเอกสาร `docs/overview/V2.md` และโค้ดที่ตรวจสอบ V2 มีองค์ประกอบหลักดังนี้

- **Frontend:** React และ TypeScript สำหรับแสดงข้อมูลและเรียก API
- **API:** API Gateway และ AWS Lambda สำหรับรับ Request และประมวลผลข้อมูล
- **Database:** PostgreSQL บน Amazon RDS โดยมี RDS Proxy เป็นตัวกลางในการเชื่อมต่อ
- **Infrastructure:** ใช้ Terraform สำหรับจัดการโครงสร้างพื้นฐานบน AWS
- **Data:** มีข้อมูลนักศึกษา สถานประกอบการ ตำแหน่งงาน ปีการศึกษา รอบสหกิจ และแผนสหกิจ

## 2. Reuse and Required Changes

| Component | Reuse from V2 | Changes for V3 |
|---|---|---|
| Frontend | โครงสร้าง React และ TypeScript | เพิ่มหน้าสร้าง แก้ไข ยื่นแผน และพิจารณาแผน |
| API / Lambda | โครงสร้าง API และ Lambda เดิม | เพิ่ม API สำหรับจัดการแผนและบันทึกผลพิจารณา |
| Database | ข้อมูลและตารางเดิมที่เกี่ยวข้อง | เพิ่มข้อมูลบัญชีผู้ใช้ บทบาท และผลการพิจารณาตาม Data Model ใหม่ |
| AWS Infrastructure | API Gateway, Lambda, RDS Proxy และ RDS | เพิ่ม Cognito และกำหนดการตรวจสอบ Token กับสิทธิ์ใน API |
| Workflow | ข้อมูลแผนสหกิจที่มีอยู่ | เพิ่มสถานะ การยื่นแผน ลำดับผู้ตรวจ และการป้องกันผลพิจารณาทับกัน |

## 3. Findings and Items to Verify

1. เอกสาร V2 ระบุว่า Authentication, Role-based Access Control และ Approval Workflow ยังอยู่นอกขอบเขตของ V2
2. มี API สำหรับอ่านข้อมูลแผนสหกิจ เช่น `GET /coop-plans` และ `GET /coop-plans/{planId}` แต่ต้องตรวจสอบ API และตารางจริงเพิ่มเติมก่อนกำหนดว่าจะใช้ต่อหรือปรับส่วนใด
3. ต้องตรวจสอบการตั้งค่า Authorization ของ API Gateway และวิธีตรวจสิทธิ์ใน Lambda ก่อนสรุปว่ามีระบบยืนยันตัวตนอยู่แล้วหรือไม่
4. Data Model ใน `V2.md` เป็นแบบออกแบบภาพรวม จึงต้องเทียบกับ Schema และฐานข้อมูลจริงก่อนออกแบบส่วนขยายของ V3

## 4. Conclusion

V3 สามารถใช้โครงสร้าง Frontend, API, Lambda และฐานข้อมูลของ V2 เป็นพื้นฐานได้ โดยเพิ่มระบบยืนยันตัวตน การตรวจสอบสิทธิ์ การจัดการสถานะแผน และผลการพิจารณา ทั้งนี้ การเปลี่ยนแปลงจริงต้องอ้างอิงโครงสร้างที่มีอยู่ใน Repository และตรวจสอบกับทีมก่อนเริ่มพัฒนา