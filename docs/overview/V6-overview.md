# V6 – Performance & Cost

## 1. Overview

V6 มุ่งปรับปรุงเวลาในการตอบสนองและประสิทธิภาพการใช้ทรัพยากรของระบบ โดยเลือกเส้นทางการค้นหาและกรองสถานประกอบการ (Employers) เป็น Critical Path สำหรับการตรวจสอบ เนื่องจากเป็นเส้นทางที่ผ่าน Frontend, API Gateway, Lambda และ PostgreSQL และมีทั้งการโหลดรายการกับการค้นหาจากผู้ใช้

การปรับปรุงต้องรักษารูปแบบข้อมูลและพฤติกรรมที่ผู้ใช้เห็นเดิม การเปลี่ยนแปลงจะตัดสินใจจากผลวัดและ Query Plan ไม่ใช่เพิ่ม Resource หรือ Index โดยไม่มีหลักฐานรองรับ

## 2. Problem / Goal

### 2.1 Problem

หน้า Employers เรียก API เพื่อโหลดรายการสถานประกอบการ และส่งคำค้นหา/จังหวัดไปให้ Backend กรองข้อมูล ปัจจุบันมีลักษณะที่ควรตรวจสอบด้าน Performance และ Cost ดังนี้

- เมื่อเปิดหน้า มีการเรียกข้อมูลทั้งหมดเพื่อสร้างตัวเลือกจังหวัดและนับจำนวน จากนั้นมีการเรียก `/companies` อีกครั้งเพื่อโหลดรายการ
- API ส่งผลลัพธ์เป็นรายการทั้งหมดที่ตรงเงื่อนไข โดยยังไม่พบการจำกัดจำนวนผลลัพธ์หรือ Pagination ในเส้นทางนี้
- การค้นหาชื่อใช้ `ILIKE '%คำค้น%'` กับ `name` และ `short_name` พร้อมเรียงตาม `name`
- Schema มี GIN trigram indexes สำหรับชื่อบริษัท และ B-tree index สำหรับ `province` อยู่แล้ว แต่ยังต้องตรวจสอบ Query Plan และการใช้งาน Index จากฐานข้อมูลจริง
- การเรียก API แต่ละครั้งอาจก่อให้เกิด Lambda invocation, Database work และการส่งข้อมูลซ้ำ ค่าใช้จ่ายจริงจึงต้องพิจารณาจากจำนวน Request, เวลา Lambda, ปริมาณผลลัพธ์ และ RDS configuration ที่ใช้ทดสอบ

### 2.2 Goals

1. เก็บ Baseline ของเส้นทางเปิดหน้า ค้นหาชื่อ และกรองจังหวัด ภายใต้ชุดข้อมูลและสภาพแวดล้อมที่บันทึกย้อนกลับได้
2. ใช้ผลวัดและ PostgreSQL Query Plan เพื่อระบุ Bottleneck ที่เกิดขึ้นจริง
3. ปรับปรุงอย่างน้อยหนึ่งจุด โดยคงพฤติกรรมและผลลัพธ์ที่ระบบต้องการ
4. รัน Benchmark ซ้ำด้วยเงื่อนไขเดียวกับ Baseline และรายงานผล Before–After
5. ประเมินต้นทุนต่อ workload โดยแยกสิ่งที่ลดลงได้จากสิ่งที่เป็นต้นทุนคงที่ของ Environment
6. บันทึกวิธีทดสอบ ผลลัพธ์ และข้อจำกัดให้ทีมทำซ้ำได้

## 3. Current System

