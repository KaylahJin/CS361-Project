# V4 Issue Structure

## 1. Template สำหรับสร้าง GitHub Issue

สมาชิกสามารถคัดลอก Template นี้ไปใช้ใน Description ของ Issue ได้

```markdown
## Problem/Goal

## Task
- [ ]
- [ ]
- [ ]

## Acceptance Criteria
- [ ]
- [ ]
- [ ]

## Evidence
- [ ]
- [ ]
- [ ]

**Depends on:**
**Estimate:**
**Assignee:**
**Reviewer:**
```

## 2. ภาพรวมโครงสร้าง Issue ของ V4

แบ่งงานออกเป็น 5 กลุ่มหลักตามขอบเขตใน V4 Overview โดยใช้ระบบ V3 ที่มีอยู่แล้วเป็นฐาน ไม่สร้างความสามารถเดิมซ้ำโดยไม่จำเป็น

| รหัส | Issue หลัก | ผลลัพธ์ |
|---|---|---|
| V4-01 | Information, Data & Student Plan Flow | ยืนยันความถูกต้องของข้อมูลและ Student Plan Flow เดิม พร้อมแก้เฉพาะส่วนที่ V4 ยังขาด |
| V4-02 | Advisor Review, Resubmission & Access Control | ยืนยันกระบวนการพิจารณา การส่งกลับ การยื่นใหม่ และสิทธิ์การเข้าถึง พร้อมแก้เฉพาะส่วนที่ยังไม่ครบ |
| V4-03 | Deadline Display, Filtering & Limited Activity History | ตรวจสอบและพัฒนาการแสดง Deadline, Filter และ Activity History ตามข้อมูลที่มีจริง |
| V4-04 | Reliability & Regression Testing | ตรวจสอบความถูกต้องของระบบโดยรวม พร้อมหลักฐานผลทดสอบปัจจุบัน |
| V4-05 | AWS RDS Networking Review & Architecture | ตรวจสอบ AWS Networking จัดทำ Diagram และวิเคราะห์ช่องว่างระหว่าง Current State กับ Recommended Target |

**หลักการทำงานร่วมกัน**

- ใช้ V3 ที่ทำเสร็จแล้วเป็นฐาน ไม่เขียน Workflow, Authentication, Authorization หรือ Database ใหม่หากยังทำงานถูกต้อง
- ตรวจสอบผลการทำงานปัจจุบันก่อนตัดสินใจแก้โค้ด
- หากฟังก์ชันมีครบและมีหลักฐานเพียงพอ ให้ตรวจยืนยันแทนการพัฒนาซ้ำ
- หากพบข้อบกพร่อง ให้ระบุปัญหาและแก้เฉพาะส่วนที่เกี่ยวข้อง
- ใช้ V4 Overview เป็นแหล่งอ้างอิงหลักสำหรับ Scope, FR, TC, RT และ REL
- แยกงานที่ต้องส่งมอบภายในกำหนดออกจากงาน Next Version อย่างชัดเจน

---

## 3. รายละเอียด Issue

### 3.1 V4-01: Information, Data & Student Plan Flow

**Problem/Goal**

V3 มีระบบข้อมูลและกระบวนการของนักศึกษาอยู่แล้ว ตั้งแต่สร้างและบันทึกแผน ยื่นแผน ไปจนถึงติดตามสถานะ งาน V4 จึงต้องตรวจยืนยันว่าความสามารถเดิมยังทำงานถูกต้อง และพัฒนาเฉพาะส่วนที่ Requirement ของ V4 ยังไม่ครบ โดยไม่เปลี่ยน Workflow หรือ State Model ของ V3 โดยไม่มีข้อกำหนดรองรับ

**Task**

- [ ] ตรวจสอบการแสดงข้อมูลข้อกำหนดสหกิจตาม FR1
- [ ] ตรวจสอบข้อมูล Student, Plan, Employer, Position และ Period ตาม FR2
- [ ] ตรวจสอบเส้นทาง Student Plan Flow เดิม ตั้งแต่สร้างร่าง บันทึก แก้ไข ยื่นแผน และติดตามสถานะ
- [ ] ทดสอบ TC2 ตาม Expected Result ที่กำหนดใน V4 Overview
- [ ] ตรวจสอบความสัมพันธ์ของข้อมูล การป้องกันแผนซ้ำ และการจำกัดการเข้าถึงแผนตามเจ้าของ
- [ ] แก้เฉพาะข้อบกพร่องที่ตรวจพบและอยู่ใน Scope ของ V4
- [ ] บันทึกผลตรวจสอบและ Evidence โดยอ้างอิงผลทดสอบที่มีอยู่ได้เมื่อยังเกี่ยวข้องและตรวจสอบได้

