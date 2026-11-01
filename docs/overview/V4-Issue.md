# V4 Issue Structure

## 1. Template สำหรับสร้าง GitHub Issue

สมาชิกสามารถคัดลอก Template นี้ไปใส่ใน Description ของ Issue ได้

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
**Reviewer:**
```

## 2. ภาพรวมโครงสร้าง Issue ของ V4

แบ่งงานออกเป็น 5 กลุ่มหลักตามขอบเขตที่กำหนดไว้ใน V4 Overview

| รหัส | Issue หลัก | ผลลัพธ์ |
|---|---|---|
| V4-01 | Information, Data & Student Plan Flow | ข้อมูลสหกิจและกระบวนการสร้าง/ยื่นแผนของนักศึกษาทำงานได้ |
| V4-02 | Advisor Review, Resubmission & Access Control | ผู้ตรวจพิจารณา ส่งกลับ และให้นักศึกษายื่นใหม่ได้ตามสิทธิ์ |
| V4-03 | Deadline Display, Filtering & Limited Activity History | แสดงกำหนดเวลา กรองข้อมูล และแสดงประวัติกิจกรรมเท่าที่มีข้อมูลจริง |
| V4-04 | Reliability & Regression Testing | ตรวจสอบ TC1, TC2, RT1–RT5 และ REL1–REL6 พร้อมหลักฐาน |
| V4-05 | AWS RDS Networking Review & Architecture | ตรวจสอบสถานะเครือข่าย RDS และจัดทำ Diagram พร้อม Gap Analysis |

ความสัมพันธ์กับ Functional Requirements และการทดสอบให้ยึดตาม V4 Overview เป็นหลัก โดยไม่เพิ่มขอบเขตที่อยู่นอก Requirement

---

## 3. รายละเอียด Issue ที่เสนอ

### 3.1 V4-01: Information, Data & Student Plan Flow

**Problem/Goal:**

ระบบต้องแสดงข้อมูลและข้อกำหนดสหกิจที่มีอยู่ และรองรับกระบวนการของนักศึกษาตั้งแต่ค้นหา Employer/Position และ Period ไปจนถึงสร้าง ส่งแผน และติดตามสถานะ โดยรักษากติกาและ State Model ของ V3

**Task**

- [ ] ตรวจสอบและแสดงข้อมูลข้อกำหนดสหกิจศึกษาตาม FR1
- [ ] ตรวจสอบข้อมูล Student, Plan, Employer, Position และ Period ตาม FR2
- [ ] รองรับ TC2 ตั้งแต่ค้นหา Employer/Position และ Period จนถึงสร้างและส่งแผน
- [ ] ตรวจสอบความสัมพันธ์ของข้อมูลและกติกาการสร้างแผนตาม V3
- [ ] ตรวจสอบการติดตามสถานะและการป้องกันแผนซ้ำ

**Acceptance Criteria**

- [ ] ข้อมูลที่แสดงตรงกับแหล่งข้อมูลจริง
- [ ] ความสัมพันธ์ Student/Employer/Position/Period ถูกต้อง
- [ ] TC2 ผ่านตาม Expected Result
- [ ] ไม่มีแผนซ้ำตามกติกา V3
- [ ] Student ไม่เห็นแผนของ Student คนอื่น
- [ ] ไม่เปลี่ยน State Model หรือ Period Workflow โดยไม่มี Requirement

**ไม่รวม**

- หลาย Employer ต่อหนึ่ง Plan
- Period Workflow ใหม่
- Status Model ใหม่

**Depends on:** ข้อมูลและกติกาที่มีอยู่ใน V3

**Estimate:** กำหนดโดยทีม

**Reviewer:** กำหนดสมาชิกในทีม

**Evidence**

- [ ] Screenshot ข้อมูลและหน้าสร้าง/ยื่นแผน
- [ ] ผลทดสอบ TC2
- [ ] ผลตรวจสอบข้อมูลและการป้องกันแผนซ้ำ

---

### 3.2 V4-02: Advisor Review, Resubmission & Access Control

**Problem/Goal:**

ระบบต้องรองรับกระบวนการตรวจแผนของ Advisor ที่ได้รับมอบหมาย การส่งกลับพร้อมเหตุผล และการยื่นใหม่โดย Student โดยต้องรักษาสิทธิ์และ Workflow ของ V3

**Task**

- [ ] รองรับ TC1 สำหรับ Advisor ที่ได้รับมอบหมาย
- [ ] แสดงรายการและรายละเอียดแผนที่มีสิทธิ์พิจารณา
- [ ] รองรับการส่งกลับพร้อมเหตุผลและการยื่นใหม่โดย Student
- [ ] แสดงสถานะและความคิดเห็นที่จำเป็นต่อการพิจารณา
- [ ] ตรวจสอบ Role, ownership และ assignment ที่ Backend
- [ ] ตรวจสอบสถานะก่อนบันทึกผลพิจารณา
- [ ] ทดสอบกรณีไม่มีสิทธิ์และกรณีคำขอขัดแย้งกัน

**Acceptance Criteria**

- [ ] TC1 ผ่านตาม Expected Result
- [ ] RT1, RT2, RT4 และ RT5 ผ่าน หรือระบุ Not Run พร้อมเหตุผลและหลักฐาน
- [ ] การส่งกลับและส่งใหม่ไม่ทำให้ Workflow V3 เสียหาย
- [ ] ผู้ใช้ไม่สามารถเข้าถึงหรือแก้ไขข้อมูลนอกสิทธิ์
- [ ] Backend ตรวจสอบสิทธิ์โดยไม่พึ่งการซ่อนปุ่มบน UI
- [ ] การส่งกลับมีเหตุผลตามกติกาที่กำหนด

**ไม่รวม**

- Workflow หลังอนุมัติใหม่
- การเปลี่ยนสิทธิ์หรือสถานะโดยไม่มี Requirement

**Depends on:** V4-01 และกติกา Role/Workflow ของ V3

**Estimate:** กำหนดโดยทีม

**Reviewer:** กำหนดสมาชิกในทีม

**Evidence**

- [ ] Screenshot หน้าพิจารณาและการส่งกลับ
- [ ] ผลทดสอบ TC1 และการยื่นใหม่
- [ ] ผลทดสอบ RT1, RT2, RT4 และ RT5
- [ ] ผลทดสอบ Backend Permission

---

### 3.3 V4-03: Deadline Display, Filtering & Limited Activity History

**Problem/Goal:**

ผู้ใช้ต้องดูข้อมูลกำหนดเวลา ค้นหาและกรองแผนตามเงื่อนไขได้ โดยผลลัพธ์ต้องตรงกับข้อมูลจริงและไม่ละเมิดสิทธิ์ รวมถึงแสดง Activity History เฉพาะเมื่อมีข้อมูลรองรับ

**Task**

- [ ] ตรวจสอบแหล่งข้อมูล Deadline ที่มีอยู่
- [ ] แสดง Upcoming, Near Deadline, Overdue และ No Deadline ตามข้อมูลและเกณฑ์ที่ยืนยันแล้ว
- [ ] รองรับ Filter Student, Employer, Period และ Status ตามสิทธิ์
- [ ] ตรวจสอบแหล่งข้อมูล Activity History ที่มีอยู่
- [ ] แสดงเฉพาะประวัติที่ตรวจสอบย้อนกลับได้
- [ ] ระบุข้อจำกัดเมื่อไม่มีข้อมูลประวัติกิจกรรม

**Acceptance Criteria**

- [ ] ค่าที่แสดงตรงกับแหล่งข้อมูลจริง
- [ ] Near Deadline ใช้เกณฑ์ที่มีหลักฐานหรือมติทีม
- [ ] รายการที่เกินกำหนดแสดงเป็น Overdue เมื่อยังไม่เสร็จสิ้น
- [ ] หากไม่มีข้อมูล ให้แสดง No Deadline หรือ Unknown ตามกรณี
- [ ] Filter ให้ผลตรงกับเงื่อนไขและไม่ข้ามสิทธิ์
- [ ] Activity History ที่แสดงตรวจสอบย้อนกลับได้ หรือระบุข้อจำกัดของข้อมูลที่ไม่มี

**ไม่รวม**

- Deadline Management ใหม่
- Automated Notifications
- Full Audit Log

**Depends on:** ข้อมูล Deadline, Plan, Student, Employer, Period, Status และเกณฑ์ที่ทีมยืนยัน

**Estimate:** กำหนดโดยทีม

**Reviewer:** กำหนดสมาชิกในทีม

**Evidence**

- [ ] Screenshot การแสดง Deadline
- [ ] ผลทดสอบ Filter แต่ละประเภท
- [ ] หลักฐานแหล่งข้อมูล Activity History หรือข้อจำกัดที่พบ

---

### 3.4 V4-04: Reliability & Regression Testing

**Problem/Goal:**

ต้องตรวจสอบว่าความสามารถของระบบที่เกี่ยวข้องกับ V4 ทำงานได้ตาม Requirement และไม่ทำให้กติกา Workflow, Permission หรือ Data Integrity ของ V3 เสียหาย โดยทุกผลทดสอบต้องมีหลักฐานจริง

**Task**

- [ ] ทดสอบ TC1 และ TC2 ตาม Expected Result
- [ ] ทดสอบ RT1–RT5 ตามสภาพแวดล้อมที่อนุญาต
- [ ] ทดสอบ REL1–REL6 ตามสภาพแวดล้อมที่อนุญาต
- [ ] ตรวจ API Response, Authorization และ Data Integrity
- [ ] บันทึกผล Pass, Fail หรือ Not Run พร้อมหลักฐาน
- [ ] ระบุเหตุผลเมื่อไม่สามารถทดสอบบางกรณีได้

**Acceptance Criteria**

- [ ] ทุกกรณีมีผลทดสอบหรือเหตุผลที่ไม่ได้ทดสอบ
- [ ] RT1–RT5 มีหลักฐานยืนยันกติกา V3 ตามขอบเขตที่ทดสอบ
- [ ] REL1–REL6 มีผลทดสอบหรือเหตุผล Not Run
- [ ] ข้อสรุป Pass/Fail สอดคล้องกับผลทดสอบจริง
- [ ] ไม่มีการกล่าวอ้างว่าผ่านหากไม่มีหลักฐานรองรับ

**ไม่รวม**

- SLA Guarantee
- Large-scale Load Test
- Full Disaster Recovery

**Depends on:** V4-01, V4-02, V4-03 และ Test Cases ที่กำหนดใน Overview

**Estimate:** กำหนดโดยทีม

**Reviewer:** กำหนดสมาชิกในทีม

**Evidence**

- [ ] ผลทดสอบ TC1 และ TC2
- [ ] ผลทดสอบ RT1–RT5
- [ ] ผลทดสอบ REL1–REL6
- [ ] Log, API Response หรือ Screenshot ที่ตรวจสอบได้

---

### 3.5 V4-05: AWS RDS Networking Review & Architecture

**Problem/Goal:**

ต้องตรวจสอบสถานะเครือข่ายและการตั้งค่า RDS ที่ใช้งานจริง จัดทำ System/Network Diagram และเปรียบเทียบกับ Recommended Private RDS Target โดยคำนึงถึงข้อจำกัดของ AWS Academy

**Task**

- [ ] ตรวจสอบ Current State จาก Terraform และ AWS เท่าที่สิทธิ์อนุญาต
- [ ] จัดทำ System/Network Diagram อย่างน้อยหนึ่งหน้า
- [ ] ตรวจสอบว่า RDS อยู่ Private Subnets หรือไม่
- [ ] ตรวจสอบค่า `Publicly Accessible`, Security Groups และ Lambda VPC Configuration
- [ ] เปรียบเทียบ Current State กับ Recommended Private RDS Target
- [ ] วิเคราะห์ Gap, ผลกระทบ และข้อจำกัด AWS Academy
- [ ] หากมีการแก้ Configuration จริง ให้ทดสอบ Lambda-to-RDS และ Deployment หลังแก้ไข

**Acceptance Criteria**

- [ ] Diagram ตรงกับหลักฐานที่ตรวจสอบได้
- [ ] แยก Current State, Recommended Target State และ Gap ชัดเจน
- [ ] ระบุค่าที่ตรวจไม่ได้ พร้อมหลักฐาน Error หรือข้อจำกัดด้านสิทธิ์
- [ ] ไม่มีการอ้างว่า RDS เป็น Private หากไม่มีหลักฐานยืนยัน
- [ ] ไม่มีการเปิด DB ให้เข้าถึงจากทุก IP
- [ ] หากแก้ Configuration จริง ต้องมีผลทดสอบ Lambda-to-RDS และ Deployment

**ไม่รวม**

- การเปลี่ยน Network โดยไม่ตรวจสอบผลกระทบก่อน
- การเปิด DB ให้เข้าถึงจากทุก IP
- การอ้างว่า Private แล้วโดยไม่มีหลักฐาน

**Depends on:** Terraform Configuration, AWS Resource Information และสิทธิ์ AWS Academy ที่มีอยู่

**Estimate:** กำหนดโดยทีม

**Reviewer:** กำหนดสมาชิกในทีม

**Evidence**

- [ ] System/Network Diagram
- [ ] หลักฐาน Current State จาก Terraform/AWS
- [ ] ตารางเปรียบเทียบ Current State, Recommended Target State และ Gap
- [ ] หลักฐาน Error หรือข้อจำกัดเมื่อไม่สามารถตรวจสอบได้

---

## 4. หมายเหตุ

- ให้ใช้ V4 Overview เป็นแหล่งอ้างอิงหลักสำหรับ Scope, Acceptance Criteria, TC1/TC2, RT1–RT5 และ REL1–REL6
- รักษา Workflow, State Model, Role และ Permission ที่มีอยู่ใน V3 เว้นแต่ Requirement ระบุให้เปลี่ยนแปลง
- แยกผลทดสอบจริงออกจากกรณีที่ยังไม่ได้ทดสอบอย่างชัดเจน
- ก่อนสร้าง Sub-issues ให้ตรวจว่างานนั้นแยกมอบหมายและตรวจรับได้จริง และไม่ซ้ำกับ Issue ที่ทีมสร้างไว้แล้ว