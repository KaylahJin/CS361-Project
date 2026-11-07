# V5 – Infrastructure Automation & Reproducible Deployment

## 1. Overview

V5 มุ่งเน้นให้ Infrastructure และ Deployment ของระบบสามารถสร้าง ตั้งค่า และปรับใช้ซ้ำได้ด้วย Automation หรือ Infrastructure as Code (IaC) เพื่อลด Manual Configuration และลดความคลาดเคลื่อนระหว่างการติดตั้งหรือ Deploy แต่ละครั้ง

V5 พัฒนาต่อยอดจากระบบ V4 โดยใช้ AWS Infrastructure, Database, Backend API และ Frontend ที่มีอยู่ ไม่มุ่งเปลี่ยน Feature หรือ Business Workflow ของระบบ

## 2. Problem / Goal

### 2.1 Problem

ระบบมี Terraform และ Deployment Scripts สำหรับจัดการทรัพยากรบางส่วนแล้ว แต่ยังต้องตรวจสอบว่าขั้นตอนทั้งหมดสามารถทำซ้ำได้อย่างถูกต้องและปลอดภัยหรือไม่

ประเด็นที่ต้องให้ความสำคัญ ได้แก่

- Infrastructure บางส่วนจัดการผ่าน Terraform ขณะที่บางส่วนใช้ AWS CLI Script
- ขั้นตอนติดตั้งและ Deploy อาจต้องอาศัยการตั้งค่าด้วยมือหลายจุด
- การติดตั้ง Lambda และการจัดการ Dependency ต้องมีขั้นตอนที่ทำซ้ำได้
- Database Schema, Migration และ Seed ต้องรองรับทั้งการสร้างใหม่และการอัปเดตฐานข้อมูลเดิม
- Environment Variables, Credentials และ Secrets ต้องจัดการอย่างปลอดภัย
- Terraform State ต้องได้รับการดูแลอย่างเหมาะสม
- ยังต้องมีหลักฐานยืนยันว่า Environment ใหม่สามารถ Deploy ระบบได้จริงตามเอกสาร

### 2.2 Goals

1. ตรวจสอบและจัดระเบียบ Infrastructure as Code ที่มีอยู่
2. ทำให้การสร้างและตั้งค่า Infrastructure สามารถทำซ้ำได้
3. ทำให้ Backend / Lambda Deployment มีขั้นตอนที่ชัดเจนและทำซ้ำได้
4. ทำให้ Database Setup, Migration และ Seed สามารถดำเนินการซ้ำได้อย่างปลอดภัย
5. ทำให้ Frontend Deployment ใช้ขั้นตอน Automation ที่ตรวจสอบผลได้
6. จัดการ Environment, Credentials, Secrets และ Terraform State อย่างเหมาะสม
7. จัดทำเอกสาร Setup / Deployment ที่สมาชิกคนอื่นสามารถทำตามได้
8. ทดสอบ Reproducibility ตั้งแต่การเตรียม Environment จนถึงการตรวจสอบระบบหลัง Deploy

## 3. Current System

จากการตรวจสอบ Repository พบว่ามีองค์ประกอบที่สามารถนำมาต่อยอดได้ดังนี้

| ส่วน | สิ่งที่มีอยู่แล้ว | สิ่งที่ต้องตรวจสอบเพิ่มเติม |
|---|---|---|
| Infrastructure | Terraform สำหรับ RDS, RDS Proxy, Security Groups, Lambda, API Gateway, Cognito และ Secrets Manager | ความครบถ้วนของ Resource และการสร้างซ้ำจาก Configuration |
| Terraform State | `.gitignore` มี Pattern สำหรับละเว้น `*.tfstate`, `*.tfstate.*` และไฟล์ Terraform Plan | ตรวจสอบ Backend / ตำแหน่งจัดเก็บ สิทธิ์เข้าถึง วิธีสำรองและกู้คืน รวมถึงยืนยันว่าไม่มี State หรือ Plan ถูก Track ใน Repository |
| S3 | Script สำหรับสร้างและตั้งค่า Web Bucket และ Attachments Bucket | ความปลอดภัย ความสามารถในการรันซ้ำ และการจัดการ Resource นอก Terraform |
| Lambda | Terraform และโครงสร้าง Deploy Function | Dependency Installation, Packaging และการอัปเดต Function |
| Database | Schema, Migration และ Seed Scripts | Fresh Setup, Upgrade Existing DB และการรันซ้ำโดยไม่ทำข้อมูลเสียหาย |
| Frontend | Build และ Web Deploy Scripts | การ Sync API URL และการตรวจสอบหลัง Deploy |
| Environment | Environment Variables และ Secrets Manager | การแยกค่าตาม Environment และป้องกัน Secret รั่วไหล |
| Verification | API และ Authentication Verification Scripts | การตรวจสอบ End-to-End หลัง Deploy |