**Acceptance Criteria**

- [ ] ข้อมูลที่แสดงตรงกับแหล่งข้อมูลจริง
- [ ] ความสัมพันธ์ Student, Employer, Position, Period และ Plan ถูกต้องตามกติกา V3
- [ ] TC2 ผ่าน หรือระบุ Not Run พร้อมเหตุผลและหลักฐานที่เกี่ยวข้อง
- [ ] การสร้างแผนและการป้องกันแผนซ้ำทำงานตามกติกา V3
- [ ] Student ไม่สามารถเข้าถึงหรือแก้ไขแผนของผู้อื่นได้
- [ ] ไม่พบข้อบกพร่องที่ขัดขวาง Student Plan Flow ในขอบเขตที่ตรวจสอบ หรือมีการบันทึก Known Issue อย่างชัดเจน
- [ ] ไม่มีการเปลี่ยน State Model หรือ Period Workflow โดยไม่มี Requirement รองรับ

**ไม่รวม**

- การสร้างระบบร่างและยื่นแผนใหม่ทั้งหมด
- หลาย Employer ต่อหนึ่ง Plan
- Period Workflow ใหม่
- Status Model ใหม่ที่ไม่มี Requirement รองรับ

**Depends on:** V3-02, V3-03, V3-04 และกติกาใน V3-01

**Estimate:** กำหนดโดยทีมตามงานที่ยังเหลือจริง

**Assignee:** กำหนดสมาชิกในทีม

**Reviewer:** กำหนดสมาชิกในทีม

**Evidence**

- [ ] Screenshot หรือหลักฐานการทำงานของ Student Plan Flow
- [ ] ผลทดสอบ TC2
- [ ] หลักฐานการตรวจสอบข้อมูล ความสัมพันธ์ และการป้องกันแผนซ้ำ
- [ ] ลิงก์ PR หากมีการแก้โค้ด

---

### 3.2 V4-02: Advisor Review, Resubmission & Access Control

**Problem/Goal**

V3 มีระบบ Authentication, Authorization และการพิจารณาแผนที่รองรับ Approved, Rejected และ Returned อยู่แล้ว งาน V4 ต้องยืนยันว่าผู้ตรวจเข้าถึงแผนตามสิทธิ์ได้ถูกต้อง การส่งกลับมีเหตุผล และนักศึกษาสามารถแก้ไขและยื่นใหม่ได้ตาม Workflow เดิม โดยไม่สร้างระบบพิจารณาใหม่

**Task**

- [ ] ตรวจสอบกระบวนการ Advisor Review เดิมตาม TC1
- [ ] ตรวจสอบการแสดงรายการและรายละเอียดแผนตาม Role, Ownership และ Assignment
- [ ] ตรวจสอบการอนุมัติ ไม่อนุมัติ และส่งกลับตามสถานะที่อนุญาต
- [ ] ตรวจสอบการส่งกลับพร้อมเหตุผลและการยื่นใหม่โดย Student
- [ ] ตรวจสอบ Backend Authorization โดยไม่พึ่งการซ่อนปุ่มบน UI
- [ ] ตรวจสอบการป้องกันการเปลี่ยนสถานะที่ไม่ถูกต้องและคำขอที่ขัดแย้งกัน
- [ ] ทดสอบ RT1, RT2, RT4 และ RT5 ตามนิยามใน V4 Overview
- [ ] แก้เฉพาะข้อบกพร่องที่พบในกระบวนการพิจารณาและสิทธิ์

**Acceptance Criteria**

- [ ] TC1 ผ่าน หรือระบุ Not Run พร้อมเหตุผลและหลักฐานที่เกี่ยวข้อง
- [ ] RT1, RT2, RT4 และ RT5 มีผลทดสอบหรือเหตุผล Not Run ตามจริง
- [ ] ผู้ตรวจเข้าถึงและพิจารณาเฉพาะแผนที่ตนมีสิทธิ์
- [ ] Student ไม่สามารถดูหรือแก้ไขแผนของผู้อื่น
- [ ] การส่งกลับมีเหตุผลตามกติกาที่กำหนด
- [ ] การยื่นใหม่ทำงานตาม Workflow V3
- [ ] Backend ปฏิเสธคำขอที่ไม่มีสิทธิ์หรือส่งสถานะที่ไม่ถูกต้อง
- [ ] ไม่มีข้อบกพร่องที่ขัดขวางกระบวนการพิจารณาในขอบเขตที่ตรวจสอบ หรือมีการบันทึก Known Issue อย่างชัดเจน

