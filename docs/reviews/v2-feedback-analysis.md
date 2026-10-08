# สรุปผลวิเคราะห์ Feedback V2 และแนวทางแบ่งงานปรับปรุง

- **วันที่ตรวจ:** 8 ตุลาคม 2569 (Asia/Bangkok)
- **อ้างอิงงาน:** [Issue #81](https://github.com/KaylahJin/CS361-Project/issues/81)
- **สถานะ:** พร้อมตรวจทาน (Ready for Review) — วิเคราะห์และทบทวนครบถ้วนตามเกณฑ์ Issue #81 รอทีมตรวจสอบและอนุมัติก่อน Merge เพื่อนำไปสร้าง Implementation Issues (W1–W6)

---

## 1. วิเคราะห์แล้วได้ข้อสรุปอะไร

ผลประเมินจาก Tester Sheet (ทั้งจาก นวพรรษ และ พัทธนันท์) ชี้ว่าผู้ทดสอบค้นหาและกรองข้อมูลเบื้องต้นได้ แต่ติดปัญหาสำคัญ 4 ด้าน ซึ่งเมื่อวิเคราะห์เชิงลึกพบว่า **สาเหตุหลักไม่ใช่ Logic หรือ Database ผิดพลาด แต่เป็นปัญหาด้าน UX & Information Architecture (การสื่อสารของ UI และ Affordance ที่ทำให้ผู้ใช้เข้าใจผิด)**:

| กลุ่มปัญหา | วิเคราะห์สาเหตุที่แท้จริง (Root Cause) | แนวทางแก้ไข |
| :--- | :--- | :--- |
| **1. รูปแบบรายละเอียดไม่สม่ำเสมอ (Inconsistent Layout)** | ข้อมูลต้นทางบางบริษัทไม่มีสถานที่/คุณสมบัติ แต่ UI ใช้เงื่อนไขซ่อนหัวข้อ (`{location && ...}`) ทำให้ผู้ใช้เข้าใจว่าระบบแสดงผลตกหล่น [F01] | ปรับเป็น **Fixed Schema Layout** เสมอ หากไม่มีข้อมูลให้ระบุชัดเจน เช่น *"ไม่ได้ระบุในประกาศ"* แทนการซ่อนหัวข้อ |
| **2. ขาดบริบทความสดใหม่ของข้อมูล (Missing Freshness Context)** | ข้อมูลเป็นประกาศย้อนหลังปี 2567–2568 สถานะจึงเป็น expired/unknown แต่ UI ไม่มีป้ายบอกรอบปี และยังแสดงปุ่ม "สมัครงาน" [F02, F05] | แสดง Context ชัดเจน (เช่น *"ข้อมูลประกาศปีการศึกษา 2568"*) พร้อมวันตรวจสอบล่าสุด และเปลี่ยน CTA เป็น *"ดูประกาศย้อนหลัง"* สำหรับประกาศที่ปิดแล้ว |
| **3. Dead Click และทางเดินบริษัทขาดความต่อเนื่อง** | การ์ดบริษัทครอบด้วยลิงก์ภายนอก พอไม่มี URL จึงคลิกไม่ไป (Dead Click) และไม่มีปุ่มดูตำแหน่งงานของบริษัทนั้นในระบบ [F04, F06] | แยกปุ่ม **"ดูตำแหน่งของบริษัทนี้"** (ในระบบ) เป็น Action หลัก และแยก **"เว็บไซต์บริษัท ↗"** เป็น Action รอง (ปิดลิงก์หากไม่มี URL) |
| **4. ค้นตามรอบสหกิจยังไม่ได้ และ Empty State ไม่บอกเหตุผล** | ข้อมูลตำแหน่งยังไม่มีความสัมพันธ์กับรอบสหกิจ (`position_periods`) และเมื่อผลลัพธ์ว่าง UI ไม่ได้แจ้งว่าบริษัทมีอยู่แต่ไม่เปิดรับรอบนี้ [F03] | เพิ่มความสัมพันธ์รอบสหกิจ กำหนดขอบเขตข้อมูลชัดเจน และแสดง Empty State ที่คงชื่อบริษัทไว้พร้อมแจ้งสถานะรอบ |
| **5. ค้นหาสถานที่ไม่ตรงกัน และ Error Handling ไม่โปร่งใส** | ช่องค้นหาหน้าบ้านบอกว่าค้นสถานที่ได้ แต่ SQL ไม่ได้ค้นสถานที่ และยังมี Silent fallback เมื่อ network มีปัญหา [F07–F09] | แก้ SQL ให้ค้น location ให้ตรงกัน ปิด silent fallback ใน production เพื่อแสดงข้อผิดพลาดตามจริง และกัน race condition |
| **6. สถาปัตยกรรมและ Configuration** | มี RDS Proxy อยู่แล้วเพื่อรองรับ connection pool แต่ configuration TLS/Timeout ยังมีจุดไม่สอดคล้องกับ client [F13, F14] | คง RDS/Proxy ไว้ตามเดิม ปรับ TLS/Timeout ให้ถูกต้อง และวัดประสิทธิภาพตามกรอบ timebox |

> **ทิศทางรอบนี้:** ปรับปรุงความถูกต้องของข้อมูลและ UX Information Architecture ในทางเดิน บริษัท → ตำแหน่ง → รอบ ก่อนเพิ่มฟีเจอร์ใหม่ โดยแบ่งงานติดตามเป็น 6 ชิ้น (W1–W6) ประมาณการรวม 55 person-hours (สำรอง 5 ชั่วโมง) รวม 60 ชั่วโมง เฉลี่ยไม่เกินคนละ 12 ชั่วโมง

---

## 2. แหล่งข้อมูลและขอบเขตการตรวจ

### 2.1 แบบประเมินที่ได้รับ

| รหัส | ไฟล์ | ผลที่ผู้ทดสอบบันทึก | หมายเหตุ |
| :--- | :--- | :--- | :--- |
| **T1** | `CS361 V2 — PEER TESTER SHEET - nawapat thumthaisong(1).pdf` หน้า 1–2 | TC1 PARTIAL, TC2 PASS, TC3 PARTIAL; ไม่ต้องให้ Developer ช่วย | หัวกระดาษระบุ Tester Team G900-05 / Team Under Test G900-04 |
| **T2** | `CS361_V2_Tester_Sheet_Project_5_Real_User - pathanan bantad (1)(1).pdf` หน้า 1–2 | TC1–TC3 PASS; ไม่ต้องให้ Developer ช่วย | มีข้อสังเกตเรื่องลิงก์บริษัทและความเป็นปัจจุบันของข้อมูล |
| **T3** | `CS361_V2_Tester_Sheet_Project_5_Real_User - pathanan bantad(3).pdf` หน้า 1–2 | TC1–TC3 PASS; ไม่ต้องให้ Developer ช่วย | ชื่อผู้ทดสอบและรายละเอียดหน้าแรกคล้าย T2 แต่หน้าสรุประบุว่าไม่มีข้อสังเกต |

> **หมายเหตุการประเมิน:**
> - แบบประเมิน T1 และ T2 มีข้อสังเกตสำคัญเรื่อง “บางบริษัทกดแล้วไม่ไปหน้าเว็บบริษัท” และคำถามเรื่องความเป็นปัจจุบันของข้อมูล
> - รหัสทีมใน T2/T3 มีรอยแก้ไข จึงรอยืนยันกับทีมเรื่องเวอร์ชันและรอบการทดสอบ

### 2.2 การสำรวจเว็บและ Source Code

- **เว็บที่ทดสอบจริง (Live Site):** [http://pawit-coop-web-067504979088.s3-website-us-east-1.amazonaws.com/](http://pawit-coop-web-067504979088.s3-website-us-east-1.amazonaws.com/)
  - เว็บไซต์เปิดใช้งานได้ปกติ รวดเร็วบน S3 Website Hosting มีข้อมูลครบทั้งหน้าตำแหน่งงาน (64 ตำแหน่ง), สถานประกอบการ, ข้อมูลนักศึกษา (10 รายการ), และกำหนดการสหกิจตามภาคเรียน
  - ยืนยันพฤติกรรมจริงของ UI: พบปัญหาเรื่อง Filter Reset Synchronization, การขาดปุ่มดูตำแหน่งจากหน้าบริษัท, และ Modal ที่ยังขาด Keyboard Accessibility
- **Repository Snapshot:** ตรวจสอบโค้ดจาก commit [`4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1`](https://github.com/KaylahJin/CS361-Project/tree/4b00e66eeec1c8dfcca9d2f2fe8f3e6497efbac1)
- **วิธีการตรวจ:** ผสมผสานการสำรวจและทดสอบเว็บจริง (Live Functional Audit) ร่วมกับการวิเคราะห์ Flow, Logic, Data Schema และ UI Implementation จาก Source Code

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
| **L1** | `CS361_Module06-RDS vs DynamoDB Lab Session.pdf`: โจทย์และแนวคิดสถาปัตยกรรม (Item Collection, Concurrency, RDS Proxy) |

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
| **F01** | รายละเอียดตำแหน่งมีหัวข้อไม่เหมือนกัน บางแห่งมีสถานที่ บางแห่งมีคุณสมบัติ [T1 TC1, Summary] | Verified Code/Live UI [S3,S7] | ปัญหา UX Layout: โค้ดซ่อนหัวข้อที่ไม่มีค่า (`{location && ...}`) แทนที่จะแสดงเป็นโครงสร้างคงที่ | ผู้ใช้สับสนว่าระบบแสดงผลตกหล่นหรือไม่สม่ำเสมอ; อยู่ใน View Details | **P1 / W1** |
| **F02** | ไม่พบ open และข้อมูลไม่ครอบคลุม test cases [T1 TC2, Summary] | Verified Code/Live UI [S7] | ปัญหา Context & Metadata: ข้อมูลเป็นประกาศปีก่อนหน้า แต่ UI ไม่มีป้ายบอกรอบปี และปุ่มยังเขียนว่า "สมัครงาน" | ผู้ใช้เข้าใจว่าระบบไม่อัปเดตหรือไม่พบประกาศที่เปิดรับ; อยู่ใน Search/Filter | **P1 / W1** |
| **F03** | TC3 ยังไม่ชัดเรื่องรายการปิด/รอบที่ไม่มีตำแหน่ง; ขัดกับ PASS ใน T2/T3 [T1 TC3,T2,T3] | Verified Code/Live UI [S3,S5,S6] | ข้อมูล 2568 (Job Offers) มีวันปิดรับแต่วันฝึกงานไม่ชัด ส่วนทะเบียน 2569 ยืนยันเฉพาะสิทธิ์บริษัท จึงไม่สามารถ map 64 ตำแหน่งได้ตรงๆ โดยไม่เดา | ต้องเพิ่มความสัมพันธ์รอบสหกิจ กำหนดขอบเขตข้อมูลจริง และสร้าง test fixture | **P1 / W2** |
| **F04** | บางบริษัทกดแล้วไม่ไปเว็บบริษัท [T2 Summary] | Verified Code/Live UI [S2] | ปัญหา Affordance: การ์ดบริษัทไม่มี URL แต่ทำ Hover effect เหมือนคลิกได้ (Dead Click) | ผู้ใช้รู้สึกว่าระบบมีลิงก์เสีย; ต้องแยกลิงก์ภายนอกและปิดการคลิกเมื่อไม่มี URL | **P1 / W3** |
| **F05** | ข้อมูลเป็นปัจจุบันไหม [T2 Summary] | Verified Code [S2] | วันที่ท้าย Employers hard-code 01/09/2569 และขาด Last Verified Date รายประกาศ | ผู้ใช้ไม่มั่นใจในความสดใหม่ของข้อมูล | **P1 / W1** |
| **F06** | จากบริษัทไปตำแหน่งที่เกี่ยวข้องไม่ต่อเนื่อง [UX review] | Verified Code/Live UI [S2,S3,S10] | ปัญหา Navigation Flow: การ์ดบริษัทมีเฉพาะทางออกเว็บภายนอก ไม่มีปุ่มดูตำแหน่งงานของบริษัทนั้นในระบบ | ผู้ใช้ต้องสลับหน้าและจำชื่อไปพิมพ์ค้นหาซ้ำ | **P1 / W3** |
| **F07** | ช่องค้นหาระบุค้นสถานที่ แต่ backend ไม่ค้นสถานที่ [UX review] | Verified Code [S3,S4,S5] | placeholder รวมสถานที่; SQL ค้นเฉพาะ title/name/short_name แต่ fallback ค้น location และ description เพิ่ม | คำค้นเดียวกันอาจได้ผลต่างตามแหล่งข้อมูล; อยู่ใน Search correctness | **P1 / W4** |
| **F08** | เครือข่ายล้มเหลวแล้วแสดงข้อมูลสำรองโดยไม่แจ้ง [UX review] | Verified Code [S4] | TypeError ที่ข้อความมี fetch ทำให้คืน local JSON; แจ้งเฉพาะ `console.warn`; ไม่ใช่ fallback ของทุก error | ผู้ใช้คิดว่าเป็นข้อมูลล่าสุดจาก Managed Source; เสี่ยงอ่านสถานะเก่า | **P1 / W4** |
| **F09** | เปลี่ยนคำค้นเร็วอาจถูกผลเก่าทับ [Code review] | Verified ว่าไม่มี response guard/abort ใน fetchPositions [S3]; การเกิด race จริง Pending | debounce ยกเลิกเฉพาะ timer ไม่ยกเลิก request ที่ส่งแล้ว | คำค้นกับผลลัพธ์อาจไม่ตรง; Search correctness | **P1 / W4**; ทดสอบ response ที่กลับสลับลำดับ |
| **F10** | รายละเอียดตำแหน่งเข้าถึงด้วยคีย์บอร์ดไม่ครบ [UX review] | Verified Code [S3]; interaction จริง Pending | ใช้ `h2 onClick`; modal ไม่มี dialog semantics, Escape/focus trap/return focus; ปุ่ม X ไม่มี accessible name | ผู้ใช้คีย์บอร์ด/โปรแกรมอ่านจอเปิดและปิดรายละเอียดลำบาก | **P1 / W5** |
| **F11** | ปุ่มสมัครอาจแสดงทั้งที่ประกาศปิดหรือหมดอายุ [UX review] | Verified Code [S3] | เงื่อนไขแสดง CTA เช็ก application_url อย่างเดียว | badge กับการกระทำชวนให้เข้าใจขัดกัน | **P1 / W5**; เปลี่ยนเป็นดูประกาศเดิมสำหรับ closed/expired |
| **F12** | หน้าเดิม/ตัวกรองไม่อยู่หลัง refresh และส่งลิงก์ผลค้นหาไม่ได้ [UX review] | Verified โครงสร้าง state ภายใน App/Positions [S3,S10]; ไม่ได้ทดสอบ browser history จริง | ไม่มี URL state สำหรับ activeTab/filter | กลับมาทำงานต่อหรือส่งให้เพื่อนยาก | **P2 / Deferred** |
| **F13** | Connection exhaustion ช่วง Rush Hour และความจำเป็นของ Proxy [Issue #81,L1] | Pending ผลวัด; Verified ว่า repo มี Proxy แล้ว [S8,S9] | Lambda หลาย execution environments มี pool แยกกัน; ไม่มี load evidence ของระบบนี้ | อาจกระทบ availability แต่ยังห้ามเรียกว่า incident ที่เกิดแล้ว | **P1 / W6** ประเมิน ไม่เพิ่ม Proxy ซ้ำ |
| **F14** | TLS configuration/comment ไม่สอดคล้องกัน [Architecture review] | Verified Code [S8,S9]; live config Pending | db.mjs ใช้ SSL แต่ `rejectUnauthorized=false`; proxy.tf `require_tls=false` และ comment บอก client ไม่ใช้ TLS | ตรวจสอบ server certificate ไม่ครบและทีมอาจตั้งค่าตาม comment ผิด | **P1 / W6** ตรวจ CA/TLS และทำเอกสารให้ตรง; ทดสอบก่อนเปลี่ยน |
| **F15** | หนึ่งนักศึกษาควรมีไม่เกินหนึ่งแผน แต่ DB ไม่บังคับ [Architecture review] | Verified [S1,S6] | coop_plans.student_id มี index แต่ไม่มี UNIQUE | ข้อมูลอาจขัดกับ cardinality ที่ทีมตกลง แม้ V2 ยังไม่มี submit flow | **P2 / Deferred**; ตรวจข้อมูลซ้ำก่อน migration |
| **F16** | ไม่พบปัญหา/ค้นกรองได้ตามเงื่อนไข [T2,T3] | Verified เฉพาะสิ่งที่แบบประเมินบันทึก; การทำซ้ำ Pending | ไม่มี dataset, URL, timestamp/commit ของรอบทดสอบ | เป็นผลบวกที่ควรรักษา ไม่ได้หักล้าง F03 หรือยืนยันทุก edge case | **Preserve** / ใส่ regression cases ใน W1–W5 |
| **F17** | Navbar มีเฉพาะไอคอนและซ่อนข้อความไว้ตอน hover ทำให้หาหน้ายาก [User Testing] | Verified Live UI / `App.tsx` | Mystery Meat Navigation: Navbar ใช้เฉพาะ Icon โดยไม่มี Text Label กำกับ ทำให้ผู้ใช้ต้องเดาและเสียเวลา hover หาทาง | ผู้ใช้สับสนในการเปลี่ยนหน้าและต้องคลำหาเมนู; กระทบ Primary Navigation | **P1 / W3** |
| **F18** | ข้อมูลเป็นตัวหนังสือล้วน (Text-heavy) ขาดไอคอนและ Visual Hierarchy ทำให้อ่านยากและแยกแยะแต่ละหน้าไม่ออก [User Testing] | Verified Live UI [S2,S3] | ขาด Iconography, Badges และ Visual Anchor ทุกหน้าใช้โทนสีและ Layout การ์ดคล้ายกันหมด ทำให้น้ำหนักสายตาเท่ากัน | ผู้ใช้รู้สึกว่าต้องอ่านตัวหนังสือทั้งหมดถึงจะเข้าใจ และไม่รู้ว่ากำลังอยู่บริบทหน้าใด | **P1 / W1, W5** |
| **F19** | หน้าหลักไม่สะท้อนภาพรวม การ์ดยาวอ่านยาก และไม่ตอบโจทย์สิ่งที่ผู้ใช้ต้องการทำก่อน [User Testing] | Verified Live UI / `App.tsx` | หน้า Home ทำหน้าที่เป็นเพียง Link Repository มีข้อความอธิบายยาวเหยียด แต่ขาด Action Shortcuts และภาพรวมสถานะ | ผู้ใช้ไม่เห็นภาพรวมระบบและไม่รู้ว่าจะเริ่มทำอะไรก่อน | **P2 / W3** |

> **หมายเหตุระดับความสำคัญ:**
> - **P1** = กระทบความถูกต้องของข้อมูล / ฟังก์ชันหลัก / Accessibility / Navigation หลัก
> - **P2** = ปรับปรุงประสบการณ์ผู้ใช้และความสะดวกเพิ่มเติม

---

## 5. ข้อเสนอ UX ที่นำไปทำได้

### 5.1 การนำทางหลักและ Navbar ที่ชัดเจน (Navigation & Wayfinding)
- **ใส่ Text Label กำกับคู่กับ Icon ใน Navbar ทันที:** ปรับเมนูด้านบนให้แสดงข้อความควบคู่ไอคอนอย่างชัดเจนเสมอ (เช่น `[🏠 หน้าแรก]` `[💼 ตำแหน่งงาน]` `[🏢 สถานประกอบการ]` `[📅 แผนสหกิจ]`) ไม่ซ่อนข้อความไว้ใน Tooltip หรือบังคับให้ผู้ใช้ต้องนำเมาส์ไป Hover
- **ปรับการ์ดหน้าหลัก (Home) ให้เป็น Action Cards กระชับ:** ลดความยาวของย่อหน้าข้อความ และเปลี่ยนเป็นการ์ดทางลัดที่ตอบโจทย์ User Intent โดยตรง เช่น ปุ่ม `[ ค้นหาตำแหน่งงานเปิดรับ → ]`, `[ ดูรายชื่อสถานประกอบการ → ]` เพื่อให้เห็นภาพรวมและเริ่มใช้งานได้ทันที
- **ทำทางเดินหลักจากบริษัทไปตำแหน่งงาน:** ในหน้า **“สถานประกอบการ”** ต้องมีปุ่ม **“ดูตำแหน่งของบริษัทนี้”** เป็น Action หลัก และแยกลิงก์ **“เว็บไซต์บริษัท ↗”** เป็น Action รอง
- **จัดการ Dead Click:** หากบริษัทไม่มี URL เว็บไซต์ ให้แสดงเป็นข้อความปกติ (Disabled state) ไม่ทำเป็น Clickable Link หลอกตา
- **คงบริบทเมื่อเลือกรอบสหกิจ:** เมื่อเลือกรอบแล้วไม่พบตำแหน่ง ให้คงชื่อบริษัทไว้ และแสดง Empty State: *“บริษัทนี้ไม่มีประกาศรับสมัครสำหรับ [รอบเวลาที่เลือก]”* พร้อมปุ่มเลือกดูรอบอื่น

### 5.2 ลดความ Text-Heavy และเพิ่มการสื่อสารด้วยภาพ (Visual Hierarchy & Scannability)
- **ใช้ Icon + Visual Badges สื่อสารแทนข้อความยาว:** ใส่ไอคอนและชิปสีนำหน้าข้อมูลสำคัญ เพื่อให้ผู้ใช้กวาดสายตา (Scan) เข้าใจได้ใน 2–3 วินาที เช่น:
  - 🏢 ชื่อบริษัท / 📍 สถานที่ปฏิบัติงาน / 💼 รูปแบบงาน (On-site/Hybrid/Remote)
  - 🏷️ ป้ายสถานะรับสมัคร (สีเขียว=เปิดรับ, สีส้ม=ใกล้ปิดรับ, สีเทา=ไม่ระบุ)
  - 💰 สวัสดิการและค่าตอบแทน / 📅 วันปิดรับสมัคร
- **สร้าง Visual Hierarchy & Page Identity ชัดเจน:**
  - เน้นขนาดตัวหนาใหญ่ให้ชื่อตำแหน่งและหัวข้อสำคัญเป็นจุดดึงดูดสายตา (Visual Anchor) ข้อมูลรองใช้สีเทา muted
  - กำหนดโทนสีเน้น (Accent) หรือ Header Hero ประจำหน้า ให้ผู้ใช้แยกแยะบริบทได้ทันทีว่ากำลังดูตำแหน่งงาน บริษัท หรือแผนสหกิจ
- **ปรับ Detail Modal ให้อ่านง่าย:** จัดโครงสร้างข้อมูลใน Modal รายละเอียดตำแหน่งงานให้อยู่ในรูปแบบ Key-Value Grid พร้อมไอคอนกำกับ แทนการวางย่อหน้าข้อความต่อกันเป็นก้อนเดียว

### 5.3 ใช้โครงสร้างรายละเอียดเดียวกัน (Fixed Schema Display)
- **เรียงลำดับหัวข้อคงที่:** ตำแหน่ง → บริษัท → สถานที่ → รูปแบบงาน → คุณสมบัติ → รายละเอียด → รอบสหกิจ → สถานะ/วันปิดรับ → แหล่งประกาศ/ตรวจสอบล่าสุด
- **ห้ามซ่อนหัวข้อเมื่อไม่มีข้อมูล:** ให้แสดงข้อความกำกับชัดเจน เช่น *“ประกาศไม่ได้ระบุสถานที่”* หรือ *“ไม่ได้ระบุคุณสมบัติเฉพาะ”* เพื่อให้ผู้ใช้ทราบว่าระบบแสดงผลครบถ้วน

### 5.4 ทำให้สถานะและบริบทสื่อความหมายตรงกัน (Context & Freshness)
- เพิ่ม Banner / Label บอกบริบทข้อมูล: เช่น *"คลังข้อมูลประกาศรับสมัครสหกิจศึกษา (ประจำปีการศึกษา 2568)"* พร้อมระบุวันตรวจสอบล่าสุด
- ปรับเปลี่ยนข้อความและปุ่ม CTA ให้ตรงกับสถานะ:
  - **open:** “เปิดรับสมัคร” และปุ่ม “ไปช่องทางรับสมัคร ↗”
  - **closed / expired:** “ปิดรับแล้ว / หมดเขต” และปุ่ม “ดูประกาศต้นทางย้อนหลัง ↗”
  - **unknown:** “ยังไม่ยืนยันสถานะ” และปุ่ม “ตรวจสอบประกาศทางการ”
  - **API Error:** แจ้งเตือนข้อผิดพลาดพร้อมปุ่มลองใหม่ และปิด silent fallback ใน production

### 5.5 สิ่งที่ทำดีแล้วและควรรักษา
- **S3 มี:** loading skeleton, error พร้อม retry, empty state ที่อธิบายคำค้น, จำนวนผลลัพธ์, ตัวกรองที่เลือกและปุ่มล้าง รวมถึงลิงก์ประกาศต้นทาง
- **S2 มี:** `aria-label` ของ search/filter และป้องกันผล request เก่าด้วย `cancelled` flag
- ควรนำรูปแบบที่ดีนี้ไปใช้ให้สม่ำเสมอทั่วทั้งระบบ
- *ตรวจสอบเพิ่มเติม:* ทดสอบ responsive (Mobile 360/390px, Desktop), Zoom 200%, Keyboard Navigation (Tab/Enter/Escape), ข้อความยาว และ Empty/Error states

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

> **ข้อสรุป:** ใช้ **RDS ต่อไป** เนื่องจากระบบปัจจุบันมีความสัมพันธ์หลาย entity และรองรับการค้นหาหลายเงื่อนไขได้ตรงกับ access pattern ปัญหา F01–F11 และ F17–F19 สามารถแก้ไขได้ที่ระดับ Data, API และ UI โดยตรง

### 6.2 Concurrency และ Connection Exhaustion

- **S8 สร้าง `pg.Pool` ที่ module scope และตั้ง `max=5`** ซึ่ง reuse ได้ภายใน warm execution environment โดย Lambda แต่ละ container จะมี connection pool แยกกัน
- **RDS Proxy รวมและนำ backend connections กลับมาใช้ได้** ช่วยลด connection spikes จาก Lambda
- **สิ่งที่ยืนยันจาก S9:**
  - Lambda `DB_HOST` ชี้ Proxy endpoint อยู่แล้ว
  - Lambda timeout 10 วินาที; pg connection timeout 5 วินาที
  - Proxy `connection_borrow_timeout` 120 วินาที, `max_connections_percent` 100
  - `require_tls=false` ขณะที่ client เปิด SSL แบบไม่ตรวจ certificate
  - ควรทบทวน timeout budget และ connection headroom ให้เหมาะสมกับการใช้งานจริง
- **ข้อสรุปเรื่อง Proxy:** คง RDS Proxy ไว้ตามเดิม และตรวจทานการตั้งค่า/เก็บ metrics การใช้งาน
- **แผนวัดประสิทธิภาพ (W6):**
  - ทดสอบที่ระดับ concurrency 1 → 10 → 25 → 50 เพื่อบันทึก duration, p50/p95, errors, DB connections/CPU และ Proxy latency
- **ตัวชี้วัดเป้าหมาย:** Warm read $p95 \le 2$ วินาที, Error rate $5xx < 1\%$ และไม่เกิด connection exhaustion

### 6.3 Query Efficiency และ GSI

- RDS ปัจจุบันมี index บน `company_id`, `category`, `work_mode`, `status` และ trigram บนชื่อ/ตำแหน่งแล้ว [S6] ควรใช้ `EXPLAIN (ANALYZE, BUFFERS)` ในการตรวจสอบ query execution plan
- **ตัวอย่างแนวคิดการออกแบบหากใช้ DynamoDB:**

| Access pattern | แบบ key ที่เสนอ | วิธีอ่าน |
| :--- | :--- | :--- |
| **บริษัทและตำแหน่งทั้งหมดของบริษัท** | `PK=COMPANY#<id>`, `SK=META` หรือ `POSITION#<id>` | Query ด้วย PK; เลือก prefix เมื่ออ่านเฉพาะตำแหน่ง |
| **ตำแหน่งของบริษัทในรอบที่ระบุ** | availability item: `PK=COMPANY#<id>`, `SK=PERIOD#<periodId>#POSITION#<positionId>` | Query PK + `begins_with` SK ของรอบ |
| **ตำแหน่งเปิดรับในรอบใดรอบหนึ่งจากทุกบริษัท** | `GSI1PK=PERIOD#<periodId>#STATUS#open`, `GSI1SK=COMPANY#<companyId>#POSITION#<positionId>` | Query GSI1 ด้วย partition key ที่แน่นอน |

- **ข้อควรระวัง DynamoDB:** หากใช้ DynamoDB ในอนาคต ต้องออกแบบ Item Collection / GSI ให้ตรงกับ Access Pattern โดยเฉพาะ และคำนึงถึง Write amplification, Eventual consistency และข้อจำกัดในการกรองหลายเงื่อนไข

---

## 7. Improvement Scope และรายการงานที่ตัดออก

| การตัดสินใจ | รายการ | เหตุผล |
| :--- | :--- | :--- |
| **In Scope** | #81 และงานย่อย W1–W6 | แก้ไข core flow, ความถูกต้องของข้อมูล, Accessibility, UI Scannability/Navbar และการตั้งค่าพื้นฐาน |
| **Deferred** | URL / Deep-link / Filter state persistence [F12] | ปรับปรุงในระยะถัดไป เพื่อให้โฟกัสแก้ข้อมูลและความถูกต้องของรอบก่อน |
| **Deferred** | UNIQUE Constraint ของ Coop Plan [F15] | ต้องตรวจสอบข้อมูลเดิมและเตรียม migration ในรอบที่มี write workflow |
| **Deferred** | Migration ไป DynamoDB / Benchmark เต็มรูปแบบ | RDS ยังตอบโจทย์ได้ดีและมีความซับซ้อนต่ำกว่า |
| **Deferred** | ระบบ Authentication, Role, Approval Workflow | อยู่นอกขอบเขตของ V2 (ตาม Requirement S1) |
| **Deferred** | ระบบดึงประกาศอัตโนมัติ / Offline Mode เต็มรูปแบบ | ปรับปรุงในอนาคต รอบนี้เน้นความถูกต้องและการแสดงเวลาตรวจสอบล่าสุด |
| **Won't Fix** | Hardcode ข้อมูลหรือเปลี่ยนสถานะเป็น open ทั้งหมดเพื่อผ่าน TC | ข้อมูลต้องตรงตามจริง โดยใช้สถานะ "ไม่ระบุ" หรือ "ยังไม่ตรวจสอบ" แทน |
| **Won't Fix** | ซ่อนบริษัทที่ไม่มีตำแหน่งในรอบที่เลือก | ขัดกับ Requirement TC3 ที่ต้องแสดงว่าบริษัทยังมีอยู่ในระบบ |

---

## 8. การแบ่งงานติดตาม (Issue Breakdown)

แบ่งงานติดตามออกเป็น 6 งาน (W1–W6) สำหรับนำไปสร้าง Issue ใน GitHub ดังนี้:

| งาน / ชื่อ issue ที่เสนอ | ประเด็นต้นทาง | จุดที่ต้องแก้และขอบเขต | ผลที่ต้องการ | ประมาณการ |
| :--- | :--- | :--- | :--- | :---: |
| **W1 ปรับรายละเอียดตำแหน่งและระบุความเป็นปัจจุบันของข้อมูล** | F01, F02, F05, F16, F18 | `Positions.tsx`, วันที่ท้าย `Employers.tsx`, metadata แหล่งข้อมูล: แสดงหัวข้อคงที่, แก้ Layout shift, เพิ่ม Icon/Badges กำกับข้อมูล และระบุข้อความเมื่อไม่มีข้อมูล แทนที่วันที่ hardcode | ผู้ใช้เทียบตำแหน่งได้ง่าย กวาดสายตาได้ไว ข้อมูลชัดเจนและตรวจสอบได้ | 8 ชม. |
| **W2 เชื่อมตำแหน่งกับรอบสหกิจและแสดงผลเมื่อไม่มีตำแหน่งตรงรอบ** | F03 | `schema.sql`, Position API, `Positions.tsx`: เพิ่มความสัมพันธ์รอบสหกิจกับตำแหน่ง (`position_periods`), filter และรายละเอียดรอบ โดยมีกลยุทธ์ข้อมูลและ Test Fixture ชัดเจน | ตอบ TC1/TC3 ได้ถูกต้องตามข้อมูลจริง คงข้อมูลบริษัทเมื่อไม่มีตำแหน่งตรงรอบ | 12 ชม. |
| **W3 เชื่อมหน้าบริษัทไปยังตำแหน่งและแก้พฤติกรรมลิงก์บริษัท** | F04, F06, F17, F19 | `Employers.tsx`, `App.tsx`, `Positions.tsx`: เพิ่ม Text Label ใน Navbar, ปรับ Action Cards หน้าแรก, เพิ่มปุ่มดูตำแหน่งของบริษัท แยกลิงก์เว็บภายนอก และจัดการ URL ที่ไม่สมบูรณ์ | ผู้ใช้หาทางและเปลี่ยนหน้าสะดวก ลิงก์ทำงานถูกต้อง เชื่อมโยงบริบทชัดเจน | 7 ชม. |
| **W4 ทำผลค้นหาและการแจ้งข้อผิดพลาดให้ตรงกับการใช้งาน** | F07, F08, F09 | `listPositions.mjs`, `positionApi.ts`, `Positions.tsx`: ค้นหาสถานที่ตามคำค้น ปิด silent fallback และป้องกัน race condition | ผลค้นหาถูกต้องตรงกันทั้งระบบ แจ้งข้อผิดพลาดชัดเจน | 8 ชม. |
| **W5 ปรับการเปิดรายละเอียดและปุ่มสมัครตามสถานะ** | F10, F11, F18 | `Positions.tsx`: ปรับ modal รายละเอียดให้เป็น Key-Value Grid พร้อม Icon (ลด Text-heavy), รองรับ Keyboard/Focus (Accessibility) และปรับ CTA ตามสถานะประกาศ | เข้าถึงรายละเอียดได้สะดวก กวาดสายตาอ่านง่าย และปุ่มสมัครสอดคล้องกับสถานะจริง | 7 ชม. |
| **W6 ตรวจและปรับ Connection/TLS configuration ตามหลักฐาน** | F13, F14 | `db.mjs`, `proxy.tf`, `lambda.tf`: ตรวจสอบ timeout, connection pool, TLS cert และเก็บ baseline metrics | ค่า Configuration ถูกต้อง ปลอดภัย และมีข้อมูลประสิทธิภาพรองรับ | 7 ชม. |

> ประมาณการเวลาทั้งหมดรวมขั้นตอนการวิเคราะห์ พัฒนา ทดสอบ และรีวิวแล้ว

### กลยุทธ์ข้อมูลและการจัดการสำหรับ W2 (Data & Fixture Strategy)
1. **คง 64 ตำแหน่งเดิมไว้ทั้งหมด:** รายการที่ยังไม่มีหลักฐานช่วงปฏิบัติงานที่ชัดเจน ให้กำหนดสถานะรอบเป็น **"ยังไม่ระบุรอบ"** (ไม่สุ่มหรือเดาข้อมูลให้ครบ 64 รายการ)
2. **Timebox 2 ชม. สำหรับ Manual Map 5 ตำแหน่งจริง:** ตรวจสอบและจับคู่ 5 ตำแหน่งที่มีหลักฐานช่วงเวลาในประกาศเดิม (POS021–POS023 Cube SoftTech, POS029 ExxonMobil, POS051 SCB TechX) บันทึกแหล่งอ้างอิงและวันที่ตรวจ
3. **ใช้ Test Fixture แยกสำหรับทดสอบ TC1–TC3:** สร้างชุดข้อมูลจำลอง (3 ตำแหน่ง / 2 บริษัท / 2 รอบ) ครอบคลุมตำแหน่งในรอบ A, รอบ B, และไม่ระบุรอบ เพื่อให้ Unit/E2E Testing ทำงานได้สมบูรณ์โดยไม่ต้องรอ Clean ข้อมูลจริงครบ
4. **Idempotent Migration:** สคริปต์ Migration ต้องสามารถรันซ้ำได้โดยไม่เกิด Duplicate Key และมี Rollback เฉพาะตารางความสัมพันธ์ที่เพิ่มขึ้นมา

### ข้อพิจารณาก่อนเริ่มงาน
- **งานที่เริ่มได้ทันที:** W1, W3, W4, W5
- **งานที่มีกลยุทธ์ข้อมูลรองรับแล้ว:** W2 (ใช้ Mock Fixture ร่วมกับการ Manual Map 5 รายการจริง)
- **งานที่ต้องใช้ AWS Environment:** W6 (ตรวจสอบการตั้งค่า Connection/TLS)
- **จุดเชื่อมโยง:** W1 กับ W5 ทำงานบนหน้าเดียวกัน (แบ่งขอบเขต data vs modal/button), W2 และ W3 เกี่ยวข้องกับบริบทบริษัท/รอบ, W4 ต้องรับ filter จาก W2

### การเลือกหัวข้อไปสร้าง Issue

| ส่วนงาน | ผู้สร้างและหน้าที่ |
| :--- | :--- |
| **#81 เอกสารวิเคราะห์กลาง** | SunanthidaPhaengbao รับผิดชอบจัดทำเอกสารกลาง และช่วยตรวจรีวิว Issue อื่นๆ ตามความเหมาะสม (ไม่เจาะจง issue และไม่รีวิว W5 ที่ตนเองเป็น Assignee) |
| **W1, W3** | ruvcandyfruit รับผิดชอบสร้าง issue (และเป็น Reviewer ของ W1, W3) |
| **W2** | Tatdanai6609611964 รับผิดชอบสร้าง issue (และเป็น Reviewer ของ W2) |
| **W4, W5** | KaylahJin รับผิดชอบสร้าง issue (และเป็น Reviewer ของ W4, W5) |
| **W6** | Pawit-Billamas รับผิดชอบสร้าง issue (และเป็น Reviewer ของ W6) |

> สมาชิกที่รับผิดชอบให้นำขอบเขตและประเด็น Fxx ไปสร้าง Issue ใน GitHub พร้อมใส่รายละเอียด Acceptance Criteria

### ข้อตกลงการทำงาน (Assign & Review)
- ผู้สร้าง Issue จะทำหน้าที่เป็น **Reviewer หลัก** ของ Issue นั้น
- ผู้ที่รับมอบหมาย (Assignee) ทำงาน จะต้องเป็นคนละคนกับ Reviewer เพื่อให้มีการ Cross-check (ห้าม Assignee เป็นผู้รีวิวงานที่ตนเองทำเด็ดขาด)
- **SunanthidaPhaengbao** จะช่วยตรวจรีวิว Issue อื่นๆ ร่วมกับเพื่อนตามกำหนดการทำงาน โดยไม่เจาะจง Issue และจะไม่เข้าไปรีวิว Issue W5 ที่ตนเองเป็น Assignee
- **ข้อปฏิบัติ:** เมื่อ Merge PR เรียบร้อยแล้ว ให้ลบ Branch ของงานนั้นทันที

---

## 9. Capacity & Work Breakdown

> **หมายเหตุ:** หน่วยทั้งหมดเป็น **person-hours** รวมเวลาวิเคราะห์/เขียน issue พัฒนา ทดสอบ และรีวิว ไม่ใช่ระยะเวลาปฏิทิน

### ตารางแจกแจงงานตามกิจกรรม (Activity Breakdown)

| งาน | วิเคราะห์ | พัฒนา/จัดทำ | ทดสอบ/ตรวจหลักฐาน | รีวิว | รวม |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **#81** วิเคราะห์และทบทวนเอกสารกลาง | 3 | 1 | 1 | 1 | **6** |
| **W1** รายละเอียดและข้อมูล | 1 | 4 | 2 | 1 | **8** |
| **W2** รอบรับสมัคร/TC3 | 2 | 6 | 3 | 1 | **12** |
| **W3** บริษัท/ลิงก์ | 1 | 3 | 2 | 1 | **7** |
| **W4** Search/error/race | 1 | 4 | 2 | 1 | **8** |
| **W5** Modal/CTA | 1 | 3 | 2 | 1 | **7** |
| **W6** Architecture/config/evidence | 2 | 2 | 2 | 1 | **7** |
| **รวมแผนหลัก** | **11** | **23** | **14** | **7** | **55** |

### การจัดภาระรายคนหลัง Assign
งบประมาณโครงการ 55 person-hours (และสำรองรวม 5 ชม. รวมสูงสุด 60 ชม.) มีการจัดสรรภาระงานตามกิจกรรมจริงของทั้ง 5 คน โดยรักษาหลักการ Cross-Review (Assignee ไม่เป็น Reviewer หลักของงานตัวเอง) ดังนี้:

| สมาชิก | สร้าง Issue (วิเคราะห์) | Review (ตรวจ PR) | งานที่ได้รับมอบหมาย (พัฒนา + ทดสอบ) | รวมเวลาจริง |
| :--- | :--- | :--- | :--- | :---: |
| **SunanthidaPhaengbao** | **#81** (5 ชม.) | **#81** & ช่วยตรวจงานอื่น (1 ชม.) *(ไม่รีวิว W5)* | **W5** (5 ชม.) | **11 ชม.** |
| **KaylahJin** | **W4** (1 ชม.), **W5** (1 ชม.) | **W4** (1 ชม.), **W5** (1 ชม.) | **W2** (9 ชม.) | **13 ชม.** |
| **Tatdanai6609611964** | **W2** (2 ชม.) | **W2** (1 ชม.) | **W3** (5 ชม.), **W6** (4 ชม.) | **12 ชม.** |
| **ruvcandyfruit** | **W1** (1 ชม.), **W3** (1 ชม.) | **W1** (1 ชม.), **W3** (1 ชม.) | **W4** (6 ชม.) | **10 ชม.** |
| **Pawit-Billamas** | **W6** (2 ชม.) | **W6** (1 ชม.) | **W1** (6 ชม.) | **9 ชม.** |
| **รวมทั้งสิ้น** | **13 ชม.** | **7 ชม.** | **35 ชม.** | **55 ชม.** |

- **ลำดับขั้นตอน:** สรุปเห็นชอบเอกสาร #81 → สร้าง GitHub Issues (W1–W6) ตามผู้รับผิดชอบสร้าง → กระจาย Assign ให้สมาชิกทั้ง 5 คนตามตาราง → พัฒนาและทดสอบ → ทำ Code Review ข้ามบุคคล → Merge PR และลบ Branch งานนั้น

---

## 10. Verification Plan และหลักฐานก่อนปิด Issue

| กรณี | สิ่งที่ต้องตรวจ | หลักฐาน |
| :--- | :--- | :--- |
| **TC1** | บริษัท/ตำแหน่ง/รอบเชื่อมกันและชื่อไม่ปน | API response + screenshot + fixture/record ID |
| **TC2** | คำค้น/บริษัท/หมวด/รูปแบบงาน/สถานะ/รอบ ให้ผลตรงเงื่อนไข | ชุด input/expected/actual รวม reset และผลว่าง |
| **TC3** | บริษัทมีอยู่แต่ไม่มีรายการตรงรอบ; unknown แยกจากไม่มี | บริษัทเดียวรอบ A/B และตัวอย่างไม่ระบุรอบ |
| **ข้อมูลไม่ครบ** | หัวข้อยังอ่านได้และไม่แต่งเติม | ตัวอย่าง null/unknown |
| **ลิงก์บริษัท** | valid/blank/invalid และตัวที่ T2 รายงาน | URL ที่ตรวจและผลจริง |
| **Error / race** | API 500, network failure, response เก่ากลับทีหลัง | test output และภาพ error/retry |
| **Accessibility** | ปุ่มรายละเอียด, Tab/Enter/Escape, focus กลับ, small viewport | checklist พร้อม browser/viewport |
| **Architecture** | connection/TLS/timeout และผลวัดตามทรัพยากรที่มี | config, metrics, workload |

---

## 11. เอกสาร AWS อ้างอิง

- [A1: Data modeling building blocks / Item Collection](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/data-modeling-blocks.html)
- [A2: RDS Proxy connection considerations](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-connections.html)
- [A3: Avoiding pinning an RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy-pinning.html)
- [A4: Using Global Secondary Indexes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html)
- [A5: DynamoDB read consistency](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html)
- [A6: Filter expressions for Query](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.FilterExpression.html)
