# V6-03 Evidence: Optimize Employers Critical Path (#240)

## 1. ขอบเขตและหลักฐานตั้งต้น (Scope & Evidence Basis)

- **Issue:** [#240 `[V6-03] Optimize Employers Critical Path`](https://github.com/KaylahJin/CS361-Project/issues/240)
- **สถานะต้นน้ำ ณ วันที่ทำรายการ (16 พ.ย. 2569):**
  - `V6-02` (#239) ยังไม่ถูก merge เข้า `main` และ `V6-01` (#238 / PR #245–#247) ยังอยู่ระหว่างการแก้ review
  - อย่างไรก็ตาม `docs/overview/V6-overview.md` (§2.1, §6) และรายงาน Baseline จาก PR #247 ยืนยันตรงกันแล้วว่าใน **Scenario S1 (เปิดหน้า Employers)** ระบบยิง `GET /companies` แบบไม่มีเงื่อนไขซ้ำ **2 Requests** ทุกครั้งที่เปิดหน้า (`55,160 bytes × 2 = 110,320 bytes`, `API p50 = 497.70 ms`, `E2E p50 = 3,488.14 ms`, `p95 = 4,101.07 ms`) และโหลดโลโก้บริษัททั้ง 103 รายการแบบ eager พร้อมกัน
- **ขอบเขตการแก้ (เปลี่ยนเฉพาะ Frontend — ไม่เพิ่ม Paid Resource และไม่เปลี่ยน Sizing/Contract API):**
  - ไม่แก้ไข Lambda Response Format (`Bare JSON Array`) ลำดับข้อมูล (`ORDER BY name`) หรือ SQL Indexes

## 2. จุดที่ปรับปรุง (Optimizations Implemented)

| จุดที่แก้ | ไฟล์ | สิ่งที่เปลี่ยน | ผลที่คาดหวัง |
|---|---|---|---|
| **1. รวมคำขอโหลดข้อมูลตอนเปิดหน้า (Deduplicate Initial Fetch)** | [Employers.tsx](../../src/pages/Employers.tsx) | รวม `useEffect` สองตัวที่เคยเรียก `getCompanies()` ซ้ำกันตอน mount ให้ใช้ `fetchUnfilteredOnce()` ตัวเดียวเพื่อดึงข้อมูลชุดเริ่มต้นมาสร้างทั้ง `totalCount`, `provinceOptions` และรายการ `companies` | ลด `GET /companies` ตอนเปิดหน้า (S1) จาก **2 → 1 Request (-50%)**, ลด Lambda invocations/SQL queries และ Payload ตอนเปิดหน้าลงครึ่งหนึ่ง (~110 KB → ~55 KB) |
| **2. แคชข้อมูลชุดเต็มในหน่วยความจำเมื่อล้างตัวกรอง** | [Employers.tsx](../../src/pages/Employers.tsx) | เก็บผลลัพธ์ชุดเริ่มต้นไว้ใน `unfilteredCompaniesRef` เพื่อนำมาแสดงทันทีเมื่อผู้ใช้ล้าง Search/Province กลับเป็นค่าว่าง (และล้าง promise ref เมื่อ error เพื่อให้ retry ได้) | ลดคำขอซ้ำเมื่อผู้ใช้กดล้างคำค้นหาหรือเลือก "ทุกจังหวัด" กลับ (Search/Province/Combined ยังเรียก API จริงตามเดิม) |
| **3. ยกเลิกคำขอที่ตกรุ่น (Abort Stale Filtered Requests)** | [companyApi.ts](../../src/data/companyApi.ts), [Employers.tsx](../../src/pages/Employers.tsx) | รองรับ `AbortSignal` ใน `getCompanies(params, { signal })` และสั่ง `abort()` เมื่อคำค้นหาหรือจังหวัดเปลี่ยนก่อนคำขอเดิมเสร็จ | ลดคำขอค้างและป้องกันการอัปเดต UI ทับซ้อนเมื่อผู้ใช้เปลี่ยนตัวกรองเร็วๆ |
| **4. หน่วงโหลดโลโก้ที่อยู่นอกหน้าจอ (Lazy-load Offscreen Logos)** | [Employers.tsx](../../src/pages/Employers.tsx) | กำหนดให้การ์ด 8 อันดับแรกโหลดรูป `loading="eager"` ส่วนที่เหลือใช้ `loading="lazy"` และ `decoding="async"` ทั้งหมด | ลดจำนวนการแย่ง connection บน S3 static HTTP/1.1 ตอนเปิดหน้า จาก ~103 รูปพร้อมกันเหลือ ~8 รูปแรก |

## 3. การตรวจสอบ Contract & Regression Tests

### Automated Checks (รันหลังแก้ไขล่าสุดเมื่อ 16 พ.ย. 2569)
1. **Unit & Regression Tests:**
   ```bash
   npx vitest run src/pages/Employers.test.tsx infra/lambda/companies/listCompanies.test.mjs
   ```
   - `src/pages/Employers.test.tsx`: **6/6 passed** (ตรวจการยิง 1 Request ตอน mount, `totalCount`, `provinceOptions`, `loading="eager"`/`"lazy"`, Search debounce, Province Filter, Search+Province, Cache restore on clear, `AbortSignal`, และ Error recovery)
   - `infra/lambda/companies/listCompanies.test.mjs`: **4/4 passed** (ยืนยัน API Response เป็น Bare JSON Array และ query parameters คงเดิม)
2. **ESLint (ไฟล์ที่แก้ไข/เพิ่ม):**
   ```bash
   npx eslint src/pages/Employers.tsx src/pages/Employers.test.tsx src/data/companyApi.ts
   ```
   - **0 errors, 0 warnings**
3. **TypeScript & Production Build:**
   ```bash
   npm run build
   ```
   - `tsc -b && vite build` ผ่านเรียบร้อย (`dist/assets/index-D9LEMa4l.js` built in 602 ms)

> หมายเหตุ: ไม่ได้รัน Playwright Benchmark กับ Cloud/Dev Environment จริงในขั้นตอนนี้เนื่องจาก AWS Academy session token หมดอายุ และเป็นส่วนงานวัดผล After ของ `V6-04` (#241)

## 4. วิธี Deploy, ทดสอบ After (สำหรับ V6-04) และ Rollback

### วิธี Deploy (Frontend-only)
```bash
npm run env:sync
npm run web:deploy
```

### ข้อสังเกตสำหรับ V6-04 (Benchmark After)
- เดิม `scripts/benchmark/run-employers-benchmark.mjs` (ใน PR #245) ตั้งค่าให้ `S1` และ `resetPage` รอ **2 responses** ของ `/companies` ต่อการโหลดหน้า 1 ครั้ง
- หลังการปรับปรุงนี้ หน้า `Employers` จะเรียก `GET /companies` เพียง **1 ครั้ง** ต่อการเปิดหน้า ดังนั้นในการรัน Benchmark รอบ After (`V6-04`) ให้ปรับจำนวน response ที่คาดหวังของ `S1` / `resetPage` เป็น **1 request**
- สำหรับ `S2` (Search), `S3` (Province) และ `S4` (Search + Province) ยังคงส่งคำขอ `GET /companies` รอบละ 1 request ตามเดิม

### วิธี Rollback
หากพบปัญหาหลัง Merge สามารถย้อนกลับได้ทันทีโดยไม่กระทบ Database Schema หรือ Lambda:
```bash
git revert <merge-commit-sha>
npm run web:deploy
```