**ไม่รวม**

- การสร้างระบบอนุมัติและไม่อนุมัติใหม่
- Workflow หลังอนุมัติใหม่โดยไม่มี Requirement
- การเปลี่ยน Role, Permission หรือ State Model โดยไม่มี Requirement รองรับ

**Depends on:** V4-01, V3-01, V3-02, V3-03 และ V3-05

**Estimate:** กำหนดโดยทีมตามงานที่ยังเหลือจริง

**Assignee:** กำหนดสมาชิกในทีม

**Reviewer:** กำหนดสมาชิกในทีม

**Evidence**

- [ ] Screenshot กระบวนการพิจารณาและการส่งกลับ
- [ ] ผลทดสอบ TC1 และการยื่นใหม่
- [ ] ผลทดสอบ RT1, RT2, RT4 และ RT5
- [ ] หลักฐาน Backend Permission เช่น API Response หรือ Test Result
- [ ] ลิงก์ PR หากมีการแก้โค้ด

---

### 3.3 V4-03: Deadline Display, Filtering & Limited Activity History

**Problem/Goal**

ระบบต้องแสดงข้อมูลกำหนดเวลาและช่วยให้ผู้ใช้ค้นหาแผนได้สะดวก โดยข้อมูลต้องตรงกับแหล่งข้อมูลจริงและไม่ละเมิดสิทธิ์ งานนี้เน้นตรวจสอบความสามารถที่มีอยู่แล้ว และพัฒนาเฉพาะส่วนที่ยังขาดตาม FR6–FR8 รวมถึงแสดง Activity History เท่าที่มีข้อมูลรองรับ

**Task**

- [ ] ตรวจสอบแหล่งข้อมูลและกติกา Deadline ที่มีอยู่
- [ ] ตรวจสอบการแสดง Upcoming, Near Deadline, Overdue และ No Deadline ตามนิยามใน V4 Overview
- [ ] ยืนยันเกณฑ์ Near Deadline กับทีมก่อนนำไปใช้
- [ ] ตรวจสอบ Filter Student, Employer, Period และ Status ตาม FR8
- [ ] ตรวจสอบว่า Filter ทำงานร่วมกับ Role และ Permission อย่างถูกต้อง
- [ ] ตรวจสอบแหล่งข้อมูล Activity History และความสามารถในการตรวจสอบย้อนกลับ
- [ ] พัฒนาเฉพาะส่วนที่ยังขาดและอยู่ใน Scope ของ V4
- [ ] บันทึกข้อจำกัดเมื่อไม่มีข้อมูล Deadline หรือ Activity History ที่เพียงพอ

**Acceptance Criteria**

- [ ] Deadline ที่แสดงตรงกับแหล่งข้อมูลจริง
- [ ] Near Deadline ใช้เกณฑ์ที่มีหลักฐานหรือมติทีม
- [ ] Overdue แสดงเฉพาะรายการที่เกินกำหนดและยังไม่เสร็จสิ้นตามกติกาที่กำหนด
- [ ] กรณีไม่มีข้อมูลแสดง No Deadline หรือ Unknown ตามความหมายของข้อมูลจริง
- [ ] Filter ทั้ง 4 ประเภทให้ผลตรงกับเงื่อนไข
- [ ] Filter ไม่ทำให้ผู้ใช้เข้าถึงข้อมูลนอกสิทธิ์
- [ ] Activity History ที่แสดงมีข้อมูลรองรับและตรวจสอบย้อนกลับได้ หรือระบุข้อจำกัดอย่างชัดเจน
- [ ] ไม่มีการสร้าง Deadline Management, Notification หรือ Audit Log ใหม่โดยไม่มี Requirement

**ไม่รวม**

- Deadline Management ใหม่
- Automated Notifications
- Full Audit Log
- Analytics หรือ Reporting ใหม่ที่อยู่นอก Scope ของ V4

**Depends on:** ข้อมูล Plan, Student, Employer, Period, Status, Deadline และข้อกำหนด FR6–FR8 ใน V4 Overview

**Estimate:** กำหนดโดยทีมหลังตรวจสอบของเดิม

**Assignee:** กำหนดสมาชิกในทีม

**Reviewer:** กำหนดสมาชิกในทีม

**Evidence**

- [ ] Screenshot การแสดง Deadline
- [ ] ผลทดสอบ Filter แต่ละประเภท
- [ ] หลักฐานการตรวจสอบ Role/Permission ของ Filter
- [ ] หลักฐานแหล่งข้อมูล Activity History หรือข้อจำกัดที่พบ
- [ ] ลิงก์ PR หากมีการแก้โค้ด

