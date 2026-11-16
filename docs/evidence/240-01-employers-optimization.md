# V6-03 Evidence: Optimize Employers Critical Path (#240)

## 1. ขอบเขตและหลักฐานตั้งต้น (Scope & Evidence Basis)

- **Issue:** [#240 `[V6-03] Optimize Employers Critical Path`](https://github.com/KaylahJin/CS361-Project/issues/240)
- **Pull Request:** [#251](https://github.com/KaylahJin/CS361-Project/pull/251) (Branch: `perf/240-optimize-employers-critical-path`, Base Code Commit: `8b5253d`)
- **เหตุผลและหลักฐานที่ใช้อ้างอิง (ณ วันที่ 16 พ.ย. 2569):**
  - แม้ `V6-02` (#239) ยังไม่ปิด PR แต่ใน `docs/overview/V6-overview.md` (§2.1, §6) และรายงาน Baseline จาก PR #247 ยืนยันตรงกันแล้วว่าใน **Scenario S1 (เปิดหน้า Employers)** หน้าเว็บเรียก `GET /companies` แบบไม่มีเงื่อนไขซ้ำ **2 Requests** ทุกครั้งที่เปิดหน้า (`55,160 bytes × 2 = 110,320 bytes`) และโหลดโลโก้บริษัททั้งหมดพร้อมกันแบบ eager
  - จากการตรวจ CloudWatch Logs (`/aws/lambda/coop-portal-companies-lambda`) ระหว่างทดสอบชุด Before พบว่าการส่ง `GET /companies` ซ้ำพร้อมกัน 2 ครั้งตอนเปิดหน้ายังกระตุ้นให้ AWS Lambda เปิด Execution Environment ใหม่คู่ขนาน (`4fae05b4...`, Cold Start `Init Duration: 435.67 ms`, `Billed Duration: 1,190 ms`) เทียบกับ Warm Invocation ที่ใช้เวลาเพียง `4–155 ms` (รายละเอียดใน [`v6-03/cloudwatch-lambda-report.txt`](./v6-03/cloudwatch-lambda-report.txt))
- **ขอบเขตการแก้ (Frontend-only — ไม่เพิ่ม Paid Resource และไม่เปลี่ยน API Contract / SQL Index):**
  - ยังคง API Response เป็น **Bare JSON Array** และเรียงตาม `ORDER BY name` เหมือนเดิมทุกประการ

---

## 2. จุดที่ปรับปรุง (Optimizations Implemented)

| # | จุดที่แก้ | ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|---|---|
| 1 | **ตัด Duplicate Request ตอนเปิดหน้า (2 → 1)** | [`src/pages/Employers.tsx`](../../src/pages/Employers.tsx) | รวม `useEffect` สองตัวที่เคยเรียก `getCompanies()` ซ้ำตอน mount ให้ใช้ `fetchUnfilteredOnce()` เพียงครั้งเดียว แล้วคำนวณ `totalCount`, `provinceOptions` และรายการการ์ด `companies` จากผลลัพธ์ชุดเดียวกัน |
| 2 | **แคชรายการชุดเต็มเมื่อล้างตัวกรอง (1 → 0)** | [`src/pages/Employers.tsx`](../../src/pages/Employers.tsx) | เก็บรายการ 103 บริษัทชุดเริ่มต้นไว้ใน `unfilteredCompaniesRef` เพื่อคืนค่าทันทีเมื่อล้าง Search/Province กลับเป็นค่าว่าง (และรีเซ็ต ref ทันทีเมื่อเกิด error เพื่อให้ retry ได้) โดยยังคงเรียก API จริงสำหรับ Search, Province และ Search+Province |
| 3 | **ยกเลิกคำขอที่ตกรุ่น (Abort Stale Requests)** | [`src/data/companyApi.ts`](../../src/data/companyApi.ts), [`src/pages/Employers.tsx`](../../src/pages/Employers.tsx) | เพิ่มตัวเลือก `AbortSignal` ให้ `getCompanies(params, { signal })` และสั่ง `abort()` เมื่อผู้ใช้เปลี่ยนคำค้นหาหรือเปลี่ยนจังหวัดก่อนคำขอเดิมเสร็จ |
| 4 | **หน่วงโหลดโลโก้นอกหน้าจอ (Lazy-load Logos)** | [`src/pages/Employers.tsx`](../../src/pages/Employers.tsx) | ให้ 8 การ์ดแรกโหลดโลโก้แบบ `loading="eager"` และการ์ดที่เหลือตั้งแต่ลำดับที่ 9 ใช้ `loading="lazy"` + `decoding="async"` ลดการแย่ง connection ตอนเปิดหน้า |

---

## 3. ผลทดสอบเปรียบเทียบ Before vs After (Live AWS API + RDS)

ทดสอบบน Microsoft Edge Headless (`1440×900`, `Network.setCacheDisabled: true`, 1 warm-up + 5 measured runs/scenario) จาก `http://localhost:5173/#employers` เชื่อมต่อตรงกับ **Live AWS API Gateway (`https://kkp7n9zb0e.execute-api.us-east-1.amazonaws.com`) → Lambda (`coop-portal-companies-lambda`, 128 MB, Node.js 22.x) → RDS PostgreSQL 16.15 (`coop-portal-coop-db-dev`, `db.t4g.micro`, 103 companies)**

| Scenario | Metric | Before (`main` @ `3087a7a`) | After (`PR #251` @ `8b5253d`) | เปลี่ยนแปลง |
|---|---|---:|---:|---|
| **S1: เปิดหน้า Employers (103 rows)** | `GET /companies` Requests | **2 requests** | **1 request** | **-50.0% (ลดลงครึ่งหนึ่ง)** |
| **S1: เปิดหน้า Employers (103 rows)** | API Payload Size | **110,320 bytes** | **55,160 bytes** | **-50.0% (-55,160 bytes)** |
| **S1: เปิดหน้า Employers (103 rows)** | Logo Image Requests | **99 eager** | **8 eager (+lazy)** | **-91.9% (-91 requests)** |
| **S1: เปิดหน้า Employers (103 rows)** | E2E Duration p50 / p95 | 4,114.0 ms / 6,863.2 ms | **2,792.3 ms / 4,943.7 ms** | **p50 -32.1%, p95 -28.0%** |
| **S2: ค้นหา `CDG` (1 row)** | `GET /companies` Requests / Bytes | 1 / 475 bytes | **1 / 475 bytes** | คงเดิม (API filter ทำงานครบ) |
| **Clear: กดล้างคำค้นหา → 103 rows** | `GET /companies` Requests / Bytes | 1 / 55,160 bytes | **0 / 0 bytes** | **-100% (ใช้แคชทันที)** |
| **Clear: กดล้างคำค้นหา → 103 rows** | Logo Requests / E2E p95 | 94–99 / 10,743.3 ms | **8 / 1,364.4 ms** | **p95 -87.3%** |
| **S3: กรอง `กรุงเทพมหานคร` (79 rows)** | `GET /companies` Requests / Logo Reqs | 1 / 72 logos | **1 / 8 logos** | Logo **-88.9%**, p50 **-37.6%** (2,442 → 1,524 ms) |
| **S4: `CDG` + `กรุงเทพมหานคร` (1 row)** | `GET /companies` Requests / Bytes | 1 / 475 bytes | **1 / 475 bytes** | คงเดิม (ผลลัพธ์ถูกต้อง 1 แถว) |

### หมายเหตุและข้อจำกัดของผลวัด (Reporting Honesty)
- ชุดตัวเลข E2E Latency ข้างต้นเป็นผลทดสอบจาก 5 รอบต่อ Scenario ผ่านอินเทอร์เน็ตสาธารณะไปยัง `us-east-1` จึงมีค่าความผันผวนของ Network RTT ร่วมอยู่ด้วย (เช่นใน `S2` และ `S4` หลังปรับปรุงมี p50 อยู่ที่ 1,393.7 ms และ 1,274.5 ms จากความผันผวนของเครือข่ายเทียบกับ 930.0 ms และ 722.0 ms ในรอบ Before แม้ว่าจะยิง API 1 ครั้งเท่ากันและได้ HTTP 200 / 475 bytes เหมือนกันทุกประการ)
- ส่วนตัวชี้วัดเชิงโครงสร้าง (**Request Count: S1 `2 → 1`, Clear `1 → 0`, API Bytes `-50%`, Initial Logo Requests `99 → 8`**) เกิดขึ้น 100% ทุกรอบอย่างคงที่

---

## 4. หลักฐานทั้งหมดที่แนบไว้ใน Repository

- **Raw A/B Benchmark JSON (Before & After 5 runs):** [`v6-03/before-after-ab-results.json`](./v6-03/before-after-ab-results.json)
- **AWS CloudWatch Lambda REPORT Logs:** [`v6-03/cloudwatch-lambda-report.txt`](./v6-03/cloudwatch-lambda-report.txt)
- **Automated Regression Test, ESLint & Build Logs:** [`v6-03/test-build-output.txt`](./v6-03/test-build-output.txt)
  - `npx vitest run src/pages/Employers.test.tsx infra/lambda/companies/listCompanies.test.mjs` → **10/10 passed** (ครอบคลุม initial 1-request, totalCount/provinceOptions, lazy logos, Search, Province, Combined, Cache restore, `AbortSignal`, และ Error recovery)
  - `npx eslint src/pages/Employers.tsx src/pages/Employers.test.tsx src/data/companyApi.ts` → **0 errors, 0 warnings**
  - `npm run build` (`tsc -b && vite build`) → **ผ่านใน 651 ms**
- **UI Screenshots (Zero Visual Regression):**
  - Before (Desktop 1440×900): [`v6-03/before-desktop.png`](./v6-03/before-desktop.png)
  - After (Desktop 1440×900): [`v6-03/after-desktop.png`](./v6-03/after-desktop.png)
  - After (Mobile 390×844): [`v6-03/after-mobile.png`](./v6-03/after-mobile.png)

---

## 5. วิธี Deploy, ข้อสังเกตสำหรับ V6-04 และวิธี Rollback

### Deploy (Frontend-only)
```bash
npm run env:sync
npm run web:deploy
```

### ข้อสังเกตสำหรับ V6-04 (`#241` Benchmark After)
- เดิม `scripts/benchmark/run-employers-benchmark.mjs` (ใน PR #245) ตั้งค่าให้ `S1` และ `resetPage` รอ **2 responses** ของ `/companies`
- หลัง merge PR #251 หน้า `Employers` จะเรียก `GET /companies` เพียง **1 request** ต่อการเปิดหน้า ดังนั้นในรอบวัดผล After (`V6-04`) ให้ตั้งจำนวน response ที่คาดหวังของ `S1` / `resetPage` เป็น **1 request**
- สำหรับ `S2` (Search), `S3` (Province) และ `S4` (Search + Province) ยังคงส่ง `GET /companies` รอบละ 1 request ตามเดิม

### Rollback
สามารถย้อนกลับเฉพาะ Frontend ได้ทันทีโดยไม่กระทบ Database Schema หรือ Lambda:
```bash
git revert <merge-commit-sha>
npm run web:deploy
```
