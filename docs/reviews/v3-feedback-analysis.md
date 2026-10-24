# ผลวิเคราะห์ Feedback V3 และแผนปรับปรุง

> Issue: #125 · ผู้วิเคราะห์: @Pawit-Billamas · ผู้ตรวจ: @SunanthidaPhaengbao
> ตรวจกับโค้ดบน `main` ที่ commit `15758ad` · Role และ Workflow เป้าหมายอยู่ใน [`v3-roles-workflow-target.md`](v3-roles-workflow-target.md)

**อ่านรหัส:** F = ปัญหา · D = เรื่องที่ทีมต้องตัดสินใจ · P = ปัญหาหลักที่จะสร้างเป็น Issue · S01–S05 = ผู้สมัครจำลองในเอกสาร Self-test
**แหล่ง:** ST = Self-test ในคาบ · อจ = สิ่งที่อาจารย์ให้แก้ · AU = ตัวอย่างจากรายงานตรวจระบบใน #125 · CR = ตรวจโค้ดเอง · GH = สถิติ GitHub
**สถานะ:** ✅ ยืนยันกับโค้ดแล้ว · 🔸 ยืนยันบางส่วน · ⏳ ยังไม่ได้ตรวจ
**ยังรอ:** ผลทดสอบเองของ Wit, Cross-team Review, รายงานตรวจระบบฉบับเต็ม, ไฟล์โจทย์ FR1–FR10

---

## 1. ปัญหาที่ตรวจแล้ว

| ID | ปัญหา | แหล่ง | สถานะ | สาเหตุ | กระทบ role | ระดับ | งาน |
|---|---|---|---|---|---|---|---|
| F01 | แนบไฟล์ Transcript ไม่ได้ | ST, อจ | ✅ | ยังไม่มีระบบ upload | Student, ผู้ตรวจ | สูง | P3 |
| F02 | Advisor อนุมัติแผนได้ แต่โจทย์ให้แค่รับรองความประพฤติ | ST | ✅ | `V3-01-workflow-permissions.md` §3 ให้ Advisor อนุมัติได้ | Advisor | สูง | P4 |
| F03 | ไม่มี role Coordinator และ Committee | ST | ✅ | ออกแบบ role ไม่ตรงโจทย์ (`authorize.mjs`) | Staff, Committee | สูง | P4 |
| F04 | ไม่มีสถานะ "เอกสารไม่ครบ" | ST | ✅ | ไม่มีขั้นตรวจเอกสาร | Staff | สูง | P4 |
| F05 | เกณฑ์ใช้ชุดเดียวทุกรอบ ไม่มีจำนวนรับ และ GPA เท่าเกณฑ์ยังผ่าน (S04 GPA 2.75 ควรตก) | ST, AU | ✅ | เกณฑ์เขียนตายในโค้ด ตาราง `coop_info` ไม่มีข้อมูลเกณฑ์ | Student, Staff | สูง | P5 |
| F06 | Eligible กับ Selected ไม่แยกกัน | ST | ✅ | กดอนุมัติครั้งเดียวจบ | ผู้ตรวจ | สูง | P4 |
| F07 | ล็อกอินจากหน้าแผนสหกิจแล้วเจอหน้าลงชื่อซ้ำ | AU | ✅ | หน้าแผนขอ token ก่อนระบบล็อกอินพร้อม | ทุก role | สูง | P2 |
| F08 | ข้อความยื่นไม่ผ่านไม่ตรงสาเหตุ: backend ส่ง 13 รหัส หน้าเว็บรู้จักแค่ 4 | AU | ✅ | ชื่อรหัส error หน้าเว็บกับ backend ไม่ตรงกัน | Student | กลาง | P2 |
| F09 | นักศึกษาเห็นฟอร์มผู้ตรวจ และทุก role เห็นแท็บนักศึกษา | AU, ST | ✅ | หน้าเว็บไม่รู้ role (backend ยังกันไว้) | Student | กลาง | P2 |
| F10 | แผนที่อนุมัติแล้ว สร้างแผนใหม่ในรอบเดิมได้ | AU | ✅ | กฎ 1 แผนต่อรอบไม่นับแผนที่อนุมัติแล้ว | Student | กลาง | P4 |
| F11 | ปุ่ม "ตรวจ" ในหน้ารายละเอียดไม่ทำงาน | AU | ✅ | หน้ารายละเอียดถูกแสดงแทนก่อน modal จะเปิด | Advisor, Staff | สูง | P2 |
| F12 | ความเห็นรอบก่อนค้างเมื่อนักศึกษายื่นใหม่ | AU | ✅ | ยื่นใหม่ไม่ล้างความเห็นเก่า | Student, ผู้ตรวจ | กลาง | P2 |
| F13 | ไม่มีประวัติการพิจารณา | AU | ✅ | `plan_reviews` บันทึกอย่างเดียว ไม่มี API อ่าน | ผู้ตรวจ, Student | กลาง | P2 |
| F14 | Admin ไม่มีหน้าจอ | AU | ✅ | ยังไม่ได้ทำ | Admin | ต่ำ | เลื่อน: ใช้ script จัดการบัญชีได้ ไม่กระทบ flow หลัก |
| F15 | ความปลอดภัย 9 ข้อ (สูง 4) + ข้อมูลติดต่อบุคคลใน `positions.json` (Audit S6) — รายละเอียดอยู่ในกลุ่ม | AU, CR | ✅ | – | ทุก role | สูง | P1 |
| F16 | ข้อมูลตำแหน่งงานมี 3 ชุด | AU | ✅ | ไฟล์ JSON สร้างจาก SQL อีกที | ทีม | ต่ำ | เลื่อน: ระบบจริงอ่านจาก DB อย่างเดียว |
| F17 | script สร้าง seed ลบข้อมูลที่เขียนมือ | AU | ✅ | script เขียนทับทั้งไฟล์ | ทีม | กลาง | P5 |
| F18 | seed สาธิตยื่นแผนไม่ได้ และ reset ข้อมูลทดสอบไม่ได้ | AU, ST | ✅ | ช่วงยื่นใน seed หมดตั้งแต่ปี 2025, แผนตัวอย่างไม่ผ่านเกณฑ์ | ทีม, Tester | สูง | P5 |
| F19 | `schema.sql` / `schema.dbml` / docs ไม่ตรงกัน | AU | ✅ | ไม่ได้อัปเดตหลัง migration | ทีม | กลาง | P5 |
| F20 | ตัวกรอง "ร่าง" นับได้ 0 เสมอ | AU | ✅ | หน้าเว็บใช้ `DRAFT` แต่ระบบใช้ `PREPARING` | ผู้ตรวจ | กลาง | P2 |
| F21 | constraint ของ `app_users` ขัดกัน | AU | ✅ | FK `SET NULL` ชนกับ CHECK | Admin | ต่ำ | P5 |
| F22 | migration V2→V3 ทำข้อมูลเสียความหมาย | AU | ✅ | แปลงสถานะแบบเหมา ไม่เก็บประวัติ | – | ต่ำ | ไม่แก้: migration รันไปแล้ว ย้อนข้อมูลเดิมไม่ได้ บันทึกไว้ในเอกสาร |
| F23 | import ช่องว่างใน CSV เขียนทับข้อมูลเดิมเป็น NULL | AU | 🔸 | อัปเดตทุกคอลัมน์โดยไม่เช็คค่าว่าง (กลไกต่างจากที่รายงานเขียน) | Staff | กลาง | P5 |
| F24 | `main` ไม่มี branch protection | AU | ✅ แก้แล้ว | มี ruleset `protect-main` ตั้งแต่ 22 ต.ค. (1 approve + CI 3 ตัว) | ทีม | – | ปิด |
| F25 | PR ไม่ได้ review: 17/35 PR (V3: 4/10) | AU, GH | ✅ | ก่อนมี ruleset ไม่ได้บังคับ | ทีม | สูง | แก้แล้ว: ruleset + บอท #127 |
| F26 | CI type-check ไม่ได้ตรวจไฟล์ไหนเลย และ workflow แจ้งเตือน 2 ตัวพังทุกรอบ | AU, CR | ✅ | `tsc --noEmit` กับ `files: []`, script ในไฟล์ yml เสีย | ทีม | กลาง | P1 |
| F27 | merge ทั้งที่ CI fail และ PR ใหญ่มาก (สูงสุด +6,828 บรรทัด) | AU, GH | ✅ | ไม่มีกติกา | ทีม | กลาง | แก้แล้ว: ruleset + บอท #127 (≤ 400 บรรทัด) |
| F28 | งานกระจุกช่วงก่อนส่ง: V3 มี commit 69% (100/144) ใน 5 วันสุดท้ายจาก 13 วัน | AU, GH | ✅ | ไม่มี checkpoint กลางรอบ | ทีม | กลาง | แก้ด้วยกติกา checkpoint #126 ข้อ 7 |
| F29 | ตำแหน่งผูกกับบริษัทที่ยังไม่ยืนยัน (Audit D4): 64 ตำแหน่งใช้รหัสบริษัทแบบ "ยังไม่ยืนยัน" และ 13 ตำแหน่งถูกระบุว่าต้องยืนยันก่อน | AU | 🔸 | script ใช้ `registry_candidate_codes[0]` แม้ยังไม่ยืนยัน | Public, Student | กลาง | เลื่อน: อยู่นอก flow แผนสหกิจของ V3 |

