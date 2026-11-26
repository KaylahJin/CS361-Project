# V7 – Integrated System

> issue: #259 (sub-issue ของ #262) · milestone: V7 – Integrated System (ครบกำหนด 30 พ.ย. 2569)
>
> Scope มาจากผล Grill ใน #257 และ #258 การแบ่งงานมาจากแผนที่ทีมยืนยันใน #263 และช่อง Evidence ที่ต้องวัดจาก AWS จริงจะเติมใน #260

## 1. Overview

V7 คือเวอร์ชันที่รวมทุกส่วนของระบบเป็นหนึ่งเดียว ตามโจทย์ V7 ใน PDF ของรายวิชาที่ให้ "บูรณาการข้อมูลนักศึกษา สถานประกอบการ แผนสหกิจศึกษา Workflow สถานะ/Deadline ประวัติการดำเนินงาน และ Dashboard พร้อมทบทวน Security, Privacy, Availability, Scalability, Performance และ Cost ของ Architecture โดยรวม"

V7 ไม่เพิ่ม Workflow หรือสถานะใหม่ งานของ V7 มี 3 ส่วน

1. **FR9:** เจ้าหน้าที่เห็นตัวเลขสรุประดับรุ่นในหน้าเดียว
2. **FR10:** นำข้อมูลเข้าและส่งข้อมูลออกได้ตามสิทธิ์
3. **ทบทวน Architecture ทั้ง 6 ด้าน** ด้วยหลักฐานที่ตรวจสอบได้ (เอกสารนี้)