**หมายเหตุ:** 
- การมี Script อยู่แล้วไม่ได้หมายความว่าการ Deploy ซ้ำผ่านครบทุกขั้นตอน ต้องทดสอบกับ Environment จริงและบันทึกผลตามที่ดำเนินการได้
- การมี `.gitignore` ช่วยป้องกันการ Track ไฟล์ตาม Pattern แต่ไม่ได้ทำให้ Terraform State ที่จัดเก็บอยู่ปลอดภัยโดยอัตโนมัติ

## 4. System Boundary

### 4.1 In Scope

**Infrastructure as Code & Resource Automation**
- ตรวจสอบ Terraform Configuration และ Resource ที่ระบบใช้งานจริง
- ปรับปรุงการสร้างและตั้งค่า Infrastructure ให้ทำซ้ำได้
- จัดการ Resource ที่อยู่นอก Terraform ด้วย Script ที่มีขั้นตอนชัดเจนและสามารถรันซ้ำได้
- ตรวจสอบผลจาก Terraform Plan / Apply และ AWS CLI ตามสิทธิ์ที่มี

**Backend / Lambda Deployment**
- ตรวจสอบขั้นตอนติดตั้ง Dependency และ Packaging
- ทำให้การ Deploy Lambda ใช้ Artifact และ Configuration ที่ชัดเจน
- ตรวจสอบ API หลัง Deploy

**Database Setup**
- รองรับการสร้าง Database ใหม่จาก Schema
- รองรับ Migration สำหรับ Database ที่มีอยู่แล้ว
- ตรวจสอบการรัน Migration และ Seed ซ้ำ
- ป้องกันการเขียนทับข้อมูลที่มีอยู่โดยไม่ตั้งใจ

**Frontend Deployment**
- Build และ Deploy Web ผ่าน Script
- Sync API Endpoint จาก Infrastructure Output
- ตรวจสอบผลการ Deploy หลัง Upload

**Environment & Security**
- จัดการ Environment Variables และ Secrets
- ไม่ Commit Credentials หรือข้อมูลลับลง Repository
- ตรวจสอบแนวทางจัดเก็บและสำรอง Terraform State
- ระบุข้อจำกัดจาก AWS Academy และสิทธิ์ที่มี

**Documentation & Verification**
- จัดทำ Setup / Deployment Guide
- ทดสอบขั้นตอนตั้งแต่เตรียม Environment จนถึง Verify ระบบ
- เก็บหลักฐานการ Deploy และผลการทดสอบ

### 4.2 Out of Scope

- การเปลี่ยน Business Workflow หรือ Role ของระบบ
- การพัฒนา Feature ใหม่ของ Student / Advisor / Coordinator / Committee
- การเปลี่ยน Database Engine หรือย้าย Cloud Provider
- การเพิ่ม AWS Services ที่ไม่จำเป็นต่อ Requirement
- การทำ Full CI/CD Pipeline หากยังไม่จำเป็นต่อการพิสูจน์ Automation
- การสร้าง Production-grade High Availability หรือ Disaster Recovery ที่เกินขอบเขตและข้อจำกัดของ AWS Academy
- การเปลี่ยน Terraform Backend หรือเพิ่ม Resource ที่ต้องใช้สิทธิ์ซึ่ง AWS Academy ไม่อนุญาต โดยไม่มีการตรวจสอบก่อน

## 5. Planned Work

