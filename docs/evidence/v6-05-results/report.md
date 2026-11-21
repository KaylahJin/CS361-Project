# V6 Performance & Cost – ผลลัพธ์ (V6-05, #242)

เอกสารนี้รวมผล V6 ตามโครงตาราง §5.3 ของ [V6 Overview](../../overview/V6-overview.md) และชี้ไปยังไฟล์ผลของแต่ละ issue แทนการคัดลอกซ้ำ สารบัญไฟล์หลักฐานทั้งหมดอยู่ใน [evidence-index.md](./evidence-index.md)

> **สถานะเอกสาร:** โครงร่าง (draft) – ยังไม่มีตัวเลขจริงในเอกสารนี้
> ช่องที่ขึ้นว่า "รอผลจาก V6-0X (#issue)" คือยังไม่มีข้อมูลที่ merge แล้ว **ห้ามเติมค่าประมาณแทนค่าวัดจริง** ถ้าเป็น Estimate ต้องเขียนกำกับว่า Estimate
>
> ตัวเลข Baseline ของ V6-01 อยู่ใน PR [#245](https://github.com/KaylahJin/CS361-Project/pull/245) → [#246](https://github.com/KaylahJin/CS361-Project/pull/246) → [#247](https://github.com/KaylahJin/CS361-Project/pull/247) ซึ่ง**ยังรอรีวิว** จึงยังไม่นำมาใส่ และลิงก์ไปไฟล์ของ V6-01 ในเอกสารนี้จะเปิดได้หลัง PR ชุดนั้น merge

คำศัพท์ (Critical Path, Scenario, Baseline, Before/After, Estimate/Actual, Cold Start/Warm) ใช้ตาม V6 Overview ที่ทีมเขียนเอง ส่วนรหัส Scenario S1–S4 มาจาก procedure ของ V6-01

## 1. สรุปผล

| ข้อ | สรุป | หลักฐาน |
|---|---|---|
| Bottleneck ที่ยืนยัน | รอผลจาก V6-02 (#239) | §5 |
| สิ่งที่ปรับปรุง | รอผลจาก V6-03 (#240) | §6 |
| ผล Performance (ดีขึ้น / ไม่เปลี่ยน / แย่ลง) | รอผลจาก V6-04 (#241) | §4 |
| ผล Cost | รอผลจาก V6-04 (#241) | §7 |
| ผ่าน Completion Criteria (Overview §10) หรือไม่ | รอข้อสรุปจาก Reviewer (@Pawit-Billamas) | §10 |

## 2. เงื่อนไขการทดสอบ (Before vs After)

ใส่ค่าทั้งสองรอบ ถ้าต่างกันให้เขียนความต่างไว้ในคอลัมน์สุดท้าย (Overview §5.1, AC ของ #241)

| รายการ | Before (V6-01) | After (V6-04) | ต่างกันหรือไม่ / ผลต่อการแปลผล |
|---|---|---|---|
| Commit SHA (Frontend + Lambda + Schema) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |
| Commit ของการปรับปรุง | – | รอผลจาก V6-03 (#240) | |
| Environment (Cloud/Dev หรือ Local) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |
| AWS Region | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |
| RDS engine / instance class | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |
| Lambda runtime / Memory / timeout | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |
| Dataset: แหล่งที่มา / จำนวนแถว `companies` | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |
| สถานะ Index และ `ANALYZE` | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |
| Client / Browser / เครื่องมือวัด | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |
| เครือข่าย | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |
| Concurrency / รูปแบบการยิง Request | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |
| Warm-up / จำนวนรอบวัดต่อ Scenario | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |
| วันเวลาที่วัด (ระบุ timezone) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |

## 3. Scenario และ Input คงที่

ใช้ Scenario และ Input ชุดเดียวกับ V6-01 รายละเอียดอยู่ใน procedure ของ V6-01 §4 (`../v6-01-employers-baseline/procedure.md`, รอ merge)

| รหัส | Scenario (Overview §4.1) | Input คงที่ |
|---|---|---|
| S1 | เปิดหน้า | ตาม procedure V6-01 (#238) |
| S2 | ค้นหาชื่อ | ตาม procedure V6-01 (#238) |
| S3 | กรองจังหวัด | ตาม procedure V6-01 (#238) |
| S4 | ค้นหาและกรองร่วมกัน | ตาม procedure V6-01 (#238) |

## 4. ผล Before–After

หน่วย: เวลาเป็น ms, ขนาดเป็น bytes เปลี่ยนแปลง = (After − Before) / Before × 100% ใส่เครื่องหมาย − เมื่อลดลง ใส่ผลที่แย่ลงด้วย ไม่เลือกเฉพาะผลที่ดี

### 4.1 Scenario E2E และ API Response Duration

| Scenario / Metric | n (Before / After) | Before p50 / p95 | After p50 / p95 | เปลี่ยนแปลง p50 / p95 | หลักฐาน |
|---|---|---|---|---|---|
| S1 – Scenario E2E (ms) | รอ V6-01 merge / รอ V6-04 (#241) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | – | E-01, E-07 |
| S1 – API Response Duration (ms) | รอ V6-01 merge / รอ V6-04 (#241) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | – | E-01, E-07 |
| S2 – Scenario E2E (ms) | รอ V6-01 merge / รอ V6-04 (#241) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | – | E-01, E-07 |
| S2 – API Response Duration (ms) | รอ V6-01 merge / รอ V6-04 (#241) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | – | E-01, E-07 |
| S3 – Scenario E2E (ms) | รอ V6-01 merge / รอ V6-04 (#241) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | – | E-01, E-07 |
| S3 – API Response Duration (ms) | รอ V6-01 merge / รอ V6-04 (#241) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | – | E-01, E-07 |
| S4 – Scenario E2E (ms) | รอ V6-01 merge / รอ V6-04 (#241) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | – | E-01, E-07 |
| S4 – API Response Duration (ms) | รอ V6-01 merge / รอ V6-04 (#241) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | – | E-01, E-07 |

API Response Duration ที่วัดจาก Browser รวมเวลาเครือข่ายและ Backend จึงไม่ใช่ Lambda Duration (ตามข้อจำกัดที่ report ของ V6-01 ระบุไว้)

### 4.2 Request, ข้อมูลที่ส่ง และ Backend

| Metric | Before | After | เปลี่ยนแปลง | หลักฐาน |
|---|---|---|---|---|
| S1 – API Requests ต่อการเปิดหน้า (ครั้ง) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | – | E-01, E-07 |
| Response rows ต่อ Scenario (แถว) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | – | E-01, E-07 |
| Response bytes ต่อ Scenario (bytes) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | – | E-01, E-07 |
| Query – Execution time (ms) | รอผลจาก V6-02 (#239) | รอผลจาก V6-03/V6-04 (#240/#241) | – | E-04, E-06 |
| Query – shared buffers (hit / read) | รอผลจาก V6-02 (#239) | รอผลจาก V6-03/V6-04 (#240/#241) | – | E-04, E-06 |
| Index ที่ Planner ใช้ | รอผลจาก V6-02 (#239) | รอผลจาก V6-03 (#240) | – | E-04, E-06 |
| Lambda Duration / Billed Duration p50 / p95 (ms) | รอผลจาก V6-02 (#239) | รอผลจาก V6-04 (#241) | – | E-05, E-08 |
| Lambda Max Memory Used (MB) | รอผลจาก V6-02 (#239) | รอผลจาก V6-04 (#241) | – | E-05, E-08 |
| Error / Throttle (ครั้ง) | รอผลจาก V6-02 (#239) | รอผลจาก V6-04 (#241) | – | E-05, E-08 |
| Response ถูกต้อง (HTTP status, จำนวนแถวตรงที่คาด) | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | – | E-01, E-07 |

### 4.3 Cold Start และ Warm Invocation

แยกผลสองแบบนี้ ห้ามรวมกันโดยไม่ระบุ (Overview §5.1)

| | Before | After | หลักฐาน |
|---|---|---|---|
| วิธีแยก Cold/Warm | รอ V6-01 merge (#238) | รอผลจาก V6-04 (#241) | |
| Cold Start (จำนวนครั้ง, Init Duration ms) | รอผลจาก V6-01/V6-02 (#238/#239) | รอผลจาก V6-04 (#241) | |
| Warm (Duration p50 / p95 ms) | รอผลจาก V6-01/V6-02 (#238/#239) | รอผลจาก V6-04 (#241) | |

## 5. Bottleneck (V6-02, #239)

| ข้อ | เนื้อหา |
|---|---|
| จุดที่เกิด (Frontend / API / Lambda / SQL / ข้อมูลที่ส่ง) | รอผลจาก V6-02 (#239) |
| ข้อเท็จจริงจากผลวัด (อ้าง Metric + Scenario) | รอผลจาก V6-02 (#239) |
| หลักฐานจาก Query Plan | รอผลจาก V6-02 (#239) |
| Request หรือข้อมูลซ้ำตอนโหลดตัวกรองจังหวัดหรือไม่ | รอผลจาก V6-02 (#239) |
| สมมติฐานที่ยังไม่ยืนยัน (แยกจากข้อเท็จจริง) | รอผลจาก V6-02 (#239) |

## 6. การปรับปรุง (V6-03, #240)

| ข้อ | เนื้อหา |
|---|---|
| แนวทางที่เลือก และเหตุผลจากผล V6-02 | รอผลจาก V6-03 (#240) |
| ไฟล์ / ชั้นที่เปลี่ยน | รอผลจาก V6-03 (#240) |
| PR และ Commit SHA | รอผลจาก V6-03 (#240) |
| Index ที่เพิ่ม/เปลี่ยน + ผลต่อ Storage และ Write/Seed | รอผลจาก V6-03 (#240) (ถ้าไม่มี ให้เขียนว่าไม่มี) |
| Regression Tests (Search, Province, Search+Province, ลำดับ, Bare JSON Array) | รอผลจาก V6-03 (#240) |
| วิธี Deploy และ Rollback | รอผลจาก V6-03 (#240) |

## 7. Cost (V6-04, #241)

### 7.1 Workload ที่ใช้คิด

| ข้อ | ค่า |
|---|---|
| นิยาม 1 workload (Scenario × จำนวนรอบ หรือจำนวนผู้ใช้ต่อช่วงเวลา) | รอผลจาก V6-04 (#241) |
| Invocation / API Request ต่อ workload (Before / After) | รอผลจาก V6-04 (#241) |
| ช่วงเวลาที่ใช้คิด RDS (ชั่วโมง) | รอผลจาก V6-04 (#241) |

### 7.2 Rate และแหล่งอ้างอิง

| Service | Rate | หน่วย | แหล่งราคา + วันที่ตรวจ | Region |
|---|---|---|---|---|
| Lambda – Request | รอผลจาก V6-04 (#241) | ต่อ 1M requests | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) |
| Lambda – Compute | รอผลจาก V6-04 (#241) | ต่อ GB-second | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) |
| API Gateway (HTTP API) | รอผลจาก V6-04 (#241) | ต่อ 1M requests | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) |
| RDS instance | รอผลจาก V6-04 (#241) | ต่อชั่วโมง | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) |
| Data Transfer out | รอผลจาก V6-04 (#241) | ต่อ GB | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) |

### 7.3 สูตรและสมมติฐาน

```text
Lambda GB-s        = (Memory MB ÷ 1024) × (Billed Duration ms ÷ 1000) × Invocations
Lambda cost        = Invocations × Rate_request + Lambda GB-s × Rate_GB-s
API Gateway cost   = API Requests × Rate_api
Data Transfer cost = (Σ Response bytes ÷ 1024³) × Rate_GB-out
RDS cost (คงที่)    = ชั่วโมงที่เปิด instance × Rate_RDS-hour   ← ไม่ลดลงเพราะ Query เร็วขึ้น
```

- สมมติฐาน (เช่น Free Tier, AWS Academy credit, การปัดเศษ Billed Duration): รอผลจาก V6-04 (#241)
- RDS เป็นต้นทุนคงที่ตามเวลาเปิดใช้งาน ห้ามสรุปว่าลดลงถ้าไม่มี Billing หรือ Configuration ยืนยัน (AC ของ #241)

### 7.4 Estimate กับ Actual

| | Before | After | เปลี่ยนแปลง | ประเภท | หลักฐาน |
|---|---|---|---|---|---|
| Lambda (USD / workload) | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) | – | Estimate | E-09 |
| API Gateway (USD / workload) | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) | – | Estimate | E-09 |
| Data Transfer (USD / workload) | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) | – | Estimate | E-09 |
| RDS (USD / ช่วงเวลา) | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) | – | Estimate (คงที่) | E-09 |
| ยอดจริงจาก Billing (ช่วงวันที่ ...) | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) | – | Actual | E-10 |

ถ้า AWS Academy ไม่ให้ดู Billing หรือ Resource ใช้ร่วมกับงานอื่น ให้เขียนว่า "ไม่มี Actual" พร้อมเหตุผล แทนการเว้นว่าง

## 8. ข้อจำกัดและความต่างของ Environment

| ข้อจำกัด | ผลต่อการแปลผล | ที่มา |
|---|---|---|
| รอสรุปจาก report ของ V6-01 §10 (ยังรอรีวิว) | | V6-01 (#238) |
| รอผลจาก V6-02 (#239) | | V6-02 (#239) |
| รอผลจาก V6-04 (#241) | | V6-04 (#241) |

## 9. Known Issues

| ปัญหา | ผลกระทบ | สถานะ / issue ติดตาม |
|---|---|---|
| AC ของ #238 ข้อ "แยกผล Cold Start/Warm" ยังไม่ติ๊ก และ report ของ V6-01 (รอรีวิว) ระบุว่ายังไม่ได้แยก | §4.3 อาจไม่มีค่า Before | รอข้อสรุปใน #238 |
| รอผลจาก V6-02–V6-04 (#239–#241) | | |

## 10. Completion Criteria (Overview §10)

Reviewer ติ๊กพร้อมอธิบาย 2–3 ประโยค

- [ ] อธิบาย Critical Path และ Scenario ทดสอบ (§3)
- [ ] Baseline และ After ใช้ Commit, Dataset, Environment, Workload เทียบกันได้ (§2)
- [ ] Bottleneck มาจากผลวัดหรือ Query Plan (§5)
- [ ] ปรับปรุงอย่างน้อยหนึ่งจุดและ Regression Tests ผ่าน (§6)
- [ ] ตาราง Before–After มีค่าจริง หน่วย จำนวนรอบ และหลักฐานครบ (§4)
- [ ] Cost มี Rate, สูตร/สมมติฐาน และแยก Estimate กับ Actual (§7)
- [ ] เปิดเผยข้อจำกัดและผลที่ไม่ดีขึ้นตรงไปตรงมา (§8, §9)

## 11. วิธีทำซ้ำ

ทำตาม procedure ของ V6-01 (`../v6-01-employers-baseline/procedure.md`, รอ merge) ด้วย script ใน `scripts/benchmark/` (มาจาก PR #245) ส่วนขั้นตอนรอบ After และ Query Plan ให้ลิงก์จาก V6-04 (#241) และ V6-02 (#239) เมื่อมีไฟล์แล้ว ถ้าทำซ้ำบางขั้นไม่ได้ (เช่น สิทธิ์ AWS Academy) ให้ระบุไว้ใน §8
