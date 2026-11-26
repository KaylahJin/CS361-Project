# V6-02: รายงานวิเคราะห์ Bottleneck ของเส้นทาง Employers (#239)

> **Issue:** [#239 — `[V6-02] Identify Employers Critical Path Bottleneck`](https://github.com/KaylahJin/CS361-Project/issues/239)  
> **Milestone:** V6 – Performance & Cost  
> **Critical Path:** เปิดหน้า Employers → โหลดรายการสถานประกอบการ → ค้นหาชื่อ (`search`) / กรองจังหวัด (`province`) → แสดงผล (`GET /companies`)  
> **หลักฐานอ้างอิง:**
> - Baseline V6-01 (PR [#245](https://github.com/KaylahJin/CS361-Project/pull/245), [#246](https://github.com/KaylahJin/CS361-Project/pull/246), [#247](https://github.com/KaylahJin/CS361-Project/pull/247), branch `test/v6-01-docs`, commit `0ae16a57576f065b89f016bc179bd366b019110f`)
> - Query Plan (`EXPLAIN (ANALYZE, BUFFERS)`): [`explain-analyze-outputs.txt`](./explain-analyze-outputs.txt)
> - CloudWatch Lambda REPORT Logs: V6-01 §10 (406 invocations บน `us-east-1`) และ [`../v6-03/cloudwatch-lambda-report.txt`](../v6-03/cloudwatch-lambda-report.txt)

---

## 1. ข้อมูลตั้งต้นและสภาพแวดล้อมที่ใช้วิเคราะห์

| รายการ | Baseline V6-01 (PR #247) | RDS Query Plan Check (V6-02) |
|---|---|---|
| **Dataset** | `companies` จำนวน **103 แถว** (`infra/migrate/source/v1-companies.json`) | `companies` จำนวน **103 แถว** (`infra/seed.sql`, หลัง `ANALYZE companies`) |
| **AWS Region / DB** | `us-east-1`, RDS PostgreSQL 16.15 (`db.t4g.micro`) | `ap-southeast-2`, RDS PostgreSQL 16.15 (`db.t3.micro`, `en_US.UTF-8`) |
| **Lambda Runtime** | Node.js 22.x, 128 MB RAM, 10s timeout | เชื่อมต่อด้วย role `coop_app` ตาม `infra/lambda/companies/listCompanies.mjs` |
| **Client / Network** | Microsoft Edge 157 (Playwright 1.65.0), Mobile Hotspot, Concurrency = 1 | `psql` 16.15 (เฉพาะ query อ่านข้อมูล + `ROLLBACK` สำหรับ diagnostic) |

---

## 2. การวิเคราะห์ Request Count และ End-to-End Latency (จาก V6-01)

ข้อมูลจาก `measurement-run-summary.csv` (30 รอบ/Scenario) และ `measurement-raw-results.csv` (150 API responses) ใน V6-01 แสดงค่าจริงดังนี้:

| Scenario | Input | API Req / รอบ | จำนวน Responses | Rows / Resp | Bytes / Resp | API Duration p50 / p95 (ms) | E2E Duration p50 / p95 (ms) |
|---|---|---:|---:|---:|---:|---:|---:|
| **S1: เปิดหน้า** | ไม่มีตัวกรอง | **2** | **60** | 103 | **55,160** | 497.70 / 576.56 | **3,488.14 / 4,101.07** |
| **S2: ค้นหาชื่อ** | `search=CDG` | 1 | 30 | 1 | 475 | 422.05 / 451.29 | 851.25 / 880.72 |
| **S3: กรองจังหวัด** | `province=กรุงเทพมหานคร` | 1 | 30 | 79 | 43,264 | 484.01 / 583.78 | 686.49 / 813.47 |
| **S4: ค้นหา + จังหวัด** | `CDG` + `กรุงเทพมหานคร` | 1 | 30 | 1 | 475 | 355.80 / 409.58 | 760.58 / 816.21 |

### ข้อเท็จจริงที่พบจาก Baseline V6-01
1. **การเปิดหน้า (S1) ยิง `GET /companies` ซ้ำ 2 ครั้งทุกครั้งที่เปิดหน้า:** 30 รอบสร้าง 60 API responses ขนาดเท่ากัน (`55,160 bytes × 2 = 110,320 bytes` ต่อการเปิดหน้า 1 ครั้ง หรือ `3,309,600 bytes` รวม 30 รอบ)
2. **S1 ช้ากว่า S2–S4 อย่างมากในระดับ E2E:** API response แต่ละครั้งของ S1 (`p50 = 497.70 ms`) ต่างจาก S3 (`484.01 ms`) เพียง `13.69 ms` แต่ E2E ของ S1 (`p50 = 3,488.14 ms`, `max = 5,870.32 ms`) สูงกว่า S3 (`686.49 ms`) ถึง **~5.1 เท่า** (ส่วนต่าง ~2,800 ms เกิดขึ้นฝั่ง Frontend/Browser นอกเหนือจาก API response ของ `GET /companies`)
3. **S2 มีค่า debounce 300 ms รวมอยู่ใน E2E:** เมื่อหัก `300 ms` debounce ออก เวลาหลังยิง API จนถึงแสดงผลของ S2 (`851.25 − 300 ≈ 551 ms`) ใกล้เคียงกับ API response (`422.05 ms`)
4. **หมายเหตุความต่อเนื่องของชุดข้อมูล V6-01:** รายงาน V6-01 (§9) ระบุว่า S3 รอบที่ 28–30 มีช่องว่างเวลาราว 18 นาทีจากรอบก่อนหน้า ซึ่งกระทบต่อการแปลผลหางบน (`p95 = 813.47 ms`, `max = 923.25 ms`)

---

## 3. การวิเคราะห์ Frontend: สาเหตุของ Request ซ้ำและ E2E Latency ใน S1

จากการอ่านโค้ด `src/pages/Employers.tsx` ณ baseline commit `0ae16a57` พบสาเหตุโดยตรง 3 ประการ:

1. **ตัวกรองจังหวัดและตัวนับจำนวนทำให้เกิด Request ซ้ำตอน Mount (`2 → 1`):**
   - `useEffect` ตัวที่ 1 (สร้าง `provinceOptions` และ `totalCount`) เรียก `getCompanies()` แบบไม่ส่งพารามิเตอร์
   - `useEffect` ตัวที่ 2 (โหลดการ์ดบริษัทเริ่มต้น) เรียก `getCompanies({ search: undefined, province: undefined })` ซึ่งสร้าง URL `/companies` เหมือนกันทุกประการ
   - **ผลกระทบ:** ยิง `GET /companies` พร้อมกัน 2 ครั้ง (ยืนยันจาก timestamp ใน `measurement-raw-results.csv` เช่น Run 2 ห่างกัน `4 ms`, Run 6 ห่างกัน `2 ms`) ได้ข้อมูล 103 บริษัทซ้ำ 2 รอบ, เพิ่มงาน API Gateway + Lambda + PostgreSQL เป็น 2 เท่า และกระตุ้นให้ Lambda ต้องเปิด execution environment คู่ขนานเมื่อคำขอมาชนกัน
2. **โหลดโลโก้บริษัททั้งหมดแบบ Eager ตอนเปิดหน้า (103 การ์ด):**
   - `EmployerCard` render `<img src="/images/logos/..." />` โดยไม่กำหนด `loading="lazy"` ทำให้เมื่อ S1 แสดงครบ 103 การ์ด เบราว์เซอร์ต้องขอไฟล์รูปโลโก้ทั้งหมดพร้อมกัน (จากหลักฐานใน V6-03 พบโลโก้จริง 99 ไฟล์) จึงเกิดการแย่ง connection และทำให้การโหลดหน้า S1 ใช้เวลา E2E ถึง `p50 = 3,488.14 ms`
3. **ไม่มีการนำผลชุดเต็มมาใช้ซ้ำเมื่อล้างตัวกรอง:**
   - เมื่อผู้ใช้พิมพ์ค้นหาหรือเลือกจังหวัดแล้วล้างตัวกรองกลับเป็นค่าว่าง โค้ดเดิมจะเรียก `GET /companies` ใหม่อีก 1 ครั้ง (`55,160 bytes`) ทั้งที่เพิ่งโหลดข้อมูล 103 บริษัทชุดเต็มมาแล้ว

---

## 4. การวิเคราะห์ AWS Lambda & CloudWatch Logs

จากรายงาน V6-01 §10 (CloudWatch Logs ของ `/aws/lambda/aa-companies-lambda`, ช่วง 2026-11-13 21:53–22:33 UTC, จำนวน **406 REPORT records**) และหลักฐานก่อนปรับปรุงของ V6-03 (`docs/evidence/v6-03/cloudwatch-lambda-report.txt` บน `/aws/lambda/coop-portal-companies-lambda`):

| กลุ่ม Invocation | จำนวน (n) | Duration (ms) | Billed Duration (ms) | Init Duration (ms) | Max Memory Used |
|---|---:|---|---|---|---:|
| **V6-01: มี `Init Duration` (Cold Start)** | 2 | `815.60 / 854.71` | `1,249 / 1,258` | `393.95 / 441.94` | (ไม่ระบุในตาราง) |
| **V6-01: ไม่มี `Init Duration`** | 404 | p50 `120.86`, p95 `244.51`, min `3.52`, max `1,060.16` | p50 `120.98`, p95 `245.00` | — | — |
| **V6-03: Cold Start Stream (`581026...`)** | 1 | `787.26` | `1,299` | `511.02` | `103 MB / 128 MB` |
| **V6-03: Warm Calls (`4fae05...`, `271160...`)** | 23 | `4.03 – 155.12` | `5 – 156` | — | `101–103 MB / 128 MB` |

### ข้อสังเกตจากข้อมูล Lambda (แยกข้อเท็จจริงจากสมมติฐาน)
- **ข้อเท็จจริง:**
  - Lambda ใช้หน่วยความจำสูงสุด `101–103 MB` จากที่กำหนด `128 MB` จึงยังไม่ถึงขีดจำกัด Memory และไม่พบรายงาน OOM / Throttle ในหลักฐานที่เก็บมา
  - เมื่อเกิด Cold Start ค่า `Init Duration` อยู่ที่ ~`394–511 ms` ทำให้ `Billed Duration` พุ่งเป็น `1,190–1,299 ms`
  - ใน Warm invocations พบการกระจายเวลาเป็นสองช่วงชัดเจน: ช่วงเร็ว `4–11 ms` (สอดคล้องกับ S2/S4 ที่คืน 1 แถวและไม่เจอภาระ Sort ใหญ่) และช่วง `83–155 ms` (สอดคล้องกับ S1/S3 ที่คืน 103/79 แถว)
- **ข้อจำกัด / สิ่งที่ยังไม่สรุปตายตัว (Hypothesis / Limitation):**
  - V6-01 §10 ไม่สามารถจับคู่ `RequestId` จาก CloudWatch เข้ากับแถวใน CSV ของ Playwright แบบ 1-ต่อ-1 ได้ จึงเทียบระดับการกระจาย (distribution) เท่านั้น
  - ส่วนต่างระหว่าง API duration บนเบราว์เซอร์ (`p50 = 356–498 ms`) กับ Lambda Duration (`p50 = 121 ms`, min `3.5 ms`) ประมาณ `250–380 ms` เป็น Network RTT ข้ามอินเทอร์เน็ตไปยัง `us-east-1` + TLS + API Gateway overhead

---

## 5. การวิเคราะห์ SQL Queries และ PostgreSQL Query Plans (`EXPLAIN ANALYZE, BUFFERS`)

จาก `infra/lambda/companies/listCompanies.mjs` ทุก Scenario ใช้ SQL โครงสร้างเดียวกัน:

```sql
SELECT company_id, name, short_name, province, location, description,
       logo_filename, url, created_at
FROM companies
-- [เงื่อนไขตามพารามิเตอร์]:
-- S1: (ไม่มี WHERE)
-- S2: WHERE (name ILIKE $1 OR short_name ILIKE $1)
-- S3: WHERE province = $1
-- S4: WHERE (name ILIKE $1 OR short_name ILIKE $1) AND province = $2
ORDER BY name;
```

### ผลรัน `EXPLAIN (ANALYZE, BUFFERS)` จริงบน RDS PostgreSQL 16.15 (103 แถว, หลัง `ANALYZE`)

| Scenario | Plan ที่ Planner เลือก | Scan Time (ms) | Total Exec Time (ms) | Rows (Scan → Return) | Buffers (`shared hit`) | Sort Memory |
|---|---|---:|---:|---|---:|---:|
| **S1** (ไม่มี filter) | `Sort` → `Seq Scan` | 0.018 | **78.599** | 103 → 103 | 9 (scan 6) | 67 kB |
| **S2** (`search=CDG`) | `Sort` → `Seq Scan` | 0.207 | **0.254** | 103 → 1 (removed 102) | 6 | 25 kB |
| **S2b** (`search=จำกัด`) | `Sort` → `Seq Scan` | 0.202 | **62.322** | 103 → 89 (removed 14) | 6 | 62 kB |
| **S3** (`province=กรุงเทพมหานคร`) | `Sort` → `Seq Scan` | 0.033 | **58.732** | 103 → 79 (removed 24) | 6 | 58 kB |
| **S3b** (`province=ปทุมธานี`) | `Sort` → `Seq Scan` | 0.031 | **3.809** | 103 → 9 (removed 94) | 6 | 28 kB |
| **S4** (`CDG` + `กรุงเทพมหานคร`) | `Sort` → `Seq Scan` | 0.169 | **0.191** | 103 → 1 (removed 102) | 6 | 25 kB |

*(ผลทดสอบ Diagnostic ด้วย `SET LOCAL enable_seqscan = off` ใน Transaction ที่ `ROLLBACK` ยืนยันว่า Index ทั้ง `idx_companies_name`, `idx_companies_short_name`, และ `idx_companies_province` มีอยู่จริงและใช้งานได้: S2 ใช้ `BitmapOr` ของ GIN indexes เหลือ execution `0.143 ms`, S3b ใช้ `Bitmap Index Scan on idx_companies_province` ได้ `3.968 ms`)*

### ข้อค้นพบสำคัญระดับ Database
1. **Index มีอยู่ครบแต่ Planner ไม่เลือกใช้ใน Dataset ปัจจุบัน (และถูกต้องแล้ว):**
   - ตาราง `companies` มีขนาดเพียง **48 kB (6 heap pages)** ขณะที่ Index 4 ตัวรวม **296 kB**
   - Planner ประเมินว่า `Seq Scan` (`cost=0.00..7.03–7.80`) ถูกกว่า `Bitmap Index Scan + Bitmap Heap Scan` (`cost=21.37..25.38` สำหรับ GIN และ `10.32` สำหรับ B-tree `province`)
   - การใช้ `Seq Scan` อ่านเพียง `6 shared buffer hits` ใช้เวลาจริงแค่ **`0.018 – 0.207 ms`** ไม่ใช่คอขวดของระบบ และ **การเพิ่ม Index ใหม่จะไม่ช่วยลด latency บนข้อมูล 103 แถว**
2. **เวลาส่วนใหญ่ใน PostgreSQL (~58–79 ms) มาจาก `Sort Key: name` ด้วย Collation `en_US.UTF-8`:**
   - เมื่อคืนข้อมูลน้อย (S2/S4 = 1 แถว) เวลา Execute ทั้งหมดเพียง `0.19–0.25 ms`
   - เมื่อคืนข้อมูลมาก (S3 = 79 แถว, S2b = 89 แถว, S1 = 103 แถว) เวลา **99.9% ของ DB Execution** อยู่ที่ขั้นตอน `Sort` (`58.7 ms`, `62.3 ms`, `78.6 ms`) เนื่องจากฐานข้อมูลใช้ `datcollate = en_US.UTF-8` (`glibc strcoll`) เรียงสตริงภาษาไทยจำนวนมาก ซึ่งอธิบายช่วงเวลา `83–155 ms` ที่พบใน CloudWatch Warm Lambda ได้สอดคล้องกัน

---

## 6. สรุป Root Cause (เรียงตามผลกระทบที่วัดได้)

| ลำดับ | Bottleneck | หลักฐานยืนยัน | สัดส่วนผลกระทบ |
|---:|---|---|---|
| **1** | **Frontend โหลดโลโก้ 99 รูปแบบ Eager + Render 103 การ์ดใน S1** | S1 E2E p50 (`3,488 ms`) สูงกว่า S3 (`686 ms`) ทั้งที่ API ต่างกันเพียง `14 ms` | **สูงสุด (~2.5–3.0 วินาที ใน E2E ของ S1)** |
| **2** | **Frontend ยิง `GET /companies` ซ้ำ 2 ครั้งตอนเปิดหน้า + ไม่แคชตอนล้าง Filter** | V6-01 CSV ยืนยัน S1 = 60 responses / 30 runs (`55,160 bytes × 2`); V6-03 CloudWatch ยืนยันยิงคู่ขนานกระตุ้น Cold Start (`1,190 ms`) | **สูง (API requests -50%, Bytes -50% ใน S1 และลด Cold Start คู่ขนาน)** |
| **3** | **Network RTT ข้ามภูมิภาค + Cold Start ฝั่ง Lambda** | API duration p50 (`356–498 ms`) เทียบกับ Lambda duration p50 (`121 ms`); Cold Start `Init Duration` `394–511 ms` | **ปานกลาง (~250–380 ms/req + Cold Start spike)** |
| **4** | **PostgreSQL `Sort Key: name` บน Thai UTF-8 Collation (`en_US.UTF-8`)** | `EXPLAIN (ANALYZE, BUFFERS)`: S1 `Seq Scan` `0.018 ms` vs `Sort` `78.57 ms` | **รอง (~58–79 ms เฉพาะคำขอที่คืน 79–103 แถว)** |
| **ไม่เป็นปัญหา** | **Database Table Scan / Missing Index** | `Seq Scan` ใช้ `0.018–0.207 ms` (6 pages); Index ทั้ง 4 ตัวมีครบและใช้งานได้จริง | **ไม่ใช่ Bottleneck** |

---

## 7. ข้อเสนอการปรับปรุงและผลข้างเคียงที่ต้องตรวจสอบ (Prioritized Proposals)

1. **Priority 1 — รวม Request ตอนเปิดหน้า (2 → 1) + Client-side Unfiltered Cache + Lazy-load Logos (`Frontend-only`)**
   - **สิ่งที่ทำ:** ยุบ `useEffect` สองตัวใน `src/pages/Employers.tsx` ให้เรียก `getCompanies()` ครั้งเดียวตอน mount แล้วคำนวณ `totalCount` กับ `provinceOptions` จากผลชุดเดียวกัน; เก็บรายการ 103 บริษัทใน ref เพื่อคืนค่าเมื่อล้างตัวกรองกลับเป็นว่าง; ใส่ `loading="lazy"` ให้โลโก้ตั้งแต่การ์ดลำดับที่ 9 เป็นต้นไป และเพิ่ม `AbortSignal` สำหรับคำขอที่ถูกพิมพ์ทับ
   - **ผลที่คาดหวัง:** ลด API Request ของ S1 ลง `50%` (2 → 1), ลด bytes บนสายลง `55,160 bytes/การเปิดหน้า`, ลดโอกาสเกิด Concurrent Lambda Cold Start, และลด E2E S1 ได้ทันที (แนวทางนี้ถูกนำไปทำแล้วใน PR [#251](https://github.com/KaylahJin/CS361-Project/pull/251) ของ V6-03)
   - **ผลข้างเคียงที่ต้องตรวจ:** หากข้อมูลบริษัทใน DB เปลี่ยนระหว่างเปิดหน้าเดิม แคชในหน้าจะไม่อัปเดตจนกว่าจะรีเฟรช (ยอมรับได้สำหรับ Registry ที่แก้ไขเป็นรอบภาคการศึกษา) และต้องตรวจว่า Error state รีเซ็ตแคชให้ Retry ได้จริง
2. **Priority 2 (ทางเลือกเพิ่มเติม) — ลดต้นทุน `Sort Key: name` ใน DB เฉพาะเมื่อข้อมูลโตขึ้น**
   - **สิ่งที่ทำ:** ในอนาคตหาก `companies` เพิ่มเป็นหลักพัน–หมื่นแถว สามารถพิจารณา `ORDER BY name COLLATE "C"` หรือ Pre-computed sort / Pagination (`LIMIT`/`OFFSET` หรือ Keyset) หรือเพิ่ม Lambda Memory เฉพาะเมื่อ Benchmark ยืนยัน
   - **ผลข้างเคียงที่ต้องตรวจ:** การเปลี่ยน Collation เป็น `"C"` เปลี่ยนลำดับตัวอักษรภาษาไทย (เช่น สระนำหน้าพยัญชนะ) ซึ่งอาจไม่ตรงความคาดหวังผู้ใช้ จึง**ยังไม่แนะนำให้เปลี่ยน** บนชุดข้อมูล 103 แถว (ที่ `78 ms` ไม่ใช่คอขวดหลักเมื่อเทียบกับ Frontend/Network) และไม่แนะนำให้เพิ่ม Index หรือปรับเพิ่ม RDS/Lambda Sizing โดยไม่มีผลวัดรองรับ