| ส่วน | สิ่งที่มีอยู่แล้ว | ประเด็นที่ต้องตรวจสอบ |
|---|---|---|
| Frontend | `src/pages/Employers.tsx` หน่วงเวลาค้นหาก่อนส่ง Request และโหลดข้อมูลเพื่อสร้างตัวเลือกจังหวัด | จำนวน Request ตอนเปิดหน้าและเมื่อเปลี่ยนคำค้นหา/จังหวัด, ขนาด Response และเวลาที่ผู้ใช้รอ |
| API Client | `src/data/companyApi.ts` เรียก `GET /companies` พร้อม `search` และ `province` | เวลา End-to-End, จำนวน Request และปริมาณข้อมูลที่ส่ง |
| Lambda | `infra/lambda/companies/listCompanies.mjs` ใช้ Parameterized Query, `ILIKE` สำหรับชื่อ และ `ORDER BY name` | Query Latency, จำนวนแถวที่อ่าน/ส่งคืน และ Query Plan |
| PostgreSQL Schema | `infra/schema.sql` สร้าง GIN trigram indexes บน `name` / `short_name` และ B-tree index บน `province` | Index ถูกสร้างใน DB เป้าหมายหรือไม่, Planner เลือกใช้หรือไม่ และ Index มีประโยชน์กับข้อมูลจริงเพียงใด |
| Database Connection | `infra/lambda/companies/db.mjs` ใช้ Pool ที่ระดับ Module เพื่อ reuse ใน Lambda execution context | Cold/Warm behavior, Connection count และผลจาก Pool ต่อภาระ RDS |
| AWS Resources | Lambda อยู่ใน VPC และ Terraform กำหนด RDS instance class ผ่านตัวแปร | Instance class, Region, Lambda Memory/Duration และต้นทุนจริงระหว่างทดสอบ |

รายละเอียดข้างต้นเป็นการอ่านโค้ดและ Configuration ใน Repository ไม่ใช่ผลทดสอบจาก Environment จริง ต้องบันทึก Configuration ที่ใช้ Benchmark ในหลักฐานแต่ละครั้ง

## 4. Selected Critical Path

**เส้นทางที่เลือก:** เปิดหน้า Employers → โหลดรายการสถานประกอบการ → ค้นหาด้วยชื่อหรือกรองตามจังหวัด → แสดงผลลัพธ์

### 4.1 Scenarios

| Scenario | การกระทำ | สิ่งที่วัด |
|---|---|---|
| เปิดหน้า | เข้าหน้า Employers โดยไม่ใส่ Filter | จำนวน API Requests, เวลาแสดงรายการ, Response bytes และ Lambda/DB work |
| ค้นหาชื่อ | ส่งคำค้นหาที่ตรงกับหลายรายการและคำค้นหาที่ตรงกับรายการน้อย | End-to-End latency, API/SQL latency, จำนวนแถวและ Query Plan |
| กรองจังหวัด | เลือกจังหวัดที่มีข้อมูลและจังหวัดที่มีข้อมูลน้อย | End-to-End latency, API/SQL latency, จำนวนแถวและ Query Plan |
| ค้นหาและกรองร่วมกัน | ส่ง `search` และ `province` พร้อมกัน | Latency, จำนวนแถวและ Query Plan ของเงื่อนไขร่วม |

เลือกคำค้นหาและจังหวัดให้คงที่ตลอดการทดสอบ โดยไม่บันทึกข้อมูลส่วนบุคคลหรือ Secret ลงในหลักฐาน

### 4.2 In Scope

- วัด Performance ของ Frontend/API/Database ใน Critical Path ข้างต้น
- ตรวจสอบ Query Plan และการใช้ Index สำหรับ Query ที่ทดสอบ
- ปรับปรุงจำนวน Request, Query หรือปริมาณข้อมูลที่ส่ง เมื่อผลวัดยืนยันว่าเป็น Bottleneck
- พิจารณา Index หรือ Configuration เพิ่มเติมเฉพาะเมื่อมีผลทดสอบรองรับและประเมินผลข้างเคียงแล้ว
- จัดทำผล Before–After และประเมิน Cost ของ workload ที่กำหนด

### 4.3 Out of Scope

- เปลี่ยน Business Workflow, สิทธิ์ผู้ใช้ หรือรูปแบบข้อมูล API โดยไม่มีความจำเป็น
- ย้าย Database Engine หรือ Cloud Provider
- เพิ่ม AWS Resource ที่มีค่าใช้จ่ายโดยไม่มีข้อมูลยืนยันความจำเป็น
- อ้างว่า Cost ลดลงจาก Latency ที่ดีขึ้นเพียงอย่างเดียว โดยไม่มีการคำนวณหรือข้อมูล Billing รองรับ
- ปรับปรุงเส้นทางอื่นที่ไม่เกี่ยวกับ Critical Path ที่เลือก เว้นแต่พบผลกระทบโดยตรงจากการเปลี่ยนแปลง