---

### 3.4 V4-04: Reliability & Regression Testing

**Problem/Goal**

V3 มีการทดสอบกระบวนการหลักและการเชื่อมต่อฐานข้อมูลอยู่แล้ว งาน V4 ต้องนำผลเดิมมาใช้เป็นข้อมูลตั้งต้น และตรวจยืนยันว่าระบบเวอร์ชันปัจจุบันยังทำงานถูกต้องตาม Requirement ของ V4 โดยไม่ทำซ้ำงานพัฒนาฟีเจอร์ที่ Issue อื่นรับผิดชอบ

**Task**

- [ ] ตรวจสอบ Test Cases และ Evidence จาก V3-06 ที่ยังใช้ได้
- [ ] ทดสอบ TC1 และ TC2 ตาม Expected Result ใน V4 Overview
- [ ] ทดสอบ RT1–RT5 ตามนิยามและสภาพแวดล้อมที่อนุญาต
- [ ] ทดสอบ REL1–REL6 ตามนิยามและสภาพแวดล้อมที่อนุญาต
- [ ] ตรวจ API Response, Authorization, Workflow และ Data Integrity ในส่วนที่เกี่ยวข้อง
- [ ] ทดสอบ Regression หลังรวมการแก้ไขที่เกี่ยวข้องกับ V4
- [ ] บันทึกผล Pass, Fail หรือ Not Run พร้อมหลักฐาน
- [ ] แยก Blocker และ Known Issue พร้อมระบุผลกระทบ

**Acceptance Criteria**

- [ ] ทุกกรณีทดสอบที่อยู่ใน Scope มีผลทดสอบ หรือระบุ Not Run พร้อมเหตุผลและหลักฐานที่เกี่ยวข้อง
- [ ] TC1 และ TC2 มีผลทดสอบตาม Expected Result
- [ ] RT1–RT5 มีผลทดสอบหรือเหตุผล Not Run ตามจริง
- [ ] REL1–REL6 มีผลทดสอบหรือเหตุผล Not Run ตามจริง
- [ ] ผลทดสอบสอดคล้องกับระบบและเวอร์ชันที่ทดสอบจริง
- [ ] ไม่มีการอ้างว่าผ่านหากไม่มีหลักฐานรองรับ
- [ ] ไม่มี Blocker ที่ขัดขวางกระบวนการหลักเหลืออยู่โดยไม่มีการบันทึกและจัดการ
- [ ] ข้อจำกัดและ Known Issue ที่ยังไม่แก้ไขถูกบันทึกอย่างชัดเจน

**ไม่รวม**

- SLA Guarantee
- Large-scale Load Test ที่เกินทรัพยากรและเวลาที่มี
- Full Disaster Recovery
- การพัฒนาฟีเจอร์ซ้ำกับ V4-01, V4-02 และ V4-03

**Depends on:** V4-01, V4-02, V4-03 และ Test Cases ใน V4 Overview

**Estimate:** กำหนดโดยทีมตามจำนวนกรณีทดสอบที่ต้องทำจริง

**Assignee:** กำหนดสมาชิกในทีม

**Reviewer:** กำหนดสมาชิกในทีม

**Evidence**

- [ ] ผลทดสอบ TC1 และ TC2
- [ ] ผลทดสอบ RT1–RT5
- [ ] ผลทดสอบ REL1–REL6
- [ ] Log, API Response หรือ Screenshot ที่ตรวจสอบได้
- [ ] รายการ Blocker และ Known Issue
- [ ] ลิงก์ PR ที่เกี่ยวข้อง หากมีการแก้ไขระบบ

---

### 3.5 V4-05: AWS RDS Networking Review & Architecture

**Problem/Goal**

ต้องตรวจสอบสถานะเครือข่ายของ RDS และการเชื่อมต่อจาก Lambda ตามทรัพยากรที่ใช้งานจริง จัดทำ System/Network Diagram และวิเคราะห์ความแตกต่างระหว่าง Current State กับ Recommended Private RDS Target โดยคำนึงถึงข้อจำกัดของ AWS Academy

งานนี้ต่อยอดจากการใช้ Direct RDS Connection ใน V3 แต่การยืนยันว่าเชื่อมต่อฐานข้อมูลได้ ไม่ได้หมายความว่า RDS อยู่ใน Private Subnets หรือไม่มี Public Access

**Task**