รายการ V5-01 ถึง V5-05 เป็น Work Breakdown ที่ร่างไว้ใน [Comment ของ Parent Issue #219](https://github.com/KaylahJin/CS361-Project/issues/219#issuecomment-6613063495) ยังไม่ใช่ Implementation Issues ที่เปิดแยกใน GitHub เมื่อสร้าง Issues จริงแล้ว ให้แทนที่รายการ Draft ด้วยหมายเลขและลิงก์ของแต่ละ Issue

| Issue (Draft) | งาน | Estimate | Dependencies | Expected Output |
|---|---|---:|---|---|
| V5-01 | Infrastructure Audit | 3 ชม. | - | ตาราง Resource, Automation Coverage และ Gap |
| V5-02 | Infrastructure Automation | 6 ชม. | V5-01 | Terraform และ Script สำหรับ Resource ที่เกี่ยวข้องสามารถตั้งค่าซ้ำได้ |
| V5-03 | Application Deployment | 6 ชม. | V5-01 | ขั้นตอน Package และ Deploy Lambda / Web ที่ทำซ้ำได้ |
| V5-04 | Database & Environment Setup | 6 ชม. | V5-01 | Database Setup, Migration, Seed และ Environment ที่ปลอดภัย |
| V5-05 | Reproducibility Test & Documentation | 6 ชม. | V5-02, V5-03, V5-04 | คู่มือและหลักฐานการติดตั้ง / Deploy / Verify ตั้งแต่ต้นจนจบ |

**Dependency Flow:** V5-01 ต้องเสร็จก่อน V5-02, V5-03 และ V5-04 ซึ่งสามารถดำเนินงานคู่ขนานกันได้ ส่วน V5-05 เริ่มได้เมื่อทั้งสามงานก่อนหน้าพร้อมสำหรับการทดสอบรวม

## 6. Deployment Flow

แนวทางการติดตั้งและ Deploy ที่ต้องรองรับ:

1. เลือก Source Revision ที่แน่นอนจาก Repository โดยใช้ Commit SHA เป็นหลัก หรือใช้ Tag ที่มีการป้องกันไม่ให้เปลี่ยนตำแหน่ง จากนั้น Clone Repository และ Checkout ไปยัง Revision นั้น พร้อมติดตั้งเครื่องมือที่จำเป็น
2. เตรียม AWS Credentials และ Environment Configuration อย่างปลอดภัย
3. ตรวจสอบ Terraform Configuration และดำเนินการ Infrastructure Deployment
4. สร้างหรืออัปเดต Database Schema, Migration และ Seed
5. Package และ Deploy Lambda / Backend
6. Sync API URL และ Build / Deploy Frontend
7. Verify API, Authentication, Database และ Web
8. บันทึกผลและหลักฐานการ Deploy โดยระบุ Repository, Commit SHA (หรือ Tag ที่ใช้) และผลการ Verify

แต่ละขั้นตอนต้องมีคำสั่งและผลลัพธ์ที่คาดหวังชัดเจน ไม่จำเป็นต้องรวมเป็นคำสั่งเดียว หากการแยกขั้นตอนช่วยให้ตรวจสอบและแก้ไขปัญหาได้ง่ายขึ้น

การ Deploy ซ้ำต้องใช้ Source Revision เดียวกันเมื่อมีวัตถุประสงค์เพื่อทำซ้ำผลเดิม และต้องบันทึก Revision ที่ใช้ทุกครั้ง

## 7. Constraints & Considerations

- ใช้ AWS Academy และ `LabRole` ตามสิทธิ์ที่ได้รับ
- หลีกเลี่ยงการสร้าง Resource ที่มีค่าใช้จ่ายโดยไม่จำเป็น
- ไม่เปิดเผย Credentials, Secrets หรือข้อมูลส่วนบุคคลใน Repository และ Log
- Terraform `sensitive` ไม่ได้ป้องกันข้อมูลลับจากการถูกบันทึกใน Terraform State ต้องจัดเก็บ State อย่างปลอดภัย
- ต้องตรวจสอบ Backend และตำแหน่งจัดเก็บ State ตาม Configuration ที่ใช้งานจริง หากใช้ Local State ต้องจำกัดสิทธิ์เข้าถึงไฟล์และจัดเก็บ Backup ในที่ปลอดภัย
- การเลือก Remote Backend, ระบบ Locking หรือบริการ Backup ต้องพิจารณาสิทธิ์และข้อจำกัดของ AWS Academy ก่อน ไม่ถือว่าเป็นข้อบังคับหาก Environment ไม่รองรับ
- S3 Script ต้องตรวจสอบก่อนรันซ้ำ เพื่อไม่ให้กระทบข้อมูลหรือ Resource ที่มีอยู่
- RDS และ Network Configuration ต้องยึดตามสภาพแวดล้อมจริงและข้อจำกัดของ Lab
- การทดสอบ Fresh Setup ต้องใช้ Environment ที่ปลอดภัย ไม่ทำลาย Resource หรือข้อมูลที่ทีมใช้งานอยู่
- Source Revision ที่ใช้ Deploy ต้องระบุได้แน่นอนและตรวจสอบย้อนกลับได้

## 8. Completion Criteria

- Infrastructure ที่อยู่ใน Scope สามารถสร้างหรือปรับใช้ซ้ำได้ด้วย Terraform หรือ Automation
- Lambda และ Web สามารถ Deploy ตามขั้นตอนที่กำหนดได้
- Database สามารถสร้างใหม่และ Migration ได้โดยข้อมูลไม่เสียหาย
- Environment และ Secrets ไม่มีการจัดเก็บใน Repository โดยไม่ปลอดภัย
- มีการตรวจสอบและบันทึก Backend / ตำแหน่งจัดเก็บ Terraform State และสิทธิ์เข้าถึงอย่างชัดเจน
- มีวิธีสำรองและกู้คืน Terraform State ที่เหมาะสมกับ Backend ที่ใช้งาน พร้อมผลทดสอบการกู้คืนเมื่อ Environment รองรับ หากข้อจำกัดของ AWS Academy ทำให้ทดสอบหรือใช้วิธีดังกล่าวไม่ได้ ต้องบันทึกข้อจำกัดและขั้นตอนกู้คืนที่ทำได้จริง
- ตรวจสอบแล้วว่า Terraform State และไฟล์ Plan ไม่ถูก Track หรือ Commit ลง Repository
- มีเอกสารที่สมาชิกคนอื่นทำตามได้
- มีผลทดสอบและ Evidence จากการ Deploy จริง โดยระบุ Commit SHA หรือ Tag ที่ใช้
- ข้อจำกัดที่ไม่สามารถดำเนินการได้ถูกบันทึกอย่างชัดเจน

## 9. References

- [Repository](https://github.com/KaylahJin/CS361-Project)
- [Terraform Setup Guide](../terraform-setup-guide.md)
- [Quick Setup](../QUICK_SETUP.md)
- [Working Agreement](../working-agreement.md)