## 5. Measurement Plan

### 5.1 เงื่อนไขควบคุม

บันทึกข้อมูลต่อไปนี้ก่อนเริ่ม Benchmark และใช้เงื่อนไขเดิมทั้ง Before และ After:

- Commit SHA และรุ่นของ Frontend, Lambda และ Schema/Migrations
- AWS Region, RDS instance class, Lambda Memory/timeout และ Environment ที่ใช้
- จำนวนแถวใน `companies` และแหล่งที่มาของ Dataset (ห้ามใช้ข้อมูลคนละชุดในการเปรียบเทียบ)
- สถานะ Index และผล `ANALYZE` ของตารางก่อนทดสอบ
- Client, เครือข่าย, จำนวนผู้ใช้พร้อมกัน และรูปแบบการยิง Request
- แยกผล Cold Start กับ Warm Invocation; ห้ามนำมารวมกันโดยไม่ระบุ

รันแต่ละ Scenario อย่างน้อย 30 ครั้งหลัง Warm-up และรายงาน Median (p50), p95 และจำนวนครั้งที่ทดสอบ ใช้ workload และ concurrency เดียวกันทั้งสองรอบ หากจำลองโหลดพร้อมกัน ให้บันทึกอัตรา Request และจำนวน Concurrent Users ให้ชัดเจน

### 5.2 วิธีเก็บหลักฐาน

- **End-to-End:** วัดเวลาตั้งแต่เริ่ม Request จนได้รับ Response/แสดงรายการ โดยใช้เครื่องมือเดียวกันใน Before และ After
- **API/Lambda:** เก็บ API latency, Lambda Duration, Billed Duration, Memory และ Error/Throttle จาก CloudWatch หรือเครื่องมือที่ใช้จริง
- **Database:** บันทึก Query latency และตรวจ Query Plan ด้วย `EXPLAIN (ANALYZE, BUFFERS)` สำหรับ Query ตัวแทนที่มีข้อมูลเดียวกับ Benchmark
- **Data transfer:** บันทึก Response size และจำนวนแถวที่ส่งคืน
- **Cost:** คำนวณค่าใช้จ่ายตาม Rate ปัจจุบันของ Region/Service และบันทึกวันที่/แหล่งอ้างอิงราคา หากเข้าถึง Billing ได้ ให้แยก Actual Cost ออกจาก Estimate

`EXPLAIN ANALYZE` จะรัน Query จริง ให้ทดสอบเฉพาะ Query อ่านข้อมูลบน Environment ที่ปลอดภัยและ workload ที่ควบคุมได้ หลีกเลี่ยงการรันโหลด Benchmark บน Environment ที่มีผู้ใช้จริงโดยไม่ได้รับอนุญาต

### 5.3 ตารางผล Before–After

กรอกตัวเลขจากการทดสอบจริง พร้อมหน่วยและแนบหลักฐาน ห้ามแทนค่าที่ไม่ทราบด้วยค่าประมาณโดยไม่ระบุว่าเป็น Estimate

| Scenario / Metric | Before | After | เปลี่ยนแปลง | หลักฐาน |
|---|---:|---:|---:|---|
| เปิดหน้า – API Requests ต่อการเปิดหน้า | ยังไม่วัด | ยังไม่วัด | — | รอเก็บผล |
| เปิดหน้า – End-to-End p50 / p95 (ms) | ยังไม่วัด | ยังไม่วัด | — | รอเก็บผล |
| ค้นหาชื่อ – End-to-End p50 / p95 (ms) | ยังไม่วัด | ยังไม่วัด | — | รอเก็บผล |
| กรองจังหวัด – End-to-End p50 / p95 (ms) | ยังไม่วัด | ยังไม่วัด | — | รอเก็บผล |
| Query – Execution time / shared buffers | ยังไม่วัด | ยังไม่วัด | — | รอเก็บผล |
| Response – rows / bytes | ยังไม่วัด | ยังไม่วัด | — | รอเก็บผล |
| Workload ที่กำหนด – Estimated Cost | ยังไม่วัด | ยังไม่วัด | — | ระบุ Rate และวิธีคำนวณ |
| Workload ที่กำหนด – Actual Cost (ถ้ามี Billing Data) | ยังไม่วัด | ยังไม่วัด | — | ระบุช่วงเวลาและแหล่งข้อมูล |