ส่วนการทดสอบรวม V5–V7 ทั้งระบบ, Feedback, Final Report และพรีเซนต์อยู่ใน milestone `Final – Integration, Feedback & Delivery` (แผนอยู่ใน #264)

## 2. Scope (ตามผล Grill ใน #257 และ #258)

| | รายละเอียด | ที่มา |
|---|---|---|
| Primary User | เจ้าหน้าที่สหกิจ (`STAFF`) ผู้บริหารรับรายงานเป็นไฟล์ CSV อาจารย์ใช้ Workflow เดิม | #257 |
| In scope | flow เดิมของ V1–V6, หน้าสรุปสำหรับ `STAFF` (FR9), ส่งออกรายการแผนเป็น CSV ตามสิทธิ์ (FR10), นำเข้านักศึกษาแบบ Atomic Import คือถ้ามีแถวผิดให้ยกเลิกทั้งไฟล์ และตรวจด้วย Dry Run ก่อน (FR10), บันทึกว่าใครนำเข้าหรือส่งออก (FR7) | #258 |
| Out of scope | role ผู้บริหาร, สถานะเฟส 2–4 (Applied ถึง Completed), ซิงก์อัตโนมัติกับระบบทะเบียนหรือสถานประกอบการ, การแจ้งเตือน, HTTPS ผ่าน CloudFront, Multi-AZ, ตัวเลขแบบ real-time, เครื่องมือ BI ภายนอก | #257, #258 |

## 3. Architecture ทั้งระบบ

```mermaid
flowchart LR
    U["ผู้ใช้ 5 role<br/>STUDENT / ADVISOR / COMMITTEE / STAFF / ADMIN"]
    subgraph AWS["AWS Academy Learner Lab (us-east-1, LabRole)"]
        WEB["S3 static website<br/>React + Vite (HTTP)"]
        COG["Amazon Cognito<br/>User Pool"]
        API["API Gateway HTTP API<br/>JWT authorizer"]
        subgraph VPC["Default VPC"]
            L["Lambda companies<br/>Node.js 22, 128 MB"]
            DB[("RDS PostgreSQL 16<br/>db.t4g.micro single-AZ")]
        end
        S3A["S3 attachments<br/>private + SSE"]
    end
    REG["ระบบทะเบียน / สาขา<br/>(ไฟล์ CSV)"]
    EXP["ผู้รับไฟล์ส่งออก<br/>(ผู้บริหาร)"]

    U -->|โหลดหน้าเว็บ| WEB
    U -->|login| COG
    U -->|HTTPS + JWT| API
    API -->|ตรวจ token กับ| COG
    API --> L
    L -->|TCP 5432, SG ต่อ SG| DB
    L -->|presigned URL 300 วินาที ผ่าน gateway endpoint| S3A
    U -.->|อัปโหลด/ดาวน์โหลดด้วย presigned URL| S3A
    REG -.->|script นำเข้า #102| DB
    L -.->|CSV ส่งออก FR10 (V7)| EXP
```

เส้นประคือ flow ที่ไม่ได้ผ่านหน้าเว็บโดยตรง ส่วน FR9 ใช้เส้นทาง `U → API → L → DB` เดิมโดยไม่เพิ่ม component

### 3.1 component ละ 3 คำถาม

ทุก component ต้องตอบ 3 ข้อ คือรองรับ requirement ไหน ป้องกันปัญหาอะไร และ trade-off หรือ cost คืออะไร ถ้าตอบไม่ได้ให้เอาออก (CS361 Activity Be-a-System-Designer หน้า 10)

| Component | รองรับ requirement | ป้องกันปัญหาอะไร | Trade-off / Cost |
|---|---|---|---|
| S3 static website | FR1–FR10 (หน้าเว็บทั้งหมด) | ไม่ต้องดูแล server สำหรับไฟล์ static | ไม่มี HTTPS เพราะ Learner Lab ไม่ให้ใช้ CloudFront (`infra/terraform/s3_web.tf`) |
| Cognito User Pool | FR7 (ตัวตนและสิทธิ์) | ไม่ต้องเก็บรหัสผ่านเอง รหัสผ่านอย่างน้อย 12 ตัวอักษร token อายุ 60 นาที (`cognito.tf`) | ผูกกับ AWS และยังไม่เชื่อม SSO ของมหาวิทยาลัย |
| API Gateway + JWT authorizer | FR3–FR10 | route ที่ต้อง login ถูกปฏิเสธก่อนถึง Lambda (`apigateway.tf`) | ยังไม่ตั้ง throttling ของ stage เอง ใช้ค่า default ของบัญชี |
| Lambda `companies` (ตัวเดียว) | FR1–FR10 | ตรวจสิทธิ์ตาม role จาก `sub` ใน JWT ไม่เชื่อ `student_id` จาก client (working agreement §6 ข้อ 6) | ใช้ `LabRole` ร่วมกัน สิทธิ์กว้างกว่าที่ต้องใช้ ทุก route อยู่ใน function เดียว |
| RDS PostgreSQL | FR2, FR5–FR9 (Source of Truth) | constraint ของสถานะและความสัมพันธ์บังคับที่ DB (`infra/schema.sql`) | single-AZ เป็น single point of failure, `publicly_accessible = true` (`rds.tf`) |
| S3 attachments | FR3 (ไฟล์แนบของแผน) | bucket private, Block Public Access, SSE-AES256 และ presigned URL อายุ 300 วินาที (`deploy-attachments-bucket.sh`, `attachmentRules.mjs`) | ยังสร้างด้วย script ไม่ใช่ Terraform |
| S3 gateway endpoint | FR3 | Lambda ใน VPC คุยกับ S3 ได้โดยไม่ต้องมี NAT Gateway (`security_groups.tf`) | ใช้ได้เฉพาะ S3 |

## 4. ทบทวน Architecture 6 ด้าน

ทุกด้านใช้ 2 เครื่องมือ

- **ตาราง Threat | Control | Evidence | Trade-off:** จากสไลด์ CS361 Module08 หน้า 29
- **Decision template:** "We changed __ because __. We considered __ but rejected it because __. The trade-off is __." จากสไลด์ Activity หน้า 13 โดยเขียนเป็นภาษาไทย

ช่อง Evidence ที่เขียนว่า **#260** คือยังต้องวัดจาก AWS จริง ส่วนที่เหลือชี้ไปยังไฟล์ใน repo ที่ตรวจได้

### 4.1 Security

| Threat | Control | Evidence | Trade-off |
|---|---|---|---|
| ผู้ใช้ปลอมตัวเป็นนักศึกษาคนอื่น (IDOR) | API อ่านตัวตนจาก `sub` ใน JWT ที่ตรวจลายเซ็นแล้ว และตรวจ role ใน `authorize.mjs` | `infra/lambda/companies/authorize.mjs`, `authorize.test.mjs` | ทุก handler ต้องเรียกตรวจสิทธิ์เอง ถ้าลืมก็หลุด |
| เรียก API ที่ต้อง login โดยไม่มี token | JWT authorizer ของ API Gateway | `infra/terraform/apigateway.tf` | route สาธารณะ (เช่น `GET /companies`) ไม่มี authorizer โดยตั้งใจ |
| มีคนต่อ DB ตรงจากอินเทอร์เน็ต | SG ของ RDS รับ 5432 จาก SG ของ Lambda และจาก `my_ip_cidr` ของนักพัฒนาเท่านั้น | `infra/terraform/security_groups.tf`, ค่าจริงของ SG และ `publicly_accessible` → **#260** | ยังเปิด public ไว้ให้นักพัฒนาใช้ psql ได้ |
| function หนึ่งถูกเจาะแล้วเข้าถึง resource อื่นได้ | ข้อจำกัด: Learner Lab สร้าง IAM Role ไม่ได้ ทุก function จึงใช้ `LabRole` ชดเชยด้วยการตรวจสิทธิ์ฝั่ง backend และ DB user `coop_app` ที่สิทธิ์จำกัด | `docs/working-agreement.md` §8, `lambda.tf` (`DB_USER = "coop_app"`) | ขัดหลัก least privilege ในระดับ IAM (CS361 Module03 หน้า 5) |

> **Decision (Security):** เราเปลี่ยนจากการให้ทุก route ไม่ต้อง login มาใช้ JWT authorizer กับทุก route ที่แตะข้อมูลส่วนบุคคล เพราะต้องรู้ตัวตนก่อนตรวจสิทธิ์ตาม role เราพิจารณาให้ Lambda ตรวจ token เองแต่ไม่เลือก เพราะ request ที่ไม่มี token จะยังเรียก Lambda และเสียค่า invoke Trade-off คือผูกกับ Cognito และเปลี่ยน identity provider ได้ยาก

### 4.2 Privacy

| Threat | Control | Evidence | Trade-off |
|---|---|---|---|
| อาจารย์เห็นแผนของนักศึกษาที่ไม่ได้อยู่ในความดูแล | กรองด้วย `advisor_student_assignments` | `reviewAccess.test.mjs`, `docs/permission-matrix.md` | ต้องดูแลข้อมูลการจับคู่ให้ถูก |
| ไฟล์แนบหลุดเป็นลิงก์สาธารณะ | bucket private และ presigned URL อายุ 300 วินาที | `attachmentRules.mjs`, `deploy-attachments-bucket.sh` | ลิงก์หมดอายุเร็ว ผู้ใช้ต้องกดใหม่ |
| ไฟล์ส่งออก (FR10) มีข้อมูลส่วนบุคคลเกินสิทธิ์ (`students` มี `email`, `phone`, `birth_date`, `gpa`) | ตาราง role × ฟิลด์ที่ส่งออกได้ ตัดที่ฝั่ง server และมี test ต่อ role | มติ Grill ข้อ 7 ใน #258 และ test ใน #269 | ไฟล์ที่ส่งออกไปแล้วระบบควบคุมต่อไม่ได้ |
| ข้อมูลระหว่างทางถูกดักอ่าน | API ใช้ HTTPS และ DB ใช้ TLS (`ssl` ใน `db.mjs`) | `db.mjs` | หน้าเว็บเป็น HTTP แต่ไม่ได้ส่งข้อมูลส่วนบุคคลผ่านเส้นทางนั้นตรงๆ และ `rejectUnauthorized: false` ยังไม่ตรวจ certificate |

> **Decision (Privacy):** เราเลือกส่งออกเป็นไฟล์ CSV ที่กรองฟิลด์ตาม role แทนการให้ผู้บริหารมีบัญชีในระบบ เพราะผู้บริหารต้องการแค่รายงาน เราพิจารณาเพิ่ม role ผู้บริหารแต่ไม่เลือก เพราะต้องเพิ่มสิทธิ์และหน้าจอใหม่ Trade-off คือข้อมูลในไฟล์ที่ส่งออกไปแล้วอยู่นอกการควบคุมของระบบ

### 4.3 Availability

| Threat | Control | Evidence | Trade-off |
|---|---|---|---|
| AZ ของ RDS ล่ม | ไม่มี Multi-AZ ใช้การสร้างใหม่จาก Terraform และ seed (V5) เป็นแผน DR แบบ backup & restore (ACA M16 หน้า 30–42) | `rds.tf`, `docs/terraform-setup-guide.md`, RPO/RTO และ backup retention → **#260** | ข้อมูลที่สร้างหลัง backup ล่าสุดหาย |
| Learner Lab session หมดอายุแล้ว resource หยุด | ข้อจำกัดของ environment บันทึกไว้และมีขั้นตอนเปิดใหม่ | `docs/working-agreement.md` §8 | ระบบไม่ได้เปิดตลอด 24 ชม. |
| Lambda cold start ใน VPC ช้าจน timeout | timeout 10 วินาที | `lambda.tf` | request แรกหลังว่างนานช้า |
| ไฟล์นำเข้าผิดบางแถวแล้วข้อมูลเข้าไปครึ่งเดียว | Atomic Import ทั้งไฟล์อยู่ใน transaction เดียว และ Dry Run ก่อน (มติ #258) | #270 (script เดิมของ #102 commit ทีละแถว) | แถวที่ถูกต้องต้องรอจนแก้แถวที่ผิดครบ |

> **Decision (Availability):** เราเลือก backup & restore ด้วย Terraform และ seed แทน Multi-AZ เพราะระบบใช้ในการเรียนและข้อมูลสร้างใหม่ได้ เราพิจารณา Multi-AZ แต่ไม่เลือก เพราะค่า instance เพิ่มเป็นราว 2 เท่า Trade-off คือมี downtime ระหว่างสร้างใหม่ ตัวเลข RPO/RTO จริงรอ #260

### 4.4 Scalability

| Threat | Control | Evidence | Trade-off |
|---|---|---|---|
| Lambda scale จน connection ของ RDS เต็ม (ไม่มี RDS Proxy, CS361 Module06 หน้า 15) | pool ต่อ execution context มี `max: 5` | `db.mjs`, ค่า `max_connections` และเพดาน concurrency ตามสูตร (max_connections − others) × 0.8 ÷ 5 (CS361 Module10 หน้า 27) → **#260**, ปรับ config → **#261** | ยังไม่มี reserved concurrency ถ้าตั้งไว้ request ส่วนเกินจะถูก throttle |
| ตัวเลขสรุป (FR9) ช้าเมื่อข้อมูลโต | ใช้ aggregate query (GROUP BY/JOIN) บน RDS ก่อน ส่วน cache และ read replica เป็นทางเลือกที่ไม่เลือก (ACA M06 หน้า 9, ACA M12 หน้า 11 และ 16) | ผลวัดใน #266 และ #267 | ทุกครั้งที่เปิดหน้าคือ query ใหม่ |

> **Decision (Scalability):** เราตัด RDS Proxy ออกแล้วให้ Lambda ต่อ RDS ตรงด้วย pool ขนาดเล็ก เพราะ Proxy ทำให้ apply ช้าและติดสิทธิ์ใน Learner Lab (working agreement §8) เราพิจารณาคง Proxy ไว้แต่ไม่เลือก เพราะ traffic ระดับนี้ยังไม่คุ้ม Trade-off คือต้องคุมจำนวน connection เอง ซึ่ง #260 จะวัดเพดานจริง

### 4.5 Performance

| Threat | Control | Evidence | Trade-off |
|---|---|---|---|
| ค้นหา/กรองสถานประกอบการช้า | ปรับการโหลดหน้า Employers ใน V6 (#240, PR #251) | `docs/overview/V6-overview.md`, `docs/evidence/v6-03/` | วัดเฉพาะเส้นทาง Employers |
| หน้าสรุป FR9 ช้า | ตั้ง SLO ตามผู้ทดสอบ (CS361 Module10) แล้ววัดก่อนตัดสินใจเพิ่ม cache | ผลวัดใน #266 และ #267 | ยังไม่มีตัวเลข |

> **Decision (Performance):** เราเลือกวัดก่อนแล้วค่อยปรับ (Monitor → Measure → Decide, CS361 Module10 หน้า 3) แทนการเพิ่ม cache ล่วงหน้า เพราะ cache เพิ่มทั้งค่าใช้จ่ายและความเสี่ยงที่ตัวเลขไม่ตรงกับข้อมูลจริง และยังไม่มีตัวเลขว่าช้า Trade-off คือหน้าใหม่อาจช้าจนกว่าจะวัด

### 4.6 Cost

| Threat | Control | Evidence | Trade-off |
|---|---|---|---|
| ค่า RDS เดินตลอดแม้ไม่มีคนใช้ | ใช้ `db.t4g.micro` ขนาดเล็กสุดที่ใช้ได้ | `variables.tf` (`db_instance_class`) | capacity ต่ำ |
| ค่า NAT Gateway | ไม่มี NAT ใช้ S3 gateway endpoint แทน | `security_groups.tf`, `db.mjs` | Lambda ออกอินเทอร์เน็ตไม่ได้ |
| ค่า Lambda และ API ตาม request | ปรับการโหลดหน้า Employers ใน V6 (#240) และประเมิน cost ใน #241 | `docs/overview/V6-overview.md` §7 | ตัวเลข cost รอผล #241 และ #242 |

> **Decision (Cost):** เราเลือก serverless (Lambda + API Gateway) กับ RDS ขนาดเล็กแทน EC2 ที่เปิดตลอด เพราะ traffic ต่ำและเป็นช่วงๆ เราพิจารณา DynamoDB แต่ไม่เลือก เพราะข้อมูลมีความสัมพันธ์และ constraint มาก (CS361 Module06) Trade-off คือ RDS ยังเป็นค่าใช้จ่ายคงที่

### 4.7 จุดที่ต้องชี้แจงต่อกรรมการ

| จุด | สถานะ | เหตุผล / แผน | issue |
|---|---|---|---|
| RDS `publicly_accessible = true` | เปิดอยู่ | ให้นักพัฒนาใช้ psql จาก IP ของตัวเอง SG จำกัดแหล่งที่มา | #260, #261 |
| เว็บไม่มี HTTPS | ข้อจำกัด | Learner Lab ไม่มีสิทธิ์ CloudFront ส่วน API เป็น HTTPS | — |
| ทุก function ใช้ `LabRole` | ข้อจำกัด | สร้าง IAM Role ไม่ได้ ชดเชยด้วยการตรวจสิทธิ์ฝั่ง backend และ DB user สิทธิ์จำกัด | — |
| RDS single-AZ | ตั้งใจ | backup & restore ด้วย Terraform และ seed | #260 |
| ไม่มี RDS Proxy | ตั้งใจ | pool `max: 5` และเพดาน concurrency | #260, #261 |
| `lambda.tf` บน main | แก้แล้วใน 599e48c (#223) | ต้องรัน `terraform validate` ยืนยัน | #260 |

## 5. User Story ↔ FR ↔ Issue

| User Story | FR | Issue |
|---|---|---|
| US1–US10 ของ V4 (ดูข้อมูล, สร้าง/ส่งแผน, ตรวจแผน, Deadline, สิทธิ์และประวัติ, ค้นหา/กรอง) | FR1–FR8 | ดู `docs/overview/V4-overview.md` §6.1 |
| US11: เจ้าหน้าที่เห็นจำนวนนักศึกษาในแต่ละสถานะและรายการค้างหรือเกินกำหนด | FR9 | #266 (ใต้ #268) |
| US12: เจ้าหน้าที่เห็นสถานประกอบการที่มีนักศึกษาไป ช่วงภาระงานสูง และแนวโน้มการจัดสรรแหล่งฝึก | FR9 | #267 (ใต้ #268) |
| US13: เจ้าหน้าที่ส่งออกรายการแผนเป็นไฟล์ได้เฉพาะฟิลด์ที่มีสิทธิ์ | FR10, FR7 | #269 (ใต้ #271) |
| US14: ผู้ดูแลนำเข้านักศึกษารอบใหม่ได้โดยข้อมูลเดิมไม่เสีย | FR10 | #270 (ใต้ #271) ต่อยอด script ของ #102 |
| US15: ทีมอธิบาย Architecture และ trade-off ทั้งระบบได้ด้วยหลักฐาน | ทุก FR | #262 (#259, #260, #261, #263) |
| US16: ทีมมั่นใจว่า FR9 และ FR10 ใช้ได้กับทุก role ก่อนปิด V7 | FR9, FR10 | #272 |

## 6. การแบ่งงานของทีม

ตามแผนที่ทีมยืนยันใน #263 (เลยกำหนดยืนยัน 24 พ.ย. 2569 เวลา 21:00 น. โดยไม่มีผู้คัดค้าน) งานช่วงปิดโปรเจกต์อยู่ใน milestone `Final – Integration, Feedback & Delivery` ตามแผนใน #264

| issue | งาน | Assignee | Reviewer | ชม. | รอ |
|---|---|---|---|---:|---|
| #257 | Definition | @SunanthidaPhaengbao | ทุกคน (Grill) | 3 | — |
| #258 | Boundary | @SunanthidaPhaengbao | ทุกคน (Grill) | 3 | #257 |
| #262 | Overview & Architecture (issue หลัก) | @SunanthidaPhaengbao | — | 18 | #257, #258 |
| #259 | เอกสารนี้ | @SunanthidaPhaengbao | @KaylahJin | 6 | #257, #258, #263 |
| #260 | หลักฐาน Architecture จาก AWS | @Tatdanai6609611964 | @Pawit-Billamas | 5 | #259 |
| #261 | ปรับ config ตามผลทบทวน | @Tatdanai6609611964 | @ruvcandyfruit | 4 | #260 |
| #263 | วางแผนและแบ่งงาน V7 | @SunanthidaPhaengbao | ทุกคน (ติ๊ก) | 3 | #257, #258 |
| #268 | Dashboard (issue หลัก) | @Pawit-Billamas, @KaylahJin | — | 12 | #258 |
| #266 | จำนวนนักศึกษาตามสถานะและรายการค้าง | @Pawit-Billamas | @Tatdanai6609611964 | 6 | #258 |
| #267 | สถานประกอบการ ภาระงาน และแนวโน้ม | @KaylahJin | @SunanthidaPhaengbao | 6 | #258, #266 |
| #271 | นำเข้า/ส่งออก (issue หลัก) | @KaylahJin | — | 9 | #258 |
| #269 | ส่งออก CSV ตามสิทธิ์ | @KaylahJin | @Pawit-Billamas | 6 | #258 |
| #270 | นำเข้านักศึกษาแบบ Atomic Import | @KaylahJin | @Tatdanai6609611964 | 3 | #258 |
| #272 | [QA] ทดสอบกันเองในขอบเขต V7 (28 พ.ย.) | @ruvcandyfruit | @SunanthidaPhaengbao | 4 | #268, #271 |

**Tester ของ issue หลัก:** #262 → @Pawit-Billamas, #268 → @ruvcandyfruit, #271 → @Tatdanai6609611964 · **QA:** @ruvcandyfruit

**การสลับงาน (25 พ.ย. 2569 บันทึกใน #263):** เครดิต Learner Lab ของ @ruvcandyfruit หมด คนวางแผนจึงสลับ #269 (ส่งออก CSV ซึ่งต้อง deploy เอง) ไปให้ @KaylahJin และสลับ #279 (รวมหลักฐาน V5 + V6 ใน milestone Final ซึ่งเป็นงานเอกสาร) ไปให้ @ruvcandyfruit ส่วน #272 ยังเป็นของ @ruvcandyfruit โดยทดสอบบนระบบที่เพื่อน deploy ไว้

รวม V7 49 ชม. เมื่อรวมกับงานใน #264 (54 ชม.) ภาระต่อคนเป็นดังนี้

| คน | ชม. ใน V7 | ชม. รวมสอง milestone |
|---|---:|---:|
| @SunanthidaPhaengbao | 15 | 23 |
| @KaylahJin | 15 | 21 |
| @ruvcandyfruit | 4 | 21 |
| @Pawit-Billamas | 6 | 20 |
| @Tatdanai6609611964 | 9 | 18 |

## 7. ข้อจำกัดของ Environment

- AWS Academy Learner Lab ใช้ `LabRole` ร่วมกัน สร้าง IAM Role และใช้ CloudFront ไม่ได้ และ session หมดอายุเป็นรอบ (`docs/working-agreement.md` §8)
- เครดิต Learner Lab มีจำกัด และมีสมาชิกแจ้งใน #263 ว่าเครดิตเต็มแล้ว งานที่ต้อง deploy จึงต้องใช้บัญชีของสมาชิกที่ยังมีเครดิต
- ห้าม commit secret และหลักฐานทุกชิ้นต้องปิด secret กับข้อมูลส่วนบุคคลก่อนเก็บใน `docs/evidence/`
- สไลด์ของรายวิชาไม่ได้พูดถึง Terraform, PDPA, materialized view หรือ RDS Proxy ในเชิงลึก การตัดสินใจเรื่องเหล่านี้เป็นของทีมเอง

## 8. References

- โจทย์รายวิชา: "รายละเอียดโปรเจ็ครายวิชา CS361" (FR1–FR10, V7 – Integrated System)
- CS361 Module01 หน้า 9–17 (template Definition/Boundary และขนาด issue), Module03 หน้า 5 และ 59–63, Module06 หน้า 15 และ 26, Module08 หน้า 22–23 และ 29, Module09 หน้า 30, Module10 หน้า 3 และ 27, Activity Be-a-System-Designer หน้า 10, 13 และ 23
- AWS Academy ACA M02 หน้า 13–18 (Well-Architected), M06 หน้า 9, M12 หน้า 11 และ 16, M16 หน้า 30–42
- [V4 Overview](./V4-overview.md) · [V4 RDS Network Assessment](./V4-rds-network-assessment.md) · [V5 Overview](./V5-overview.md) · [V6 Overview](./V6-overview.md) · [Permission Matrix](../permission-matrix.md)
- [Terraform](../../infra/terraform/) · [Lambda](../../infra/lambda/companies/) · [Schema](../../infra/schema.sql)
