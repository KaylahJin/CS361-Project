# วิเคราะห์ Feedback และขอบเขตปรับปรุงระบบ V2

- **วันที่ตรวจ:** 7 ตุลาคม 2569 (Asia/Bangkok)
- **อ้างอิงงาน:** [Issue #81](https://github.com/KaylahJin/CS361-Project/issues/81)
- **สถานะ:** ร่างสำหรับตรวจทาน — ยังไม่ได้ส่ง Review, Merge หรือสร้าง Implementation Issues

---

## 1. ข้อสรุปที่เสนอให้ทีมตัดสินใจ

1. **ควรแก้ความถูกต้องและความชัดเจนของข้อมูลก่อนเพิ่มฟีเจอร์ใหม่** โดยเน้นการเชื่อมบริษัท–ตำแหน่ง–รอบเวลา การแยกข้อมูลที่ไม่ทราบออกจากข้อมูลที่ไม่มี และการทำให้ผลค้นหาตรงกับสิ่งที่ UI บอกผู้ใช้
2. **ใช้ RDS PostgreSQL และ RDS Proxy ตามโครงสร้างปัจจุบันต่อในรอบนี้** ยังไม่มีผลวัดที่สนับสนุนให้ย้ายระบบไป DynamoDB หรือถอด Proxy ออก การเปรียบเทียบ DynamoDB ในเอกสารนี้เป็นทางเลือกเชิงออกแบบ ไม่ใช่คำอธิบายระบบที่ deploy อยู่
3. **เสนอแผนงาน 55 person-hours และสำรอง 5 person-hours รวมสูงสุด 60 ชั่วโมง** สมาชิก 5 คน คนละไม่เกิน 12 ชั่วโมง รวมวิเคราะห์ พัฒนา ทดสอบ และรีวิวแล้ว

---

## 2. แหล่งข้อมูลและขอบเขตการตรวจ

### 2.1 แบบประเมินที่ได้รับ

| รหัส | ไฟล์ | ผลที่ผู้ทดสอบบันทึก | หมายเหตุ |
| :--- | :--- | :--- | :--- |
| **T1** | `CS361 V2 — PEER TESTER SHEET - nawapat thumthaisong(1).pdf` หน้า 1–2 | TC1 PARTIAL, TC2 PASS, TC3 PARTIAL; ไม่ต้องให้ Developer ช่วย | หัวกระดาษระบุ Tester Team G900-05 / Team Under Test G900-04 |
| **T2** | `CS361_V2_Tester_Sheet_Project_5_Real_User - pathanan bantad (1)(1).pdf` หน้า 1–2 | TC1–TC3 PASS; ไม่ต้องให้ Developer ช่วย | มีข้อสังเกตเรื่องลิงก์บริษัทและความเป็นปัจจุบันของข้อมูล |
| **T3** | `CS361_V2_Tester_Sheet_Project_5_Real_User - pathanan bantad(3).pdf` หน้า 1–2 | TC1–TC3 PASS; ไม่ต้องให้ Developer ช่วย | ชื่อผู้ทดสอบและรายละเอียดหน้าแรกคล้าย T2 แต่หน้าสรุประบุว่าไม่มีข้อสังเกต |

> **หมายเหตุการประเมิน:**
> - T2/T3 ระบุ Tester Team G650-06 และมีรหัส Team Under Test ที่มีรอยแก้ไข จึงต้องยืนยันกับทีมว่าเป็นการทดสอบเว็บเดียวกันและคนละรอบหรือไม่ ไม่นับ 3 ไฟล์เป็นผู้ใช้ 3 คน และไม่คำนวณอัตรา PASS รวม การรายงานข้อสังเกตจาก T1/T2 ยังเก็บไว้ครบ แต่ความตรงกันของเวอร์ชัน/ทีมที่ทดสอบเป็น Pending
> - ข้อความลายมือสำคัญใน T2 หน้า 2 ตรวจจากภาพแล้ว: *“บางบริษัท กดแล้วไม่ไป หน้าเว็บบริษัท”* และคำถามว่าระบบอัปเดตเป็นปัจจุบันไหม ข้อความหน้าแรกบางส่วนอ่านไม่ชัด จึงไม่ใช้เป็นข้อกล่าวอ้างเฉพาะเจาะจง

### 2.2 การสำรวจเว็บและ Source Code

- **เว็บที่ขอทดสอบ:** [http://pawit-coop-web-067504979088.s3-website-us-east-1.amazonaws.com/](http://pawit-coop-web-067504979088.s3-website-us-east-1.amazonaws.com/)
- **ผลการทดสอบการเข้าถึง:** เบราว์เซอร์ที่ใช้ตรวจเปลี่ยนไปยัง HTTPS และแสดง 502 Bad Gateway / connection closed จึงไม่สามารถเดิน flow จริงหรือประเมินภาพบน desktop/mobile ได้
  - ผลนี้ยืนยันเพียงว่าเข้าผ่านสภาพแวดล้อมการตรวจครั้งนี้ไม่ได้ ไม่ใช่หลักฐานว่าเว็บ HTTP ใช้งานไม่ได้สำหรับผู้ใช้ทุกคน และไม่ควรนำไปนับเป็น bug ของระบบโดยทันที
- **Repository Snapshot:** ตรวจ repository ตามทางเลือกที่ผู้ใช้ระบุ โดยตรึง snapshot ที่ commit [`4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1`](https://github.com/KaylahJin/CS361-Project/tree/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1)
  - ยังไม่ทราบว่าเว็บที่ deploy ใช้ commit นี้หรือไม่ และไม่ได้เข้าถึงฐานข้อมูลจริง, AWS Console, CloudWatch หรือรัน load test
- **ขอบเขต UX ในเอกสารนี้:** เป็นการตรวจ flow และ implementation จากโค้ด ไม่ใช่ผล usability test เพิ่มอีกหนึ่งคน ไม่มีการอ้างคะแนนสี ความเร็ว หรือความเหมาะสมบนมือถือจากการใช้งานจริง

### 2.3 รหัสหลักฐาน Source Code

ลิงก์ทุกไฟล์ด้านล่างตรึง commit เดียวกัน เพื่อให้ตรวจย้อนหลังได้:

| รหัส | แหล่งอ้างอิงและจุดตรวจ |
| :--- | :--- |
| **S1** | [`V2.md`](https://github.com/KaylahJin/CS361-Project/blob/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1/docs/overview/V2.md): Context, Core User Flow, Relationships |
| **S2** | [`Employers.tsx`](https://github.com/KaylahJin/CS361-Project/blob/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1/src/pages/Employers.tsx): EmployerCard, getCompanies effects, วันที่ท้ายหน้า |
| **S3** | [`Positions.tsx`](https://github.com/KaylahJin/CS361-Project/blob/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1/src/pages/Positions.tsx): fetchPositions, filters, cards, detail modal |
| **S4** | [`positionApi.ts`](https://github.com/KaylahJin/CS361-Project/blob/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1/src/data/positionApi.ts): getPositions และ local fallback |
| **S5** | [`listPositions.mjs`](https://github.com/KaylahJin/CS361-Project/blob/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1/infra/lambda/companies/listPositions.mjs): query parameters และ SELECT_POSITIONS |
| **S6** | [`schema.sql`](https://github.com/KaylahJin/CS361-Project/blob/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1/infra/schema.sql): positions, periods, coop_plans, indexes |
| **S7** | [`positionsData.json`](https://github.com/KaylahJin/CS361-Project/blob/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1/src/data/positionsData.json): ข้อมูลสำรอง 64 รายการ |
| **S8** | [`db.mjs`](https://github.com/KaylahJin/CS361-Project/blob/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1/infra/lambda/companies/db.mjs): getPool |
| **S9** | [`proxy.tf`](https://github.com/KaylahJin/CS361-Project/blob/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1/infra/terraform/proxy.tf) และ [`lambda.tf`](https://github.com/KaylahJin/CS361-Project/blob/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1/infra/terraform/lambda.tf): Proxy, connection settings, DB_HOST |
| **S10** | [`App.tsx`](https://github.com/KaylahJin/CS361-Project/blob/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1/src/App.tsx): activeTab และการแสดงแต่ละหน้า |
| **L1** | `CS361_Module06-RDS vs DynamoDB Lab Session.pdf`: Part 4 เรื่อง Item Collection/Key, Part C Christmas Rush และ Architecture Studio; ใช้เป็นโจทย์วิเคราะห์ ไม่ใช่ผล benchmark ของโปรเจกต์นี้ |

---

## 3. เทียบกับ Requirements และ Boundary ของ V2

- **S1** กำหนดให้ Student, Company, Position, Academic Year, Period และ Coop Plan จัดเก็บใน Managed Data Source และเรียกดู/ค้นหา/กรองได้ รวมถึงดูข้อมูลที่สัมพันธ์กัน ส่วน Authentication, Role-based Access, Submit, Approval และ Status Workflow ยังอยู่นอก V2
- **ต้องแยกความหมายสองเรื่อง:**
  1. **สถานะประกาศรับสมัคร** เช่น open/closed/expired/unknown เป็นข้อมูลที่ผู้ใช้ต้องอ่านและกรองได้ ไม่ใช่การเพิ่ม Approval Workflow
  2. **รอบสหกิจที่ตำแหน่งรองรับ** ไม่ใช่วันปิดรับสมัคร และไม่ใช่รอบที่นักศึกษาคนหนึ่งเลือกใน Coop Plan
- S1 เชื่อม Period กับ Coop Plan แต่ยังไม่มีความสัมพันธ์ที่บอกโดยตรงว่าตำแหน่งเปิดสำหรับรอบไหน ขณะที่ TC1/TC3 ต้องใช้ข้อมูลนั้น จึงเป็นช่องว่างระหว่างแบบทดสอบกับ data model ที่ต้องตกลงให้ชัดก่อนพัฒนา ไม่ควรใช้ Coop Plan ที่มีอยู่มาอนุมานรอบรับสมัครของบริษัท

---

## 4. Feedback Register: รวมประเด็นซ้ำและผลตรวจสอบ

> **นิยามสถานะ:**
> - `Verified (Code/Data)`: ยืนยันได้จาก snapshot ที่ตรวจ ไม่ได้ยืนยัน deployment จริง
> - `Pending`: ยังต้องทดสอบหรือขอข้อมูลเพิ่ม ถ้ายืนยันได้เพียงบางส่วนจะระบุแยกไว้

| ID | ประเด็นและแหล่งที่มา | สถานะ / หลักฐาน | สาเหตุหรือข้อจำกัด | ผลกระทบและความเกี่ยวข้องกับ V2 | ลำดับ / ข้อเสนอ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F01** | รายละเอียดตำแหน่งมีหัวข้อไม่เหมือนกัน บางแห่งมีสถานที่ บางแห่งมีคุณสมบัติ [T1 TC1, Summary] | Verified Code/Data [S3,S7]; deployment Pending | UI ซ่อนหัวข้อที่ไม่มีค่า; ข้อมูลสำรองขาด location 32/64, qualification 7/64 | เทียบตำแหน่งยาก และแยกไม่ออกว่าไม่มีเงื่อนไขหรือยังไม่มีข้อมูล; อยู่ใน View Details | **P1 / I1** |
| **F02** | ไม่พบ open และข้อมูลไม่ครอบคลุม test cases [T1 TC2, Summary] | Verified เฉพาะ S7: expired 34, unknown 29, closed 1, open 0; DB จริง Pending | UI รองรับสถานะอยู่แล้ว ปัญหาที่เห็นใน snapshot คือชุดข้อมูล; ยังไม่ทราบว่ามีประกาศใหม่จริงหรือไม่ | เลือกโอกาสที่สมัครได้ยาก; อยู่ใน Search/Filter | **P1 / I1**; ไม่เปลี่ยนสถานะให้ open เพื่อให้ผลดูดี |
| **F03** | TC3 ยังไม่ชัดเรื่องรายการปิด/รอบที่ไม่มีตำแหน่ง; ขัดกับ PASS ใน T2/T3 [T1 TC3,T2,T3] | Verified ว่า Positions UI/API ไม่มี period filter และ schema ไม่มี position–period availability [S3,S5,S6]; ผลเก่าทำซ้ำไม่ได้ | มี Period ในแผน แต่ไม่มีข้อมูลว่าตำแหน่งรองรับรอบใด | ไม่สามารถรับรอง TC1/TC3 ตามโจทย์ได้ครบ; เป็นช่องว่าง requirement/model | **P1 / I2** |
| **F04** | บางบริษัทกดแล้วไม่ไปเว็บบริษัท [T2 Summary] | Pending รายบริษัท; Verified Code ว่าการ์ดใช้ `href=company.url` โดยตรง [S2] | ไม่ได้ระบุบริษัท/URL ที่เสีย; การ์ดไม่มีทางเลือกเมื่อ URL ว่าง | ผู้ใช้ไม่มีทางไปต่อ; ลิงก์ภายนอกเสียกับข้อมูลบริษัทหายต้องแยกกัน | **P1 / I3** |
| **F05** | ข้อมูลเป็นปัจจุบันไหม [T2 Summary] | Verified Code: วันที่ท้าย Employers hard-code 01/09/2569 [S2]; ไม่ยืนยันวันที่อัปเดตจริง | วันที่ทั้งหน้าไม่ใช่เวลาเช็กแต่ละประกาศ และ created_at ไม่ใช่ last_verified_at | ผู้ใช้อาจเข้าใจว่าประกาศยังเปิด; อยู่ในความน่าเชื่อถือของข้อมูล | **P1 / I1** |
| **F06** | จากบริษัทไปตำแหน่งที่เกี่ยวข้องไม่ต่อเนื่อง [UX review] | Verified Code [S2,S3,S10] | การ์ดบริษัทพาออกเว็บ; App แยกหน้าโดยไม่ได้ส่ง `company_id` ให้หน้า Positions | ผู้ใช้ต้องจำชื่อแล้วค้นซ้ำ แม้ API รองรับ `company_id`; ขัดกับ Related Company/Position flow | **P1 / I3** |
| **F07** | ช่องค้นหาระบุค้นสถานที่ แต่ backend ไม่ค้นสถานที่ [UX review] | Verified Code [S3,S4,S5] | placeholder รวมสถานที่; SQL ค้นเฉพาะ title/name/short_name แต่ fallback ค้น location และ description เพิ่ม | คำค้นเดียวกันอาจได้ผลต่างตามแหล่งข้อมูล; อยู่ใน Search correctness | **P1 / I4** |
| **F08** | เครือข่ายล้มเหลวแล้วแสดงข้อมูลสำรองโดยไม่แจ้ง [UX review] | Verified Code [S4] | TypeError ที่ข้อความมี fetch ทำให้คืน local JSON; แจ้งเฉพาะ `console.warn`; ไม่ใช่ fallback ของทุก error | ผู้ใช้คิดว่าเป็นข้อมูลล่าสุดจาก Managed Source; เสี่ยงอ่านสถานะเก่า | **P1 / I4** |
| **F09** | เปลี่ยนคำค้นเร็วอาจถูกผลเก่าทับ [Code review] | Verified ว่าไม่มี response guard/abort ใน fetchPositions [S3]; การเกิด race จริง Pending | debounce ยกเลิกเฉพาะ timer ไม่ยกเลิก request ที่ส่งแล้ว | คำค้นกับผลลัพธ์อาจไม่ตรง; Search correctness | **P1 / I4**; ทดสอบ response ที่กลับสลับลำดับ |
| **F10** | รายละเอียดตำแหน่งเข้าถึงด้วยคีย์บอร์ดไม่ครบ [UX review] | Verified Code [S3]; interaction จริง Pending | ใช้ `h2 onClick`; modal ไม่มี dialog semantics, Escape/focus trap/return focus; ปุ่ม X ไม่มี accessible name | ผู้ใช้คีย์บอร์ด/โปรแกรมอ่านจอเปิดและปิดรายละเอียดลำบาก | **P1 / I5** |
| **F11** | ปุ่มสมัครอาจแสดงทั้งที่ประกาศปิดหรือหมดอายุ [UX review] | Verified Code [S3] | เงื่อนไขแสดง CTA เช็ก application_url อย่างเดียว | badge กับการกระทำชวนให้เข้าใจขัดกัน | **P1 / I5**; เปลี่ยนเป็นดูประกาศเดิมสำหรับ closed/expired |
| **F12** | หน้าเดิม/ตัวกรองไม่อยู่หลัง refresh และส่งลิงก์ผลค้นหาไม่ได้ [UX review] | Verified โครงสร้าง state ภายใน App/Positions [S3,S10]; ไม่ได้ทดสอบ browser history จริง | ไม่มี URL state สำหรับ activeTab/filter | กลับมาทำงานต่อหรือส่งให้เพื่อนยาก | **P2 / Deferred** |
| **F13** | Connection exhaustion ช่วง Rush Hour และความจำเป็นของ Proxy [Issue #81,L1] | Pending ผลวัด; Verified ว่า repo มี Proxy แล้ว [S8,S9] | Lambda หลาย execution environments มี pool แยกกัน; ไม่มี load evidence ของระบบนี้ | อาจกระทบ availability แต่ยังห้ามเรียกว่า incident ที่เกิดแล้ว | **P1 / I6** ประเมิน ไม่เพิ่ม Proxy ซ้ำ |
| **F14** | TLS configuration/comment ไม่สอดคล้องกัน [Architecture review] | Verified Code [S8,S9]; live config Pending | db.mjs ใช้ SSL แต่ `rejectUnauthorized=false`; proxy.tf `require_tls=false` และ comment บอก client ไม่ใช้ TLS | ตรวจสอบ server certificate ไม่ครบและทีมอาจตั้งค่าตาม comment ผิด | **P1 / I6** ตรวจ CA/TLS และทำเอกสารให้ตรง; ทดสอบก่อนเปลี่ยน |
| **F15** | หนึ่งนักศึกษาควรมีไม่เกินหนึ่งแผน แต่ DB ไม่บังคับ [Architecture review] | Verified [S1,S6] | coop_plans.student_id มี index แต่ไม่มี UNIQUE | ข้อมูลอาจขัดกับ cardinality ที่ทีมตกลง แม้ V2 ยังไม่มี submit flow | **P2 / Deferred**; ตรวจข้อมูลซ้ำก่อน migration |
| **F16** | ไม่พบปัญหา/ค้นกรองได้ตามเงื่อนไข [T2,T3] | Verified เฉพาะสิ่งที่แบบประเมินบันทึก; การทำซ้ำ Pending | ไม่มี dataset, URL, timestamp/commit ของรอบทดสอบ | เป็นผลบวกที่ควรรักษา ไม่ได้หักล้าง F03 หรือยืนยันทุก edge case | **Preserve** / ใส่ regression cases ใน I1–I5 |

> **หมายเหตุระดับความสำคัญ:**
> - **P1** = กระทบความถูกต้อง/งานหลักหรือการเข้าถึง
> - **P2** = ปรับประสบการณ์หรือความสอดคล้องเพิ่มเติม
> - ทั้งนี้ยังไม่มีหลักฐาน production incident ที่จัดเป็น **P0**

---

## 5. ข้อเสนอ UX ที่นำไปทำได้

### 5.1 ทำทางเดินหลักให้ต่อเนื่อง
- หน้า **“สถานประกอบการ”** ควรมีปุ่ม **“ดูตำแหน่งของบริษัทนี้”** เป็นทางหลัก และแยก **“เว็บไซต์บริษัท ↗”** เป็นทางรอง
- ส่ง `company_id` ไปหน้า Positions พร้อมแสดงชื่อบริษัทและตัวกรองที่เลือก ไม่ใช้การคลิกทั้งการ์ดเป็นทางออกจากระบบเพียงทางเดียว
- เมื่อเลือกรอบแล้วไม่พบตำแหน่ง ให้คงหัวข้อบริษัทไว้ และแสดง *“ไม่พบประกาศที่ระบุรอบนี้ในข้อมูลที่ตรวจสอบแล้ว”* พร้อมปุ่มเปลี่ยนรอบ
- แยกรายการ *“ยังไม่ระบุรอบ”* ออกจากผลที่ตรงเงื่อนไข **ห้ามใช้ unknown แทนคำว่าไม่มีเปิดรับ**

### 5.2 ใช้โครงสร้างรายละเอียดเดียวกัน
- **เรียงลำดับหัวข้อ:** ตำแหน่ง → บริษัท → สถานที่ → รูปแบบงาน → คุณสมบัติ → รายละเอียด → รอบสหกิจ → สถานะ/วันปิดรับ → แหล่งประกาศ/ตรวจสอบล่าสุด
- หัวข้อที่ไม่มีข้อมูลให้แสดง *“ประกาศไม่ได้ระบุ”* หรือ *“ยังไม่ตรวจสอบ”* ตามหลักฐาน ไม่ปล่อยหายไปและไม่เติมข้อมูลจากการคาดเดา

### 5.3 ทำให้สถานะและปุ่มสื่อความหมายตรงกัน

| สถานะ | ข้อความและการกระทำที่เสนอ |
| :--- | :--- |
| **open ที่ตรวจสอบแล้ว** | “เปิดรับสมัคร” และปุ่มไปช่องทางสมัครเมื่อมี URL |
| **closed / expired** | “ปิดรับแล้ว/หมดเขต” และ “ดูประกาศเดิม” |
| **unknown** | “ยังไม่ยืนยันสถานะ” และ “ตรวจสอบประกาศทางการ” |
| **ไม่มี URL** | ข้อความว่าไม่มีลิงก์ พร้อมรายละเอียดที่อ่านในระบบได้; ไม่ทำเป็นลิงก์กดได้ |
| **API / network error** | แสดงว่าโหลดข้อมูลล่าสุดไม่ได้และปุ่มลองใหม่; ถ้าคง offline mode ต้องติดป้ายข้อมูลสำรองและเวลา snapshot ชัดเจน |

> **ข้อเสนอรอบนี้:** เลือก **ปิด silent fallback ใน production** เพื่อให้เส้นทาง V2 แสดงข้อผิดพลาดตามจริง ส่วน offline mode เต็มรูปแบบเลื่อนไปภายหลัง

### 5.4 สิ่งที่ทำดีแล้วและควรรักษา
- **S3 มี:** loading skeleton, error พร้อม retry, empty state ที่อธิบายคำค้น, จำนวนผลลัพธ์, ตัวกรองที่เลือกและปุ่มล้าง รวมถึงลิงก์ประกาศต้นทาง
- **S2 มี:** `aria-label` ของ search/filter และป้องกันผล request เก่าด้วย `cancelled` flag
- ควรนำรูปแบบนี้ไปใช้สม่ำเสมอ ไม่เริ่มออกแบบใหม่ทั้งหมด
- *ยังต้องตรวจจริงที่ความกว้าง 360/390 px และ desktop, zoom 200%, Tab/Enter/Escape, ข้อความยาว และ empty/error states ก่อนรับงาน ไม่สรุปว่า responsive ผ่านจากการมี Tailwind breakpoints อย่างเดียว*

---

## 6. Architectural Insights: RDS เทียบกับ DynamoDB

### 6.1 Data Modeling

| ประเด็น | RDS PostgreSQL ที่มีใน repo | DynamoDB ทางเลือกเชิงออกแบบ |
| :--- | :--- | :--- |
| **รูปแบบข้อมูล** | แยก companies/positions/periods/coop_plans และใช้ FK; ชื่อบริษัท join ตอนอ่าน | ออกแบบตาม access pattern และใช้ Item Collection คือกลุ่ม item ที่มี partition key เดียวกัน [A1] |
| **อ่านบริษัทและตำแหน่ง** | SELECT / LEFT JOIN; ใช้ `company_id` | ตัวอย่าง `PK=COMPANY#C001`, `SK=META` และ `POSITION#P001`; Query ภายใต้บริษัทเดียว |
| **อ่านแผน** | เชื่อม student, position, period ผ่าน ID | ตัวอย่าง `PK=STUDENT#S001`, `SK=PLAN#CURRENT`; การค้นแผนตามรอบต้องมี index/รายการอ้างอิงเพิ่ม |
| **ข้อมูลซ้ำ** | แก้ชื่อบริษัทหลักแล้ว JOIN ได้ค่าปัจจุบัน | ถ้าคัดลอกชื่อบริษัทลงรายการที่ query บ่อย ต้องกำหนดวิธี sync ไม่ให้สำเนาค้าง |
| **ความสัมพันธ์ / ข้อบังคับ** | FK/CHECK/UNIQUE ตามที่ประกาศจริง; S6 ยังขาด UNIQUE student_id ในแผน | ไม่มี relational FK แบบ SQL; application ต้องดูแลความสัมพันธ์ และใช้ conditional writes/transaction เมื่อเหมาะสม |
| **ค้นหลายเงื่อนไข / ข้อความ** | SQL ปรับเงื่อนไขได้; schema มี B-tree และ trigram indexes แล้ว | ต้องรู้ key/access pattern ก่อน; GSI ไม่ได้ทดแทน substring search อิสระ |

> **ข้อสรุปสำหรับโปรเจกต์นี้:** ใช้ RDS ต่อเพราะมีความสัมพันธ์หลาย entity และการค้นหลายเงื่อนไขอยู่แล้ว ปัญหา F01–F11 ส่วนใหญ่แก้ได้ด้วยข้อมูล, API และ UI การเปลี่ยนฐานข้อมูลไม่ทำให้ประกาศครบหรือ UX ดีขึ้นเอง ข้อนี้เป็นข้อเสนอจากโครงสร้างโค้ด ไม่ใช่ผลพิสูจน์ว่า RDS เร็วหรือถูกกว่า DynamoDB

### 6.2 Concurrency และ Connection Exhaustion

- **S8 สร้าง `pg.Pool` ที่ module scope และตั้ง `max=5`** ซึ่ง reuse ได้ภายใน warm execution environment แต่ไม่ได้เป็น pool เดียวร่วมกันทั้ง Lambda หากมี N environments เพดาน client connections เชิงตัวอย่างคือประมาณ $N \times 5$ เมื่อแต่ละ pool ถูกใช้งานเต็ม ไม่ใช่จำนวนที่เปิดทันทีทุกครั้ง
- **RDS Proxy รวมและนำ backend connections กลับมาใช้ได้** แต่ไม่ได้ทำให้ DB รับงานไม่จำกัด; transaction/session pinning อาจลดการแชร์ connection [A2,A3] ต้องดูทั้ง client connections, backend connections และเวลารอ ไม่ใช่ดูจำนวนผู้ใช้ต่อวันอย่างเดียว
- **สิ่งที่ยืนยันจาก S9:**
  - Lambda `DB_HOST` ชี้ Proxy endpoint อยู่แล้ว
  - Lambda timeout 10 วินาที; pg connection timeout 5 วินาที
  - Proxy `connection_borrow_timeout` 120 วินาที, `max_connections_percent` 100
  - `require_tls=false` ขณะที่ client เปิด SSL แบบไม่ตรวจ certificate
  - ค่ารอ 120 วินาทีไม่ใช่เวลารอที่ผู้ใช้ได้รับจริง เพราะ client/Lambda อาจหมดเวลาก่อน ต้องทบทวน timeout budget และพื้นที่ connection สำหรับงานดูแลระบบตามขนาด DB จริง ไม่เปลี่ยนค่าโดยใช้ตัวเลขเดา
- **คำตัดสินชั่วคราว:** คง Proxy ที่มีอยู่ ตรวจการตั้งค่าและเก็บหลักฐานก่อน ไม่เพิ่ม Proxy ใหม่ ไม่ถอดออกเพียงเพราะผู้ใช้น้อย และยังไม่กล่าวว่าเคยเกิด connection exhaustion
- **แผนวัดในสภาพแวดล้อมทดสอบ:**
  - Workload อ่านบริษัท/ตำแหน่ง/รอบที่เหมือนกัน, ข้อมูลเท่ากัน, Region/instance เดียวกัน, concurrency 1 → 10 → 25 → 50; ทดลอง 150 เฉพาะเมื่อสอดคล้องกับสมมติฐานและทรัพยากรที่ทีมยืนยัน
  - บันทึก cold/warm แยกกัน ทำซ้ำระดับละ 3 รอบ พร้อม duration, p50/p95, throughput, errors, Lambda concurrency/throttles, DB connections/CPU และ Proxy borrow latency/pinning
  - ถ้าจะเปรียบเทียบ direct RDS กับ Proxy ให้ทำใน test setup ที่แยกชัดเจน ไม่สลับ production เพื่อทดลอง
- **ตัวชี้วัดสำเร็จ:** ต้องตกลงก่อนวัด; เสนอ provisional target สำหรับ warm read คือ $p95 \le 2$ วินาที และ $5xx < 1\%$ ที่โหลดเป้าหมายที่ทีมรับรอง พร้อมไม่มี connection exhaustion ตัวเลขนี้เป็นเกณฑ์เสนอ ไม่ใช่ requirement เดิมหรือผลที่วัดได้ หากหมด timebox ให้รายงานสิ่งที่วัดได้และ Pending แทนการสรุปผลสำเร็จ

### 6.3 Query Efficiency และ GSI

- RDS ปัจจุบันมี indexes บน `company_id`/`category`/`work_mode`/`status` และ trigram ของ `title`/ชื่อบริษัท [S6] จึงไม่ควรเขียนว่า “ไม่มี index” หรือ “เกิด Full Table Scan แล้ว” โดยยังไม่ได้ดู execution plan ใช้ `EXPLAIN (ANALYZE, BUFFERS)` ในชุดทดสอบเพื่อดู query ที่เป็นตัวแทน; sequential scan อาจเหมาะกับตารางเล็กและไม่ใช่ bug โดยตัวมันเอง
- **ตัวอย่าง DynamoDB หลังตกลงความหมายรอบรับสมัครแล้ว:**

| Access pattern | แบบ key ที่เสนอ | วิธีอ่าน |
| :--- | :--- | :--- |
| **บริษัทและตำแหน่งทั้งหมดของบริษัท** | `PK=COMPANY#<id>`, `SK=META` หรือ `POSITION#<id>` | Query ด้วย PK; เลือก prefix เมื่ออ่านเฉพาะตำแหน่ง |
| **ตำแหน่งของบริษัทในรอบที่ระบุ** | availability item: `PK=COMPANY#<id>`, `SK=PERIOD#<periodId>#POSITION#<positionId>` | Query PK + `begins_with` SK ของรอบ |
| **ตำแหน่งเปิดรับในรอบใดรอบหนึ่งจากทุกบริษัท** | `GSI1PK=PERIOD#<periodId>#STATUS#open`, `GSI1SK=COMPANY#<companyId>#POSITION#<positionId>` | Query GSI1 ด้วย partition key ที่แน่นอน |

- รายการ availability เป็นข้อเสนอใหม่ ไม่ใช่ schema ที่มีแล้ว ต้องมีวิธีอัปเดตสถานะและข้อมูลซ้ำให้ตรงกัน และหาก workload ใหญ่ขึ้นต้องประเมิน hot partition ของ key ที่รวมทั้งรอบ
- **GSI ต้องตรงกับ access pattern และมีต้นทุนเขียน/พื้นที่เพิ่ม;** ผลอ่าน GSI เป็น eventually consistent [A4,A5] การมี GSI แต่ยังเรียก Scan ไม่ได้ทำให้กลายเป็น Query และ `FilterExpression` กรองหลังอ่าน จึงไม่ได้ลด read capacity ของข้อมูลที่อ่านไปแล้ว [A6] query/scan ที่มีหลายหน้าต้องจัดการ pagination ด้วย
- แบบ key ข้างต้น **ยังไม่รองรับทุกตัวกรองและการค้นข้อความบางส่วน** เช่น ค้นสถานที่โดยไม่เลือกรอบ ห้ามอ้างว่า GSI ตัวเดียวแก้ทุกการค้นหา; ต้องเพิ่ม access pattern ที่จำเป็นจริงหรือเลือกวิธีค้นหาที่เหมาะสม

---

## 7. Improvement Scope และรายการงานที่ตัดออก

| การตัดสินใจ | รายการ | เหตุผล |
| :--- | :--- | :--- |
| **In Scope** | I0–I6 ในหัวข้อถัดไป | แก้ core flow, ความถูกต้อง, accessibility และเก็บหลักฐานสถาปัตยกรรมภายในงบ |
| **Deferred** | URL/deep-link/filter persistence [F12] | มีประโยชน์แต่ไม่ควรแย่งเวลาการแก้ข้อมูล/รอบรับสมัคร |
| **Deferred** | UNIQUE ของ Coop Plan [F15] | ต้อง audit ข้อมูลซ้ำและตกลง migration; ยังไม่มี write workflow ในรอบนี้ |
| **Deferred** | ย้าย DynamoDB, ทำ GSI จริง, benchmark สอง DB เต็มชุด | ยังไม่มีหลักฐานว่าจำเป็น และเสี่ยงเกิน 60 ชั่วโมง; เก็บ comparison/design ใน I6 |
| **Deferred** | Auth, role, submit/approve, Project Report | อยู่นอก boundary ของ V2 ตาม S1 |
| **Deferred** | ระบบอัปเดตประกาศอัตโนมัติ/offline mode เต็มรูปแบบ | ต้องมีแหล่งข้อมูลและ maintenance process; รอบนี้เน้นเวลาเช็กและแหล่งอ้างอิง |
| **Won't Fix** | ทำให้ทุกตำแหน่งเป็น open หรือเติมคุณสมบัติ/รอบเองเพื่อผ่าน TC | ทำให้ข้อมูลผิด; ใช้ unknown/ไม่ระบุ และ test fixtures ที่แยกจากข้อมูลจริง |
| **Won't Fix** | ซ่อนบริษัทที่ไม่มีตำแหน่งในรอบที่เลือก | ขัด TC3 ที่ต้องยังบอกได้ว่าบริษัทมีอยู่ |
| **Won't Fix** | เปลี่ยน RDS เป็น DynamoDB เพียงเพราะคำค้นสั้น | ความยาว input ไม่เพียงพอ ต้องพิจารณา access pattern/relationships/ผลวัด |
| **Won't Fix** | นับ 502 จากเบราว์เซอร์นี้เป็น production outage ที่ยืนยันแล้ว | ยังแยก HTTP/HTTPS และข้อจำกัดสภาพแวดล้อมไม่ได้ |

---

## 8. ร่าง Implementation Issues

> **หมายเหตุ:** รหัส I0–I6 เป็นรหัสในเอกสาร ไม่ใช่ GitHub issue ที่สร้างแล้ว ทุกงานต้องมี reviewer คนละคนกับผู้แก้ และแนบหลักฐานใน PR

### I0 — ยืนยันแหล่ง Feedback และล็อกขอบเขตรอบแก้ไข (6 ชม.)
- **Goal:** ให้ทีมใช้ข้อสรุปและความหมายข้อมูลเดียวกัน
- **Tasks:** ยืนยัน T1–T3 ว่าทดสอบเวอร์ชัน/ทีมใด, ตรวจความซ้ำ T2/T3, ตกลง position availability, เลือกผู้รับผิดชอบ/Reviewer และรับรองแผนนี้
- **Expected Output:** feedback register ที่ยืนยันแหล่งได้, decision เรื่องรอบรับสมัคร, รายชื่อคนแทน A–E
- **Acceptance:** ไม่มีการนับผู้ทดสอบซ้ำ; แยก Verified/Pending; ระบุสิ่งที่ยังตอบไม่ได้; รวม review เอกสารนี้ในเวลา

### I1 — ทำรายละเอียดและความสดของข้อมูลให้ชัดเจน (8 ชม.; F01, F02, F05, F16)
- **Goal:** เทียบตำแหน่งได้โดยไม่เข้าใจข้อมูลที่ขาดว่าไม่มีเงื่อนไข
- **Tasks:** ใช้หัวข้อคงที่/ข้อความกรณีไม่ระบุ, กำหนด `source_url` และ `last_verified_at` หรือ snapshot metadata ที่ตรวจสอบได้, แทนวันที่ hard-code; ตรวจประกาศตัวอย่างและสร้าง fixture แยก open/closed/expired/unknown
- **Expected Output:** UI รายละเอียดสม่ำเสมอ, data-quality summary, หลักฐานแหล่งข้อมูล/วันที่ตรวจ
- **Acceptance:** ช่องว่างไม่มีข้อมูลแต่งเติม; open ต้องมีหลักฐาน; วันที่ตรวจไม่ใช้ `created_at` แทน; จำกัด data cleanup รอบนี้ไม่เกิน 10 ประกาศ โดยรายการที่เหลือแสดงความไม่แน่นอนตามจริง ไม่รับปากตรวจใหม่ครบ 64 รายการ

### I2 — รองรับบริษัท–ตำแหน่ง–รอบเวลาและ TC3 (12 ชม.; F03)
- **Goal:** เลือกรอบแล้วแยกตำแหน่งตรงรอบออกจากไม่ระบุรอบได้
- **Tasks:** หลัง I0 รับรอง ให้เพิ่มตารางเชื่อม `position_periods(position_id, period_id)` พร้อม composite PK/FK/index ที่เหมาะสม, migration/rollback, เพิ่ม `period_id` filter ใน API/UI; คงบริษัทไว้เมื่อไม่พบตำแหน่ง
- **Expected Output:** schema/API/UI ที่เชื่อมรอบได้ และชุดข้อมูลทดสอบที่ระบุชัดว่าเป็น fixture
- **Acceptance:** บริษัทมีตำแหน่งในรอบ A แต่ไม่มีใน B → เลือก B แล้วยังเห็นบริษัท ไม่เห็น A เป็นผลตรงเงื่อนไข; unknown แยกต่างหาก; มีการแสดงรอบในรายละเอียด; ไม่ใช้ Coop Plan อนุมาน availability
- **Dependency/ขอบเขต:** ใช้ข้อมูลจริงเท่าที่ระบุรอบได้ ไม่ต้องสร้างหน้า admin; หากหลักฐานรอบไม่พอให้แสดงไม่ทราบ ห้ามรายงานว่าปิดรับ ถ้า model decision ไม่จบใน I0 ให้หยุดส่วน migration และรายงาน TC3 Pending เพื่อปรับ scope ภายในงบ

### I3 — เชื่อมหน้าบริษัทกับตำแหน่งและจัดการลิงก์ (7 ชม.; F04, F06)
- **Goal:** เลือกบริษัทแล้วไปตำแหน่งที่เกี่ยวข้องได้โดยไม่ค้นซ้ำ
- **Tasks:** เพิ่ม CTA ภายในที่ส่ง `company_id`, แยก external link, ตรวจ null/blank/รูปแบบ URL, ขอชื่อบริษัทที่ผู้ทดสอบพบและตรวจลิงก์ตัวอย่าง
- **Expected Output:** flow บริษัท → ตำแหน่ง พร้อมบริบทบริษัท และพฤติกรรมเมื่อไม่มีลิงก์
- **Acceptance:** บริษัท A ไม่แสดงตำแหน่งของ B; ไม่มี URL ไม่เป็นลิงก์หลอก; ลิงก์ภายนอกบอกว่าเปิดเว็บอื่น; HTTP status อย่างเดียวไม่ถือว่าต้นทางเสียถ้าติด automation/permission

### I4 — ทำ Search และ Error State ให้เชื่อถือได้ (8 ชม.; F07–F09)
- **Goal:** ผลลัพธ์ตรงกับคำค้นล่าสุดและสัญญาที่ UI ให้ไว้
- **Tasks:** เพิ่ม location ใน SQL search ตาม placeholder โดย parameterized query, ล็อก contract ฟิลด์ค้นหา, ปิด silent fallback ใน production, เพิ่ม abort/request sequence guard
- **Expected Output:** API/UI contract และ regression tests ของ keyword, error และ response กลับสลับลำดับ
- **Acceptance:** ค้นสถานที่ตัวอย่างได้ตาม contract; response ของคำค้นเก่าไม่ทับคำใหม่; network error กับผลว่างแสดงต่างกัน; retry ใช้ตัวกรองปัจจุบัน; ไม่เพิ่ม index ทุกคอลัมน์โดยไม่มี execution-plan evidence

### I5 — ปรับรายละเอียดตำแหน่งและ CTA ให้เข้าถึงได้ (7 ชม.; F10, F11)
- **Goal:** ทุกตำแหน่งอ่านรายละเอียดได้ด้วยเมาส์/คีย์บอร์ด และปุ่มไม่ขัดกับสถานะ
- **Tasks:** ใช้ button/link ที่มีชื่อชัดเจนแทน `h2 onClick`, แสดงดูรายละเอียดเสมอ, dialog semantics/accessible name, Escape/focus trap/return focus; เปลี่ยน CTA ตามสถานะ
- **Expected Output:** modal ที่ใช้งานได้ครบและผลตรวจ keyboard/mobile
- **Acceptance:** Tab → Enter เปิด, Escape ปิด, focus กลับปุ่มเดิม; ปุ่ม X มีชื่อ; closed/expired ไม่ใช้คำชวนสมัคร; เปิดดูประกาศเดิมได้; ตรวจ 360/390 px และ zoom 200% ไม่บังปุ่มสำคัญ

### I6 — ตรวจ Connection/TLS และสรุป Architecture Decision (7 ชม.; F13, F14)
- **Goal:** แยกสิ่งที่คาดการณ์ออกจากสิ่งที่วัดได้ และทำ configuration ให้เข้าใจตรงกัน
- **Tasks:** ตรวจ deployed config/สิทธิ์ Lab เมื่อทีมให้เข้าถึง, เก็บ baseline และทดสอบ concurrency แบบจำกัดเวลา, ตรวจ timeout budget/connection headroom, ตรวจ CA และ TLS ใน test environment ก่อนแก้, สรุป RDS/Proxy/GSI decision
- **Expected Output:** config checklist, ตารางผลวัดเท่าที่ทำได้, ข้อจำกัด, decision record และแนวทาง rollback เมื่อเปลี่ยน config
- **Acceptance:** ไม่ใช้ตัวเลขจาก lab แทน benchmark ระบบนี้; ระบุ workload/สภาพแวดล้อม/การทำซ้ำ; หลักฐานรองรับการคงหรือเปลี่ยนค่า; หากเข้า AWS ไม่ได้ให้ระบุ Pending ไม่สร้างผลวัด; ไม่รวมการย้าย DB หรือ benchmark สอง backend เต็มรูปแบบ

---

## 9. Capacity & Work Breakdown

> **หมายเหตุ:** หน่วยทั้งหมดเป็น **person-hours** ไม่ใช่ระยะเวลาปฏิทิน ผู้รับผิดชอบ A–E เป็นช่องให้ทีมใส่ชื่อจริง ไม่ได้อ้างว่ามอบหมายงานแล้ว

### ตารางแจกแจงงานตามกิจกรรม (Activity Breakdown)

| งาน | วิเคราะห์ | พัฒนา/จัดทำ | ทดสอบ/ตรวจหลักฐาน | รีวิว | รวม |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **I0** แหล่งข้อมูล/ขอบเขต/เอกสาร #81 | 3 | 1 | 1 | 1 | **6** |
| **I1** รายละเอียดและข้อมูล | 1 | 4 | 2 | 1 | **8** |
| **I2** รอบรับสมัคร/TC3 | 2 | 6 | 3 | 1 | **12** |
| **I3** บริษัท/ลิงก์ | 1 | 3 | 2 | 1 | **7** |
| **I4** Search/error/race | 1 | 4 | 2 | 1 | **8** |
| **I5** Modal/CTA | 1 | 3 | 2 | 1 | **7** |
| **I6** Architecture/config/evidence | 2 | 2 | 2 | 1 | **7** |
| **รวมแผนหลัก** | **11** | **23** | **14** | **7** | **55** |

### ตารางจัดสรรภาระงานรายบุคคล (Member Allocation)

| สมาชิก | งานและชั่วโมงที่รับผิดชอบ รวม review ที่ระบุ | แผนหลัก | สำรอง | สูงสุด |
| :---: | :--- | :---: | :---: | :---: |
| **A** | I0 5 ชม. + I6 5 ชม. + review I5 1 ชม. | 11 | 1 | **12** |
| **B** | I1 7 ชม. + I4 3 ชม. (รวม review I4) + review I0 1 ชม. | 11 | 1 | **12** |
| **C** | I2 10 ชม. + review I3 1 ชม. | 11 | 1 | **12** |
| **D** | I3 6 ชม. + I5 4 ชม. + review I1 1 ชม. | 11 | 1 | **12** |
| **E** | I2 2 ชม. (รวม review I2) + I4 5 ชม. + I5 2 ชม. + I6 2 ชม. (รวม review I6) | 11 | 1 | **12** |
| **รวม** | | **55** | **5** | **60** |

- **ผู้ทำหลัก / Reviewer:** I0 A/B, I1 B/D, I2 C/E, I3 D/C, I4 E/B, I5 D/A, I6 A/E 
  - ส่วนชั่วโมงที่แบ่งกันเป็นการทำ integration/testing ตามขอบเขตเดียวกัน ไม่ได้นับซ้ำกับตารางกิจกรรม
- **ลำดับการทำงาน (Execution Order):** I0 → I1/I2 ตาม data contract; I3 เชื่อม `company_id` กับ I2; I4 ทำ contract ค้นหา; I5 ปิดงาน UX; I6 เริ่มตรวจเอกสาร/config ได้พร้อมงานอื่น ทุกงานมี test/review ของตนรวมไว้แล้ว
- **นโยบายเมื่อเวลาเกิน (Overrun Policy):** หาก estimate เริ่มเกิน ให้ใช้สำรองไม่เกินคนละ 1 ชั่วโมงและรวมไม่เกิน 5 ชั่วโมง ห้ามย้ายงานเพิ่มให้คนที่ครบ 12 ชั่วโมง ให้ลดจำนวนประกาศที่ตรวจหรือเลื่อนข้อปรับแต่งก่อน หาก core TC3 ยังไม่เสร็จต้องระบุว่าไม่ผ่านและปรับ scope กับ Reviewer ไม่ปิด issue ด้วยผลที่ไม่ครบ

---

## 10. Verification Plan และหลักฐานก่อนปิด Issue

| กรณี | สิ่งที่ต้องตรวจ | หลักฐาน |
| :--- | :--- | :--- |
| **TC1** | บริษัท/ตำแหน่ง/รอบเชื่อมกันและชื่อไม่ปน | API response + screenshot + fixture/record ID |
| **TC2** | คำค้น/บริษัท/หมวด/รูปแบบงาน/สถานะ/รอบ ให้ผลตรงเงื่อนไข | ชุด input/expected/actual รวม reset และผลว่าง |
| **TC3** | บริษัทมีอยู่แต่ไม่มีรายการตรงรอบ; unknown แยกจากไม่มี | บริษัทเดียวรอบ A/B และตัวอย่างไม่ระบุรอบ |
| **ข้อมูลไม่ครบ** | หัวข้อยังอ่านได้และไม่แต่งเติม | ตัวอย่าง null/unknown |
| **ลิงก์บริษัท** | valid/blank/invalid และตัวที่ T2 รายงาน | URL ที่ตรวจและผลจริง ไม่เหมารวม 403/timeout |
| **Error / race** | API 500, network failure, response เก่ากลับทีหลัง | test output และภาพ error/retry |
| **Accessibility** | ปุ่มรายละเอียด, Tab/Enter/Escape, focus กลับ, small viewport | checklist พร้อม browser/viewport |
| **Architecture** | connection/TLS/timeout และผลวัดตามทรัพยากรที่มี | config ที่ตัดข้อมูลลับออก, metrics, workload, ข้อจำกัด |

### สถานะ ณ วันที่จัดทำ:
- [x] อ่าน issue #81 และรวบรวมข้อสังเกตจากแบบประเมินทั้ง 3 ไฟล์
- [x] ตรวจ Source Code ตาม snapshot และแยก Verified/Pending
- [x] จัดลำดับ/ขอบเขต/ร่างงาน/งบชั่วโมงและข้อสรุปเชิงสถาปัตยกรรม
- [ ] ทีมยืนยันว่า T1–T3 เป็นผลของเว็บ/เวอร์ชันใด และตกลงความหมาย availability
- [ ] ทดสอบ live deployment และเก็บหลักฐานที่ยัง Pending
- [ ] Reviewer ตรวจและเห็นชอบเอกสารนี้
- [ ] นำไฟล์เข้าที่ `docs/reviews/v2-feedback-analysis.md` และ Merge
- [ ] สร้าง Implementation Issues ที่รับรองแล้วใต้ Milestone V2 Feedback

> *รายการท้ายนี้ยังไม่เสร็จ เพราะเอกสารเป็นร่างให้ผู้ใช้ตรวจสอบก่อน ไม่ควรทำเครื่องหมายว่า Acceptance Criteria ของ #81 ผ่านครบหรือปิด issue ในตอนนี้*

---

## 11. เอกสาร AWS อ้างอิง

*(ตรวจประกอบการวิเคราะห์วันที่ 7 ตุลาคม 2569; เป็นหลักการบริการ ไม่ใช่หลักฐานการ deploy/ผลวัดของทีม)*

- [A1: Data modeling building blocks / Item Collection](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-blocks.html)
- [A2: RDS Proxy connection considerations](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-connections.html)
- [A3: Avoiding pinning an RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-pinning.html)
- [A4: Using Global Secondary Indexes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html)
- [A5: DynamoDB read consistency](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html)
- [A6: Filter expressions for Query](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.FilterExpression.html)