เก็บหลักฐานใน `docs/evidence/` โดยระบุวันเวลา, Commit SHA, Environment, Dataset, คำสั่ง/เครื่องมือ และผลดิบหรือ Screenshot ที่อ่านตรวจสอบได้

ผลจริงของตารางนี้กรอกใน [รายงานผล V6](../evidence/v6-05-results/report.md) และ [สารบัญหลักฐาน V6](../evidence/v6-05-results/evidence-index.md) (V6-05, #242)

## 6. Bottleneck & Optimization Approach

เริ่มจาก Baseline และผล Query Plan ก่อนเลือกแนวทาง หากพบว่าการเปิดหน้ามีการดึงข้อมูลชุดเดียวกันซ้ำ ให้ประเมินการลด Request โดยยังคงรายการและจำนวนสถานประกอบการในตัวกรองให้ถูกต้อง หากพบว่า Query หรือการส่งผลลัพธ์เป็นคอขวด ให้เลือกแนวทางแก้เฉพาะจุดตามหลักฐาน

แนวทางที่อาจพิจารณา (ไม่ใช่ข้อสรุปหรือสิ่งที่ยืนยันว่าจะทำ):

- ลดการโหลดข้อมูลซ้ำในช่วงเปิดหน้า หากพิสูจน์ได้ว่าใช้ข้อมูลเดียวกันและไม่มีผลต่อความถูกต้อง
- ปรับ Query หรือ Index หาก Query Plan และข้อมูลจริงแสดงว่าจำเป็น โดยวัดทั้ง Read Performance, พื้นที่ Index และผลต่อการเขียน/โหลดข้อมูล
- จำกัดหรือแบ่งผลลัพธ์เป็นหน้าเฉพาะเมื่อกำหนดพฤติกรรม API/UI ได้โดยไม่ทำให้ผู้ใช้สูญเสียผลลัพธ์ที่คาดหวัง
- ทบทวน Lambda Memory หรือ Database Sizing เฉพาะเมื่อ Benchmark แสดงผลด้าน Latency/Cost ชัดเจนและอยู่ในข้อจำกัด Environment

หลังปรับปรุง ให้รัน Regression Tests และทดสอบว่า Search, Province Filter, เงื่อนไขร่วม, ลำดับผลลัพธ์ และรูปแบบ Response ยังคงถูกต้อง

## 7. Cost Considerations

- **Lambda:** ประเมินจากจำนวน Invocation, Memory ที่กำหนด และ Billed Duration; การลด Request หรือ Duration อาจลดค่าใช้จ่ายส่วนนี้ตาม Rate ของ Region
- **API Gateway:** ประเมินจากจำนวน Request; ลด Request ซ้ำอาจลดค่าใช้จ่ายตามปริมาณใช้งาน
- **RDS:** ค่า Instance เป็นค่าใช้จ่ายต่อเนื่องตามเวลาที่เปิดใช้งาน ไม่ได้ลดลงโดยอัตโนมัติเมื่อ Query เร็วขึ้น การลดขนาด Instance ต้องตรวจสอบ Capacity และผล Performance ก่อน
- **Data transfer:** ประเมินจำนวนข้อมูลที่ส่งจริงและเส้นทาง Network ตาม Billing Metric ที่เกี่ยวข้อง
- **Index:** Index ที่เพิ่มอาจเพิ่ม Storage และภาระการเขียน/บำรุงรักษา จึงต้องเทียบประโยชน์ด้าน Query กับต้นทุนและผลต่อการนำเข้าข้อมูล
- **การรายงาน:** แสดงทั้ง Cost ต่อ workload ที่กำหนดและข้อสมมติในการคำนวณ อย่าเทียบยอด AWS ทั้งบัญชีหากมี Resource ของทีมอื่นหรือช่วงเวลาไม่เท่ากัน

ต้นทุนจริงอาจวัดแยกจาก Environment ที่แชร์หรือมีข้อจำกัดของ AWS Academy ควรระบุสิ่งที่วัดได้ สิ่งที่เป็น Estimate และข้อจำกัดให้ชัดเจน

## 8. Planned Work

| Work Item (Draft) | งาน | ผลลัพธ์ที่คาดหวัง | Dependencies |
|---|---|---|---|
| V6-01 | กำหนด Workload และเก็บ Baseline | Scenario, Dataset/จำนวนแถว, Environment และผล Before ที่ทำซ้ำได้ | — |
| V6-02 | วิเคราะห์ Bottleneck | API/Lambda/SQL timing, Query Plan และสาเหตุที่มีหลักฐานรองรับ | V6-01 |
| V6-03 | ปรับปรุง Critical Path | การเปลี่ยนแปลงขนาดเล็กที่แก้ Bottleneck พร้อม Regression Tests | V6-02 |
| V6-04 | Benchmark After และประเมิน Cost | ผล Before–After ภายใต้เงื่อนไขเดียวกัน และ Cost Estimate/Actual ตามข้อมูลที่มี | V6-03 |
| V6-05 | สรุปผลและแนบ Evidence | วิธีทำซ้ำ, ผลวัด, ข้อจำกัด และสรุปว่าเป้าหมายสำเร็จหรือไม่ | V6-04 |

**Dependency Flow:** V6-01 → V6-02 → V6-03 → V6-04 → V6-05

## 9. Constraints & Considerations

- ใช้ Environment และ AWS Academy ตามสิทธิ์ที่ได้รับ; ห้ามสร้างโหลดหรือ Resource ที่ทำให้เกิดค่าใช้จ่ายโดยไม่จำเป็น
- ปกป้อง Credentials, Secrets และข้อมูลส่วนบุคคลใน Logs และ Evidence
- ทดสอบด้วยข้อมูลและ workload ที่ทำซ้ำได้ และบันทึกการเปลี่ยนแปลงของ Environment ทุกครั้ง
- แยก Cold Start/Warm Invocation และ Local/Cloud timings เพื่อไม่ให้เปรียบเทียบคนละบริบท
- ระบุข้อจำกัดของข้อมูล Billing และค่าใช้จ่ายของ Resource ที่แชร์
- การเพิ่ม Index, Pagination, Cache หรือเปลี่ยน Sizing ต้องรักษาความถูกต้องของข้อมูลและได้รับการยืนยันจากผลวัด

## 10. Completion Criteria

- มีการเลือกและอธิบาย Critical Path พร้อม Scenario ทดสอบอย่างน้อยหนึ่งส่วน
- มี Baseline และ After ที่ใช้ Commit, Dataset, Environment และ Workload เทียบเคียงกันได้
- ระบุ Bottleneck จากผลวัดหรือ Query Plan ไม่ใช่จากการคาดเดา
- มีการปรับปรุงระบบอย่างน้อยหนึ่งจุดและ Regression Tests ผ่านสำหรับพฤติกรรมที่เกี่ยวข้อง
- มีตาราง Before–After ที่กรอกค่าจริง หน่วย จำนวนรอบ และหลักฐานอ้างอิงครบถ้วน
- วิเคราะห์ผลกระทบด้าน Cost พร้อมระบุ Rate, สูตร/สมมติฐาน และแยก Estimate กับ Actual
- บันทึกข้อจำกัดหรือผลที่ไม่ดีขึ้นอย่างตรงไปตรงมา และอธิบายการตัดสินใจที่ตามมา

## 11. References

- [หน้า Employers](../../src/pages/Employers.tsx)
- [Company API Client](../../src/data/companyApi.ts)
- [Lambda: List Companies](../../infra/lambda/companies/listCompanies.mjs)
- [PostgreSQL Schema](../../infra/schema.sql)
- [Lambda Database Pool](../../infra/lambda/companies/db.mjs)
- [Terraform RDS Configuration](../../infra/terraform/rds.tf)
- [V5 Overview](./V5-overview.md)