**เทียบกับ `V3-01-workflow-permissions.md`:** F02, F03, F06 ขัดกับเอกสารนี้โดยตรง (เอกสารให้ Advisor หรือ Staff อนุมัติได้เลย) จึงต้องแก้เอกสารพร้อม P4 · ข้ออื่นไม่ขัดกับเอกสาร (F09 backend ตรวจสิทธิ์ถูกแล้ว แค่หน้าเว็บยังไม่ซ่อนสิ่งที่ใช้ไม่ได้)

**เทียบรหัสรายงานตรวจระบบ:** S6 → F15 · D4 → F29 · ข้ออื่นรอไฟล์รายงานฉบับเต็ม 

---

## 2. เรื่องที่ทีมต้องตัดสินใจ

| ID | เรื่อง | ข้อเสนอ |
|---|---|---|
| D1 | Role | `STUDENT`, `ADVISOR` รับรองอย่างเดียว, `COORDINATOR` (เดิม `STAFF`) ตรวจเอกสารและคุณสมบัติ, `COMMITTEE` คัดเลือก, `ADMIN` จัดการบัญชี — ใช้ตามเอกสาร Self-test ของอาจารย์ซึ่งระบุไว้ชัดแล้ว |
| D2 | สถานะแผน | `PREPARING` → `SUBMITTED` → `ENDORSED` → `ELIGIBLE` → `SELECTED` / `NOT_SELECTED` และมี `RETURNED`, `NOT_ELIGIBLE` (คง `PREPARING` ตาม #126) |
| D3 | Advisor ไม่รับรอง | ส่งกลับให้แก้ พร้อมเหตุผล |
| D4 | ยื่นใหม่หลังส่งกลับ | Advisor ต้องรับรองใหม่ |
| D5 | คัดเลือก | Committee เลือกจากแผนที่ `ELIGIBLE` ไม่เกินจำนวนรับของรอบ |
| D6 | เกณฑ์ GPA | ตั้งแยกรายรอบใน DB, GPA > 2.80, กลุ่มวิชา ≥ 2.50 |
| D7 | วิชาบังคับได้ FAILED | นับในค่าเฉลี่ยเหมือนเดิม ไม่ตัดสิทธิ์ทันที — เอกสารอาจารย์ไม่ได้ระบุ ใช้ตามโค้ดเดิม ถ้ามีโอกาสจะถามอาจารย์ในคาบ |
| D8 | ไฟล์แนบ | Transcript เป็น PDF ไม่เกิน 5 MB, ยื่นได้แม้ไม่มีไฟล์ แล้ว Coordinator บันทึก `INCOMPLETE` ใน `plan_reviews` และแผนกลับเป็น `RETURNED` |
| D9 | ใครเห็นรายชื่อนักศึกษา | Coordinator ทั้งหมด, Advisor เฉพาะในที่ปรึกษา, Committee เฉพาะผู้สมัครที่ผ่านการตรวจ, Admin แค่ชื่อ + รหัส, Student ไม่เห็น |
| D10 | กติกาทีม | ใช้ตาม #126 (issue ≤ 6 ชม., PR ≤ 400 บรรทัด, Reviewer หมุน, Tester ต่อ issue หลัก) |

**ทำไมไม่ถามอาจารย์:** D1–D6, D8 มีคำตอบในเอกสาร Self-test ของอาจารย์แล้ว ส่วน D7 เอกสารไม่ได้ระบุ จึงใช้ตามโค้ดเดิมไปก่อน

---

## 3. แบ่งงาน

**ผู้ดูแลด้าน** (คนวางแผนตัดสินตาม #126): ภาพรวม @Pawit-Billamas · UI @SunanthidaPhaengbao · Backend @Tatdanai6609611964 · DB @KaylahJin · QA @ruvcandyfruit

| P | ปัญหาหลัก | ปัญหาที่รับ | Owner | Tester | sub-issue | เวลา |
|---|---|---|---|---|---|---|
| P1 | ระบบปลอดภัยและพร้อมติดตั้ง | F15, F26 + คู่มือ setup | @Tatdanai6609611964 | @KaylahJin | 4 | 13 ชม. |
| P2 | หน้าเว็บตาม role และบั๊กหน้าตรวจ | F07–F09, F11–F13, F20 | @Pawit-Billamas | @ruvcandyfruit | 4 | 14 ชม. |
| P3 | แนบไฟล์ในแผน | F01 | @ruvcandyfruit | @SunanthidaPhaengbao | 2 | 10 ชม. |
| P4 | ขั้นพิจารณาใหม่ | F02–F04, F06, F10 | @SunanthidaPhaengbao | @Pawit-Billamas | 3 | 15 ชม. |
| P5 | เกณฑ์และข้อมูลทดสอบ | F05, F17–F19, F21, F23 | @KaylahJin | @Tatdanai6609611964 | 3 | 14 ชม. |
| QA | ทดสอบรวม (แทน W7 เดิม) | Self-test 1–2 | @ruvcandyfruit | – | 1 | 3 ชม. |

**User story ↔ FR:** อยู่ในภาคผนวก ก · เลขที่รู้แล้ว: FR4 (ส่งกลับแก้ไข) และ FR5 (สถานะแผน) ใน P4 · ที่เหลือรอไฟล์โจทย์

**ลำดับ:** P1-①, P3-①, P4-①, P5-① ก่อน (เป็นงานที่ block คนอื่น ต้องมี draft PR ภายในวันที่ 2) → sub-issue ที่เหลือ → QA
**กำหนดส่ง:** milestone ปิด พ. 28 ต.ค. ใช้ปฏิทินข้อ 13 ของ #126 (D-2 หยุดเพิ่มฟีเจอร์ · D-1 หยุดแก้โค้ด)

| เมื่อไหร่ | ต้องเสร็จ |
|---|---|
| ส. 24 ต.ค. 23:59 | ยืนยันข้อตกลง แล้ว Wit สร้าง Issue ทันที |
| อา. 25 ต.ค. 12:00 | draft PR ของงานที่ block คนอื่น: P1-①, P3-①, P4-①, P5-① |
| อา. 25 ต.ค. 20:00 | PR ของงานกลุ่ม "ต้องเสร็จ" พร้อมให้รีวิว |
| จ. 26 ต.ค. 10:00 | รีวิวและ merge ครบ (รอบนี้รีวิวภายใน 12 ชม.) |
| จ. 26 ต.ค. (D-2) | หยุดเพิ่มฟีเจอร์ · QA นำทดสอบรวม Self-test 1–2 · บั๊กเปิดเป็น issue |
| อ. 27 ต.ค. 12:00 (D-1) | แก้บั๊กจากทดสอบรวมและ merge ครบ แล้วหยุดแก้โค้ด |
| อ. 27 ต.ค. | ทดสอบซ้ำ · คู่มือ setup (P1-④) · demo · evidence · ปิด issue |
| พ. 28 ต.ค. | ส่งงาน |

**ต้องเสร็จรอบนี้** (ใช้ใน Self-test 1–2 และความปลอดภัย): P1-①–④, P2-①–③, P3-①–②, P4-①–②, P5-①–②
**ทำถ้าทัน ไม่ทันย้ายรอบหน้า** (ข้อ 13): P2-④, P4-③, P5-③ · role `COMMITTEE` ยังเพิ่มใน P4-① ตามเดิม
**ชม. ที่ต้องเสร็จต่อคน:** Tatdanai 13 · Wit 10 · ruvcandyfruit 13 (รวม QA) · Sunanthida 11 · KaylahJin 10

---

## ภาคผนวก ก: ร่าง Issue P1–P5 และ sub-issue

ใช้ template ของ #127 · 1 ปัญหาต่อ 1 คน · sub-issue ไม่เกิน 6 ชม. แตกตามสิ่งที่ผู้ใช้ทำได้ · Reviewer หมุนตาม #126 (16 sub-issue ÷ 5 คน = คนละไม่เกิน 4 · ไม่นับ QA เพราะไม่มี PR)
**FR ?** = รอไฟล์โจทย์ FR1–FR10 เพื่อเทียบเลข

| P | ปัญหาหลัก | Owner | Tester | sub-issue | รวม |
|---|---|---|---|---|---|
| P1 | ระบบปลอดภัยและพร้อมติดตั้ง | @Tatdanai6609611964 | @KaylahJin | 4 | 13 ชม. |
| P2 | หน้าเว็บตาม role และบั๊กหน้าตรวจ | @Pawit-Billamas | @ruvcandyfruit | 4 | 14 ชม. |
| P3 | แนบไฟล์ในแผน | @ruvcandyfruit | @SunanthidaPhaengbao | 2 | 10 ชม. |
| P4 | ขั้นพิจารณาใหม่ | @SunanthidaPhaengbao | @Pawit-Billamas | 3 | 15 ชม. |
| P5 | เกณฑ์และข้อมูลทดสอบ | @KaylahJin | @Tatdanai6609611964 | 3 | 14 ชม. |
| QA | ทดสอบรวม | @ruvcandyfruit | – | 1 | 3 ชม. |

**งานที่ block คนอื่น (ต้องมี draft PR ภายในวันที่ 2):** P1-① → P4-① (บัญชีทดสอบ) · P4-① → P2-④, P5-③ (สถานะใหม่) · P3-① → P4-② · P5-① → P4-②, P4-③, P5-③
**ไฟล์ชน:** `CoopPlans.tsx` / `PlanDetailModal.tsx` (P2-①–③ merge ก่อน P3, P4 · P2-④ merge หลัง P4-①) · migration ตั้งชื่อ `v3_02_*` (P3), `v3_03_*` (P5), `v3_04_*` (P4)

---

### P1: ระบบปลอดภัยและพร้อมติดตั้ง

**Problem / Goal:** พบปัญหาความปลอดภัย 9 ข้อ (F15 รายละเอียดอยู่ในกลุ่ม), CI ไม่จับ type error (F26) และยังไม่มีคู่มือติดตั้งตั้งแต่ศูนย์
**User story ↔ FR:**
- ในฐานะผู้ดูแลระบบ ฉันต้องการให้เฉพาะบัญชีที่ได้รับอนุญาตเข้าถึงข้อมูล เพื่อป้องกันข้อมูลนักศึกษารั่ว → FR ?
- ในฐานะสมาชิกใหม่ของทีม ฉันต้องการติดตั้งระบบได้จากเอกสาร เพื่อเริ่มทำงานได้ทันที → FR ?

**Demo:** หลังจบ issue นี้ คนนอกสมัครบัญชีแล้วไม่ได้สิทธิ์ใด ๆ และสมาชิกใหม่ติดตั้งระบบได้จากเอกสาร
**Owner:** @Tatdanai6609611964 · **Tester:** @KaylahJin

#### P1-① บัญชีใหม่ได้ role เฉพาะจากรายชื่อที่กำหนด
**Problem / Goal:** การให้ role ยังไม่รัดกุม (F15)
**Demo:** หลังจบ issue นี้ บัญชีที่สมัครเองจะไม่ได้ role ใด ๆ แม้รัน seed script ซ้ำ
**Task:**
- [ ] ปรับการตั้งค่า Cognito ใน `cognito.tf` (การสมัครบัญชีและนโยบายรหัสผ่าน)
- [ ] แก้ `seed-app-users.sh` ให้ใช้รายชื่อบัญชีและ role ที่กำหนดไว้ชัดเจน และส่งค่าเข้า SQL อย่างปลอดภัย
- [ ] แยกรหัสผ่านบัญชีทดสอบตาม role และเอาอีเมลบัญชีทดสอบออกจากหน้าเว็บ

**Acceptance Criteria:**
- [ ] บัญชีที่ไม่อยู่ในรายชื่อได้ `403` หลังรัน seed script ซ้ำ
- [ ] บัญชีทดสอบทุก role ล็อกอินได้เหมือนเดิม
- [ ] หน้าเว็บไม่แสดงอีเมลบัญชีทดสอบ

**Evidence:**
- [ ] ผลรัน seed script ซ้ำ
- [ ] ผลล็อกอินทุก role

**Labels:** auth · **Blocked by:** – · **Estimate:** 4 ชม. · **Assignee:** @Tatdanai6609611964 · **Reviewer:** @Pawit-Billamas

#### P1-② ฐานข้อมูลและข้อมูลใน repo ปลอดภัย
**Problem / Goal:** การตั้งค่าฐานข้อมูลและบัญชี DB ที่ Lambda ใช้ยังไม่รัดกุม (F15) และมีข้อมูลติดต่อบุคคลใน `infra/migrate/source/positions.json` (Audit S6)
**Demo:** หลังจบ issue นี้ ระบบทำงานเหมือนเดิม โดยฐานข้อมูลใช้สิทธิ์น้อยที่สุดเท่าที่ Lab อนุญาต
**Task:**
- [ ] ปรับการตั้งค่า RDS และบัญชี DB ของ Lambda ตามเอกสารในกลุ่ม
- [ ] เอาข้อมูลติดต่อบุคคลออกจากไฟล์ข้อมูลใน repo
- [ ] ข้อที่ทำใน Lab ไม่ได้ บันทึกเหตุผลไว้

**Acceptance Criteria:**
- [ ] ข้อระดับสูงที่เหลือแก้แล้ว หรือมีเหตุผลว่าทำใน Lab ไม่ได้
- [ ] API ทุก route ยังตอบถูกต้อง
- [ ] ไม่มีข้อมูลติดต่อบุคคลในไฟล์ข้อมูล

**Evidence:**
- [ ] ผล `terraform plan` (ซ่อนค่าลับ)
- [ ] ผลเรียก API หลังแก้

**Labels:** database, infra · **Blocked by:** – · **Estimate:** 4 ชม. · **Assignee:** @Tatdanai6609611964 · **Reviewer:** @KaylahJin

#### P1-③ CI จับ type error ได้จริง
**Problem / Goal:** CI type-check ไม่ได้ตรวจไฟล์ไหนเลย และ workflow แจ้งเตือน 2 ตัวพังทุกรอบ (F26)
**Demo:** หลังจบ issue นี้ PR ที่มี type error ถูก CI ตีกลับ
**Task:**
- [ ] เปลี่ยน type-check ใน `ci.yml` ให้ใช้ `tsc -b`
- [ ] แก้ script ใน `pr-review-notify.yml` และ `deadline-check.yml`

**Acceptance Criteria:**
- [ ] PR ทดลองที่ใส่ type error แล้ว CI fail
- [ ] workflow แจ้งเตือนทั้ง 2 ตัวรันผ่าน

**Evidence:**
- [ ] ลิงก์ CI run ที่ fail และที่ผ่าน
- [ ] ลิงก์ workflow run ที่ผ่าน

**Labels:** ci · **Blocked by:** – · **Estimate:** 2 ชม. · **Assignee:** @Tatdanai6609611964 · **Reviewer:** @SunanthidaPhaengbao

#### P1-④ สมาชิกใหม่ติดตั้งระบบได้จากเอกสาร
**Problem / Goal:** ทีมเสนอให้มีเอกสาร setup ตั้งแต่ศูนย์ แต่ยังไม่มีคนรับ
**Demo:** หลังจบ issue นี้ คนที่ไม่เคยติดตั้งทำตามเอกสารแล้วเปิดระบบได้ครบ
**Task:**
- [ ] เขียนคู่มือติดตั้งตั้งแต่ศูนย์ (เครื่องมือ, AWS Lab, Terraform, DB, seed, frontend) ต่อจาก `docs/QUICK_SETUP.md` ที่ Wit เริ่มไว้
- [ ] ให้สมาชิก 1 คนลองทำตาม แล้วแก้จุดที่ติด

**Acceptance Criteria:**
- [ ] สมาชิกที่ไม่ได้เขียนเอกสารทำตามแล้วระบบทำงานได้

**Evidence:**
- [ ] ลิงก์เอกสาร และ comment ยืนยันจากคนที่ลองทำ

**Labels:** docs · **Blocked by:** P1-①, P1-② · **Estimate:** 3 ชม. · **Assignee:** @Tatdanai6609611964 · **Reviewer:** @ruvcandyfruit

---

### P2: หน้าเว็บตาม role และบั๊กหน้าตรวจ

**Problem / Goal:** ล็อกอินซ้ำ (F07), ข้อความยื่นไม่ผ่านไม่ตรงสาเหตุ (F08), หน้าเว็บไม่รู้ role (F09) และบั๊กหน้าตรวจ (F11–F13, F20)
**User story ↔ FR:**
- ในฐานะนักศึกษา ฉันต้องการเห็นแผนทันทีหลังล็อกอินและรู้เหตุผลที่ยื่นไม่ผ่าน เพื่อแก้ได้ถูกจุด → FR ?
- ในฐานะผู้ใช้ทุก role ฉันต้องการเห็นเฉพาะเมนูและปุ่มที่ฉันใช้ได้ เพื่อไม่สับสน → FR ?

**Demo:** หลังจบ issue นี้ ผู้ใช้แต่ละ role เห็นเฉพาะสิ่งที่ตัวเองทำได้ และรู้สาเหตุชัดเมื่อยื่นไม่ผ่าน
**Owner:** @Pawit-Billamas · **Tester:** @ruvcandyfruit

#### P2-① ล็อกอินจากหน้าแผนแล้วเห็นแผนทันที
**Problem / Goal:** หน้าแผนขอ token ก่อนระบบล็อกอินพร้อม จึงเจอหน้าลงชื่อซ้ำ (F07)
**Demo:** หลังจบ issue นี้ นักศึกษาล็อกอินจากหน้าแผนสหกิจแล้วเห็นแผนทันที
**Task:**
- [ ] ให้ `CoopPlans.tsx` รอสถานะล็อกอินจาก `AuthContext.tsx` ก่อนเรียก API
- [ ] เพิ่ม test ลำดับการล็อกอิน

**Acceptance Criteria:**
- [ ] ล็อกอินจากหน้าแผนสหกิจแล้วไม่เจอหน้าลงชื่อซ้ำ

**Evidence:**
- [ ] GIF ล็อกอินจากหน้าแผนสหกิจ
- [ ] ผล test

**Labels:** frontend, auth · **Blocked by:** – · **Estimate:** 2 ชม. · **Assignee:** @Pawit-Billamas · **Reviewer:** @Tatdanai6609611964

#### P2-② นักศึกษาเห็นเหตุผลที่ยื่นไม่ผ่านตรงสาเหตุ
**Problem / Goal:** backend ส่งรหัส error 13 รหัส แต่หน้าเว็บรู้จักแค่ 4 (F08)
**Demo:** หลังจบ issue นี้ นักศึกษาที่ยื่นไม่ผ่านเห็นเหตุผลภาษาไทยตรงสาเหตุทุกกรณี
**Task:**
- [ ] ทำตารางข้อความภาษาไทยครบทั้ง 13 รหัสใน `submissionRules.mjs` และ `eligibility.mjs` ลบ 5 รหัสที่ backend ไม่เคยส่ง
- [ ] รหัสใหม่ที่ยังไม่มีในตาราง แสดง `message` จาก backend ไปก่อน กันหน้าจอว่าง

**Acceptance Criteria:**
- [ ] ทุกรหัสที่ backend ส่งมี test ว่าแสดงข้อความภาษาไทย
- [ ] ไม่มีชื่อรหัสโผล่บนหน้าจอ

**Evidence:**
- [ ] Screenshot อย่างน้อย: GPA ไม่ถึง, วิชาไม่ครบ, หมดเวลายื่น
- [ ] ผล test

**Labels:** frontend · **Blocked by:** – · **Estimate:** 3 ชม. · **Assignee:** @Pawit-Billamas · **Reviewer:** @SunanthidaPhaengbao

#### P2-③ แต่ละ role เห็นเฉพาะเมนูและฟอร์มของตัวเอง
**Problem / Goal:** นักศึกษาเห็นฟอร์มผู้ตรวจ และทุก role เห็นแท็บนักศึกษา (F09)
**Demo:** หลังจบ issue นี้ นักศึกษาไม่เห็นฟอร์มผู้ตรวจและแท็บนักศึกษา และแต่ละ role เห็นรายชื่อนักศึกษาตาม D9
**Task:**
- [ ] เพิ่ม `GET /me` คืน role ของผู้ใช้ และให้หน้าเว็บใช้ค่านี้
- [ ] ซ่อนฟอร์มผู้ตรวจ ปุ่ม "ตรวจแผน" และแท็บนักศึกษาตาม role
- [ ] ปรับ `buildStudentScope` ให้ตรง D9

**Acceptance Criteria:**
- [ ] Student ไม่เห็นฟอร์มผู้ตรวจ ปุ่มตรวจแผน และแท็บนักศึกษา
- [ ] เรียก `GET /students` ด้วย role ที่ไม่มีสิทธิ์ได้ `403`

**Evidence:**
- [ ] Screenshot หน้าแผนและหน้านักศึกษาของทุก role (desktop และ mobile)
- [ ] ผล test

**Labels:** frontend, backend, auth · **Blocked by:** – · **Estimate:** 5 ชม. · **Assignee:** @Pawit-Billamas · **Reviewer:** @KaylahJin

#### P2-④ ผู้ตรวจดูประวัติและหน้าตรวจไม่มีบั๊ก
**Problem / Goal:** ปุ่ม "ตรวจ" ในหน้ารายละเอียดไม่ทำงาน (F11), ความเห็นรอบก่อนค้าง (F12), ไม่มีประวัติ (F13), ตัวกรองนับ `DRAFT` ได้ 0 เสมอ (F20)
**Demo:** หลังจบ issue นี้ ผู้ตรวจเห็นประวัติทุกขั้นของแผน และกดตรวจจากหน้ารายละเอียดได้
**Task:**
- [ ] API อ่านประวัติ `plan_reviews` และ UI แสดงประวัติ
- [ ] ยื่นใหม่แล้วล้างความเห็นรอบก่อนในฟอร์ม
- [ ] แก้ปุ่ม "ตรวจ" ในหน้ารายละเอียด
- [ ] ตัวกรองสถานะใช้ `PREPARING` และสถานะใหม่

**Acceptance Criteria:**
- [ ] เห็นประวัติครบทุกขั้น พร้อมผู้บันทึกและเวลา
- [ ] ยื่นใหม่แล้วฟอร์มไม่มีความเห็นเก่า แต่ดูได้ในประวัติ
- [ ] ปุ่ม "ตรวจ" ในหน้ารายละเอียดเปิดฟอร์มได้
- [ ] ตัวกรองนับจำนวนถูกทุกสถานะ

**Evidence:**
- [ ] Screenshot ประวัติ และ GIF ปุ่มตรวจ
- [ ] ผล test

**Labels:** frontend, backend · **Blocked by:** P4-① · **Estimate:** 4 ชม. · **Assignee:** @Pawit-Billamas · **Reviewer:** @SunanthidaPhaengbao

---

### P3: แนบไฟล์ในแผน

**Problem / Goal:** แนบ Transcript ไม่ได้ (F01) ทำให้ Self-test 1 ไม่ผ่าน และอาจารย์ระบุว่า "แผนต้องส่งไฟล์ได้"
**User story ↔ FR:**
- ในฐานะนักศึกษา ฉันต้องการแนบ Transcript กับแผน เพื่อให้ผู้ตรวจตรวจเอกสารได้ → FR ?

**Demo:** หลังจบ issue นี้ นักศึกษาแนบ Transcript ได้ และผู้ตรวจเปิดดูได้
**Owner:** @ruvcandyfruit · **Tester:** @SunanthidaPhaengbao

#### P3-① นักศึกษาแนบ Transcript และยังเห็นไฟล์หลังเปิดใหม่
**Problem / Goal:** ยังไม่มีระบบ upload
**Demo:** หลังจบ issue นี้ นักศึกษาแนบ PDF ได้ ออกจากหน้าแล้วเปิดใหม่ไฟล์ยังอยู่
**Task:**
- [ ] S3 bucket แบบ private (Terraform, ใช้ `LabRole`)
- [ ] API ขอ presigned URL สำหรับ upload ตรวจว่าเป็นเจ้าของแผน
- [ ] ตาราง `plan_attachments` + migration `v3_02_*` + rollback และอัปเดต `schema.sql`
- [ ] UI อัปโหลดและลบไฟล์ตอน `PREPARING` / `RETURNED` รับเฉพาะ PDF ไม่เกิน 5 MB (D8)
- [ ] API upload และลบไฟล์ ตรวจสถานะแผนฝั่ง server ด้วย ให้ทำได้เฉพาะ `PREPARING` / `RETURNED`

**Acceptance Criteria:**
- [ ] แนบ PDF แล้วเปิดใหม่ไฟล์ยังอยู่
- [ ] ไฟล์ผิดประเภทหรือเกินขนาดถูกปฏิเสธพร้อมข้อความ
- [ ] หลังยื่นแล้วแก้หรือลบไฟล์ไม่ได้ ทั้งจากหน้าเว็บและเรียก API ตรง (มี test ของสถานะ `SUBMITTED`, `ENDORSED`, `ELIGIBLE`)
- [ ] migration รันซ้ำได้และ rollback ได้

**Evidence:**
- [ ] GIF แนบไฟล์แล้วเปิดใหม่ (desktop และ mobile)
- [ ] ผล test และผล migration / rollback

**Labels:** frontend, backend, database, infra · **Blocked by:** – · **Estimate:** 6 ชม. · **Assignee:** @ruvcandyfruit · **Reviewer:** @Pawit-Billamas

#### P3-② ผู้ตรวจเปิดไฟล์ได้ คนอื่นเปิดไม่ได้
**Problem / Goal:** ผู้ตรวจต้องเห็นไฟล์เพื่อตรวจเอกสาร
**Demo:** หลังจบ issue นี้ ผู้ตรวจเปิดไฟล์ในรายละเอียดแผนได้ และคนที่ไม่มีสิทธิ์เปิดไม่ได้
**Task:**
- [ ] API ขอ presigned URL สำหรับ download ตรวจสิทธิ์ผ่าน `authorize.mjs`
- [ ] แสดงไฟล์ในรายละเอียดแผน

**Acceptance Criteria:**
- [ ] ผู้ตรวจที่มีสิทธิ์เปิดไฟล์ได้
- [ ] นักศึกษาคนอื่นขอ URL ไฟล์ได้ `403` หรือ `404` และ bucket ไม่เปิด public

**Evidence:**
- [ ] Screenshot ผู้ตรวจเปิดไฟล์
- [ ] ผล test สิทธิ์ (เจ้าของ, ผู้ตรวจ, คนอื่น)

**Labels:** frontend, backend, auth · **Blocked by:** P3-① · **Estimate:** 4 ชม. · **Assignee:** @ruvcandyfruit · **Reviewer:** @Tatdanai6609611964

---

### P4: ขั้นพิจารณาใหม่ (รับรอง → ตรวจ → คัดเลือก)

**Problem / Goal:** F02–F04, F06, F10 ทำให้ Self-test 1–2 ไม่ผ่าน ทำตาม role และขั้นตอนใน [`v3-roles-workflow-target.md`](v3-roles-workflow-target.md) (D1–D5)
**User story ↔ FR:**
- ในฐานะ Advisor ฉันต้องการรับรองความประพฤติ โดยไม่ต้องตัดสินผลคัดเลือก → FR4
- ในฐานะ Coordinator ฉันต้องการบันทึกว่าเอกสารครบไหมและคุณสมบัติผ่านไหม → FR4, FR5
- ในฐานะ Committee ฉันต้องการคัดเลือกจากผู้ที่ผ่านการตรวจภายในจำนวนรับ → FR5

**Demo:** หลังจบ issue นี้ แผนผ่าน 3 ขั้น รับรอง → ตรวจ → คัดเลือก โดยแต่ละ role ทำได้เฉพาะขั้นของตัวเอง
**Owner:** @SunanthidaPhaengbao · **Tester:** @Pawit-Billamas

#### P4-① Advisor รับรองความประพฤติ
**Problem / Goal:** Advisor อนุมัติได้เอง แต่โจทย์ให้แค่รับรอง (F02)
**Demo:** หลังจบ issue นี้ Advisor กดรับรองหรือไม่รับรองแผนของนักศึกษาในที่ปรึกษาได้ และอนุมัติเองไม่ได้
**Task:**
- [ ] migration `v3_04_*` + rollback: role `COORDINATOR` (เดิม `STAFF`), `COMMITTEE`, สถานะใหม่ตาม D2, `plan_reviews.step`
- [ ] action Endorse ใน `authorize.mjs` และ route ใหม่
- [ ] UI ปุ่มรับรอง / ไม่รับรองสำหรับ Advisor
- [ ] บัญชีทดสอบ ADV-1, COORD-1, COM-1

**Acceptance Criteria:**
- [ ] Advisor รับรองได้ แผนเป็น `ENDORSED`; ไม่รับรองต้องใส่เหตุผล แผนเป็น `RETURNED`
- [ ] role อื่นเรียก Endorse ได้ `403`
- [ ] จำนวนแผนก่อนและหลัง migration เท่ากัน

**Evidence:**
- [ ] GIF Advisor รับรอง
- [ ] ผล test และผล verify migration

**Labels:** backend, database, frontend · **Blocked by:** P1-① · **Estimate:** 6 ชม. · **Assignee:** @SunanthidaPhaengbao · **Reviewer:** @ruvcandyfruit

#### P4-② Coordinator ตรวจเอกสารและคุณสมบัติ
**Problem / Goal:** ไม่มีขั้นตรวจเอกสาร (F03, F04)
**Demo:** หลังจบ issue นี้ Coordinator บันทึก `ELIGIBLE` / `INCOMPLETE` / `NOT_ELIGIBLE` พร้อมเหตุผลได้
**Task:**
- [ ] action Screening ใน `authorize.mjs` และ route
- [ ] UI ฟอร์มตรวจ แสดงไฟล์แนบและผลตรวจคุณสมบัติตามเกณฑ์ของรอบ

**Acceptance Criteria:**
- [ ] เคส S02 (ไม่มี Transcript) บันทึก `INCOMPLETE` ได้ แผนกลับเป็น `RETURNED` และไม่ถูกนับเป็น Eligible
- [ ] เคส S01 บันทึก `ELIGIBLE` ได้
- [ ] role อื่นเรียก Screening ได้ `403`

**Evidence:**
- [ ] Screenshot เคส S01 และ S02
- [ ] ผล test

**Labels:** backend, frontend · **Blocked by:** P4-①, P3-①, P5-① · **Estimate:** 5 ชม. · **Assignee:** @SunanthidaPhaengbao · **Reviewer:** @KaylahJin

#### P4-③ Committee คัดเลือกภายในจำนวนรับ
**Problem / Goal:** Eligible กับ Selected ไม่แยกกัน (F06)
**Demo:** หลังจบ issue นี้ Committee เลือก `SELECTED` / `NOT_SELECTED` จากแผนที่ `ELIGIBLE` ได้ไม่เกินจำนวนรับ
**Task:**
- [ ] action Selection ใน `authorize.mjs` และ route ตรวจจำนวนรับจาก P5-① ใน transaction เดียวกับการบันทึกผล โดยล็อกแถวของรอบก่อน (`SELECT ... FOR UPDATE`)
- [ ] UI รายการผู้ผ่านการตรวจสำหรับ Committee
- [ ] กฎ 1 แผนต่อรอบนับแผนที่ `SELECTED` และ `NOT_SELECTED` (F10)

**Acceptance Criteria:**
- [ ] เลือกเกินจำนวนรับได้ `409`
- [ ] สร้างแผนใหม่หลัง `SELECTED` หรือ `NOT_SELECTED` ในรอบเดิมไม่ได้
- [ ] Committee 2 คนกดเลือกพร้อมกันตอนเหลือ 1 ที่ ได้ `SELECTED` คนเดียว อีกคนได้ `409`
- [ ] role อื่นเรียก Selection ได้ `403`

**Evidence:**
- [ ] GIF Committee คัดเลือก
- [ ] ผล test

**Labels:** backend, frontend · **Blocked by:** P4-②, P5-① · **Estimate:** 4 ชม. · **Assignee:** @SunanthidaPhaengbao · **Reviewer:** @Tatdanai6609611964

---

### P5: เกณฑ์และข้อมูลทดสอบ

**Problem / Goal:** เกณฑ์ใช้ชุดเดียวทุกรอบ (F05), seed ยื่นแผนไม่ได้และ reset ไม่ได้ (F17, F18), schema ไม่ตรง (F19), constraint ขัดกัน (F21), import เขียนทับเป็น NULL (F23)
**User story ↔ FR:**
- ในฐานะ Coordinator ฉันต้องการตั้งเกณฑ์และจำนวนรับแยกแต่ละรอบ เพื่อคัดกรองได้ถูกต้อง → FR ?
- ในฐานะทีมทดสอบ ฉันต้องการ reset ข้อมูลทดสอบของรอบเดียว เพื่อทดสอบซ้ำได้โดยไม่กระทบรอบอื่น → FR ?

**Demo:** หลังจบ issue นี้ ข้อมูลทดสอบตามเอกสาร Self-test ใช้ได้ทันทีและ reset ได้
**Owner:** @KaylahJin · **Tester:** @Tatdanai6609611964

#### P5-① ตั้งเกณฑ์และจำนวนรับรายรอบ
**Problem / Goal:** เกณฑ์อยู่ในโค้ด ไม่มีจำนวนรับ และ GPA เท่าเกณฑ์ยังผ่าน (F05)
**Demo:** หลังจบ issue นี้ รอบ COOP-2569-01 ใช้เกณฑ์ GPA > 2.80, กลุ่มวิชา ≥ 2.50 และรับ 2 คน
**Task:**
- [ ] เพิ่ม `min_gpa`, `min_group_gpa`, `capacity` ในตาราง `periods` (migration `v3_03_*` + rollback)
- [ ] `eligibility.mjs` อ่านเกณฑ์จากรอบ ใช้ "มากกว่า" สำหรับ GPA (D6)

**Acceptance Criteria:**
- [ ] S01, S03 ผ่าน · S04 (GPA 2.75) และ S05 (กลุ่มวิชา 2.30) ไม่ผ่าน
- [ ] GPA เท่าเกณฑ์พอดี (2.80) ไม่ผ่าน · กลุ่มวิชาเท่าเกณฑ์พอดี (2.50) ผ่าน
- [ ] เปลี่ยนเกณฑ์รอบหนึ่งไม่กระทบรอบอื่น

**Evidence:**
- [ ] ผลตรวจคุณสมบัติ S01–S05
- [ ] ผล test

**Labels:** backend, database · **Blocked by:** – · **Estimate:** 5 ชม. · **Assignee:** @KaylahJin · **Reviewer:** @SunanthidaPhaengbao

#### P5-② reset ข้อมูลทดสอบรอบ COOP-2569-01 ได้
**Problem / Goal:** seed ยื่นแผนไม่ได้ (ช่วงยื่นหมดตั้งแต่ปี 2025) และ script สร้าง seed ลบข้อมูลที่เขียนมือ (F17, F18)
**Demo:** หลังจบ issue นี้ ทีมรัน script แล้วได้ข้อมูล S01–S05 พร้อมทดสอบ โดยรอบอื่นไม่เปลี่ยน
**Task:**
- [ ] seed รอบ COOP-2569-01 + ผู้สมัคร S01–S05 ตามเอกสาร + ช่วงยื่นที่ยังเปิด
- [ ] script reset เฉพาะรอบ รันซ้ำได้
- [ ] แยกข้อมูลที่เขียนมือออกจากไฟล์ที่ script สร้าง

**Acceptance Criteria:**
- [ ] reset แล้วรอบนั้นกลับเป็น baseline รอบอื่นไม่เปลี่ยน และรันซ้ำได้
- [ ] รัน script สร้าง seed แล้วข้อมูลที่เขียนมือไม่หาย

**Evidence:**
- [ ] ผล reset ก่อน / หลัง

**Labels:** database · **Blocked by:** P5-① · **Estimate:** 5 ชม. · **Assignee:** @KaylahJin · **Reviewer:** @ruvcandyfruit

#### P5-③ สร้างฐานข้อมูลใหม่ได้ตรง และ import ไม่ทำข้อมูลหาย
**Problem / Goal:** `schema.sql` / `schema.dbml` ไม่ตรงกับ migration (F19), constraint ของ `app_users` ขัดกัน (F21), import เขียนทับเป็น NULL (F23)
**Demo:** หลังจบ issue นี้ สมาชิกสร้างฐานข้อมูลใหม่จาก `schema.sql` แล้วระบบทำงานได้ และ import ซ้ำไม่ทำข้อมูลหาย
**Task:**
- [ ] อัปเดต `schema.sql` / `schema.dbml` ให้ตรงกับหลัง migration ทั้งหมด (รวมของ P3, P4, P5-①)
- [ ] แก้ constraint ของ `app_users`
- [ ] import: ช่องว่างใน CSV ไม่เขียนทับข้อมูลเดิม

**Acceptance Criteria:**
- [ ] สร้าง DB ใหม่จาก `schema.sql` ได้โครงสร้างเดียวกับหลัง migration
- [ ] import CSV ที่มีช่องว่าง ข้อมูลเดิมไม่กลายเป็น NULL

**Evidence:**
- [ ] diff ของ `schema.sql` และผล import

**Labels:** database · **Blocked by:** P3-①, P4-①, P5-① · **Estimate:** 4 ชม. · **Assignee:** @KaylahJin · **Reviewer:** @Pawit-Billamas

---

### [QA] ทดสอบรวม

**Problem / Goal:** ทดสอบ Self-test 1–2 และ flow ทุก role ก่อนปิด milestone (แทน W7 เดิม)
**Demo:** หลังจบ issue นี้ Self-test 1 และ 2 = PASS และทุกข้อในหัวข้อ E ของเอกสาร Self-test พร้อม
**Task:**
- [ ] เขียน test case ตาม flow ของแต่ละ role และจับคู่ tester
- [ ] นำทดสอบรวม เก็บบั๊กเปิดเป็น issue ใต้ P ที่เกี่ยวข้อง
- [ ] checklist "P? ผ่านแล้ว — @tester"

**Acceptance Criteria:**
- [ ] Self-test 1 และ 2 = PASS
- [ ] P1–P5 ผ่านการทดสอบของ tester ครบ

**Evidence:**
- [ ] ตารางผลพร้อม screenshot ทุกขั้น

**Labels:** qa · **Blocked by:** P1–P5 · **Estimate:** 3 ชม. · **Assignee:** @ruvcandyfruit
