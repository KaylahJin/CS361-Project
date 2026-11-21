# V6 Evidence Index (V6-05, #242)

สารบัญไฟล์หลักฐานของ V6 ใช้คู่กับ [report.md](./report.md) แต่ละรายการลิงก์ไปที่ไฟล์ต้นทางของ issue นั้น ไม่คัดลอกไฟล์มาซ้ำ

สถานะ: **merged** = อยู่บน `main` แล้ว · **รอรีวิว** = มีใน PR แต่ยังไม่ merge · **รอผล** = ยังไม่มีไฟล์

## 1. รายการหลักฐาน

| รหัส | หลักฐาน | ไฟล์ / ลิงก์ | ที่มา | สถานะ |
|---|---|---|---|---|
| E-01 | ผล Baseline (p50/p95, rows, bytes) และผลดิบรอบวัด | [`report.md`](../v6-01-employers-baseline/report.md), [`measurement-raw-results.csv`](../v6-01-employers-baseline/measurement-raw-results.csv), [`measurement-run-summary.csv`](../v6-01-employers-baseline/measurement-run-summary.csv) | V6-01 #238, PR #246 #247 | รอรีวิว |
| E-02 | วิธีวัด, Input คงที่, Environment, Dataset, Commit SHA | [`procedure.md`](../v6-01-employers-baseline/procedure.md) | V6-01 #238, PR #247 | รอรีวิว |
| E-03 | ผล Warm-up (แยกจากรอบวัด) และ script วัดผล | [`warmup-raw-results.csv`](../v6-01-employers-baseline/warmup-raw-results.csv), [`warmup-run-summary.csv`](../v6-01-employers-baseline/warmup-run-summary.csv), [`scripts/benchmark/`](../../../scripts/benchmark/) | V6-01 #238, PR #245 #246 | รอรีวิว |
| E-04 | Query Plan ก่อนปรับ (`EXPLAIN (ANALYZE, BUFFERS)`) | รอผลจาก V6-02 (#239) | V6-02 #239 | รอผล |
| E-05 | Lambda/API timing ก่อนปรับ และสรุป Bottleneck | รอผลจาก V6-02 (#239) | V6-02 #239 | รอผล |
| E-06 | PR/Commit การปรับปรุง, ผล Regression Tests, Query Plan หรือ Request count หลังปรับ, Rollback | รอผลจาก V6-03 (#240) | V6-03 #240 | รอผล |
| E-07 | ผล Benchmark After และผลดิบ (Workload เดียวกับ E-01) | รอผลจาก V6-04 (#241) | V6-04 #241 | รอผล |
| E-08 | Lambda Duration/Billed Duration, Error/Throttle, Cold/Warm หลังปรับ | รอผลจาก V6-04 (#241) | V6-04 #241 | รอผล |
| E-09 | Cost worksheet: Rate, แหล่งราคา + วันที่, สูตร, Workload | รอผลจาก V6-04 (#241) | V6-04 #241 | รอผล |
| E-10 | Billing evidence ที่ปิดข้อมูลบัญชีแล้ว (ถ้ามี) | รอผลจาก V6-04 (#241) | V6-04 #241 | รอผล |
| E-11 | รายงานผล V6 และข้อสรุปของ Reviewer | [`report.md`](./report.md), PR ของ #242 | V6-05 #242 | ร่าง |

ลิงก์ E-01–E-03 จะเปิดได้หลัง PR #245 → #246 → #247 merge ถ้า V6-01 เปลี่ยนชื่อไฟล์ระหว่างรีวิว ให้แก้ลิงก์ในตารางนี้

## 2. Metadata ที่หลักฐานแต่ละชิ้นต้องมี

ตาม Task ของ #242 และ Overview §5.3 ไฟล์ผลแต่ละชุดต้องระบุสิ่งต่อไปนี้ (ในไฟล์เองหรือใน report ที่อ้างถึง)

| รหัส | วันเวลา (timezone) | Commit SHA | Environment | Dataset / จำนวนแถว | เครื่องมือ + เวอร์ชัน | จำนวนรอบ |
|---|---|---|---|---|---|---|
| E-01–E-03 | รอ V6-01 merge (#238) | รอ V6-01 merge (#238) | รอ V6-01 merge (#238) | รอ V6-01 merge (#238) | รอ V6-01 merge (#238) | รอ V6-01 merge (#238) |
| E-04–E-05 | รอผลจาก V6-02 (#239) | รอผลจาก V6-02 (#239) | รอผลจาก V6-02 (#239) | รอผลจาก V6-02 (#239) | รอผลจาก V6-02 (#239) | – |
| E-06 | รอผลจาก V6-03 (#240) | รอผลจาก V6-03 (#240) | รอผลจาก V6-03 (#240) | รอผลจาก V6-03 (#240) | รอผลจาก V6-03 (#240) | – |
| E-07–E-10 | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) | รอผลจาก V6-04 (#241) |

## 3. Checklist ตรวจ Secret และข้อมูลส่วนบุคคล

ตรวจทุกไฟล์ในตาราง §1 ก่อนขอรีวิว ติ๊กเมื่อตรวจไฟล์ที่ merge แล้วครบทุกชิ้น

- [ ] ไม่มี AWS Access Key / Secret Key / Session Token (`AKIA…`, `ASIA…`)
- [ ] ไม่มี JWT, Cognito token หรือ header `Authorization` ใน log, HAR หรือ screenshot
- [ ] ไม่มีรหัสผ่านบัญชีทดสอบ, ค่าจาก `.env`, `terraform.tfstate`, `terraform.tfvars`
- [ ] ไม่มีรหัสผ่าน DB หรือ connection string ที่มี credential
- [ ] Billing screenshot ปิด Account ID, ชื่อบัญชี, อีเมล และข้อมูลการชำระเงินแล้ว
- [ ] ไม่มีชื่อ, อีเมล, รหัสนักศึกษา หรือเบอร์โทรของบุคคลจริง (ข้อมูลสถานประกอบการที่เป็นข้อมูลสาธารณะใช้ได้)
- [ ] Query Plan และ log ไม่มีค่าพารามิเตอร์ที่เป็นข้อมูลส่วนบุคคล
- [ ] URL ของ S3 bucket ที่มี Account ID ใช้ placeholder แบบ `<bucket>` ตามที่ `139-00-evidence.md` ทำไว้ (หรือทีมตัดสินว่ายอมให้มีได้)

คำสั่งช่วยค้น (ผลที่เจอต้องดูด้วยตาทุกบรรทัด คำสั่งนี้ไม่ได้รับประกันว่าไม่มี secret):

```bash
git grep -nIE "AKIA|ASIA[A-Z0-9]{12}|Bearer |eyJ[A-Za-z0-9_-]{15,}|password|secret|@[a-z0-9.-]+\.(com|ac\.th)|[0-9]{12}" -- docs/evidence/v6-* scripts/benchmark
```

### ผลตรวจเบื้องต้น (14 พ.ย. 2569)

ค้นด้วยคำสั่งข้างบนบน branch `test/v6-01-docs` (PR #247 ซึ่งรวม #245 #246) ไม่พบ key, token หรือรหัสผ่าน พบเพียง:

- URL ของ S3 website ที่มี AWS Account ID ใน `scripts/benchmark/check-employers.mjs` และ `run-employers-benchmark.mjs`
- URL ของ API Gateway ใน `procedure.md`

ทั้งสองอย่างไม่ใช่ credential แต่ยังไม่มีบน `main` ส่งให้ Reviewer ของ #238 ตัดสินว่าจะเปลี่ยนเป็น placeholder หรือไม่ เอกสารนี้ไม่ได้แก้ไฟล์ของ V6-01