- [ ] ตรวจสอบ Terraform Configuration ที่เกี่ยวข้อง
- [ ] ตรวจสอบ Current State จาก AWS เท่าที่สิทธิ์อนุญาต
- [ ] จัดทำ System/Network Diagram ที่แสดงองค์ประกอบและเส้นทางการเชื่อมต่อจริง
- [ ] ตรวจสอบ Subnets, `Publicly Accessible`, Security Groups และ Lambda VPC Configuration
- [ ] เปรียบเทียบ Current State กับ Recommended Private RDS Target
- [ ] วิเคราะห์ Gap, ผลกระทบ และข้อจำกัดของ AWS Academy
- [ ] ระบุค่าที่ตรวจไม่ได้ พร้อมหลักฐาน Error หรือข้อจำกัดด้านสิทธิ์
- [ ] หากมีการเปลี่ยน Configuration จริง ให้ทดสอบ Lambda-to-RDS และ Deployment หลังแก้ไข

**Acceptance Criteria**

- [ ] Diagram ตรงกับหลักฐานที่ตรวจสอบได้
- [ ] แยก Current State, Recommended Target State และ Gap ชัดเจน
- [ ] มีหลักฐานจาก Terraform หรือ AWS สำหรับข้อสรุปที่ระบุ
- [ ] ระบุสิ่งที่ตรวจไม่ได้และข้อจำกัดด้านสิทธิ์ตามจริง
- [ ] ไม่มีการอ้างว่า RDS เป็น Private หากไม่มีหลักฐานยืนยัน
- [ ] ไม่มีการเปิด DB ให้เข้าถึงจากทุก IP
- [ ] หากแก้ Configuration จริง มีผลทดสอบ Lambda-to-RDS และ Deployment
- [ ] หากไม่สามารถปรับ Network ได้ภายในกำหนด มีข้อสรุปและแนวทางที่แนะนำสำหรับ Next Version

**ไม่รวม**

- การเปลี่ยน Network โดยไม่ตรวจสอบผลกระทบก่อน
- การเปิด DB ให้เข้าถึงจากทุก IP
- การรับรองว่า Private แล้วโดยไม่มีหลักฐาน
- การเปลี่ยนสถาปัตยกรรมหรือบริการ AWS เกินขอบเขตที่ทีมได้รับอนุญาต

**Depends on:** Terraform Configuration, AWS Resource Information และสิทธิ์ AWS Academy ที่มีอยู่

**Estimate:** กำหนดโดยทีมตามสิทธิ์และขอบเขตที่ตรวจสอบได้

**Assignee:** กำหนดสมาชิกในทีม

**Reviewer:** กำหนดสมาชิกในทีม

**Evidence**

- [ ] System/Network Diagram
- [ ] หลักฐาน Current State จาก Terraform/AWS
- [ ] ตาราง Current State, Recommended Target State และ Gap
- [ ] หลักฐาน Error หรือข้อจำกัดเมื่อไม่สามารถตรวจสอบได้
- [ ] ผลทดสอบ Lambda-to-RDS และ Deployment หากมีการเปลี่ยน Configuration

---

## 4. หมายเหตุสำหรับการดำเนินงาน

- ให้ใช้ V4 Overview เป็นแหล่งอ้างอิงหลักสำหรับ Scope, Acceptance Criteria, TC1/TC2, RT1–RT5 และ REL1–REL6
- รักษา Workflow, State Model, Role และ Permission ที่มีอยู่ใน V3 เว้นแต่ Requirement ระบุให้เปลี่ยนแปลง
- ไม่ต้องสร้างฟีเจอร์เดิมใหม่ หากตรวจสอบแล้วว่าทำงานถูกต้อง
- ผลทดสอบเดิมจาก V3 ใช้เป็นข้อมูลตั้งต้นได้ แต่ควรยืนยันว่าหลักฐานยังเกี่ยวข้องกับโค้ดและสภาพแวดล้อมปัจจุบัน
- แยก Implementation ออกจาก Verification และ Regression Testing เพื่อไม่ให้ Issue หลายอันรับผิดชอบงานเดียวกันซ้ำ
- ก่อนสร้าง Sub-issues ให้ตรวจ Issue ที่มีอยู่แล้ว และสร้างเฉพาะงานที่แยกมอบหมายและตรวจรับได้จริง
- หากมีการเปลี่ยน Scope หรือ Requirement ต้องปรับทั้ง Issue Structure และ V4 Overview ให้ตรงกัน
- งานที่ไม่สามารถทำได้ภายในกำหนด ให้บันทึกข้อจำกัด หลักฐาน และแผน Next Version โดยไม่กล่าวอ้างว่าผ่านทั้งที่ยังไม่ได้ทดสอบ