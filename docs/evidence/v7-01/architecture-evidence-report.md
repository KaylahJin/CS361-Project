# V7-01-2: รายงานหลักฐานการทบทวน Architecture 6 ด้าน (#260)

> **Issue:** [#260 — `[V7-01-2] เก็บหลักฐาน Architecture 6 ด้านจาก AWS จริง`](https://github.com/KaylahJin/CS361-Project/issues/260)  
> **อ้างอิงโครงสร้าง:** [`V7-overview.md`](../../overview/V7-overview.md) §4.1–§4.7 (PR [#265](https://github.com/KaylahJin/CS361-Project/pull/265))  
> **Commit SHA ที่ตรวจสอบ:** `286451c5e8cd9f180ea069efbc3255d905f35aa4` (`main`, วันที่ 25 พ.ย. 2569)  
> **ผลรันดิบและข้อมูลที่ปิด Secret แล้ว:** [`terraform-and-aws-checks.txt`](./terraform-and-aws-checks.txt)

---

## 1. สรุปผลการตรวจสอบตาม Task ของ #260

### 1.1 `terraform validate` บน `main` (ยืนยัน `lambda.tf` ที่แก้ใน `599e48c`)
- **ผลตรวจจริง:** รัน `terraform -chdir=infra/terraform fmt -check -recursive` และ `terraform -chdir=infra/terraform validate` บน commit `286451c` (`main` หลัง merge PR #235) → **ผ่าน (`Success! The configuration is valid.`)**
- **หลักฐานเพิ่มเติม:** `npx vitest run infra/terraform/route-policy.test.mjs infra/lambda/companies/auth.test.mjs infra/lambda/companies/authorize.test.mjs` ผ่าน **95/95 tests**, `npm test` ผ่าน **63/63 files (1,121 tests)** และ `npm run build` ผ่านใน `858 ms`

### 1.2 RDS `publicly_accessible` และ Security Group Port 5432 (Module09 หน้า 30)
- **ค่าใน Terraform (`rds.tf` บรรทัด 15, `security_groups.tf` บรรทัด 35–55):**
  - `aws_db_instance.coop_db`: `publicly_accessible = true` (เพื่อให้นักพัฒนาใช้ `psql` โหลด schema/seed จากเครื่องตนเองได้)
  - `aws_security_group.rds`: รับ TCP `5432` เฉพาะจาก `aws_security_group.lambda.id` (`rds_ingress_from_lambda`) และ `var.my_ip_cidr` (`rds_ingress_from_dev_ip`)
- **ค่าที่เคยสังเกตจริงจาก AWS (`terraform.tfstate` ที่บันทึกไว้ก่อนทำลาย และ `docs/evidence/190-06` / `190-07`):**
  - `PubliclyAccessible = true` ยืนยันตรงกันทั้ง `us-east-1` (Learner Lab) และ `ap-southeast-2`
  - ในหลักฐาน [`190-06-aws-rds-security-group-inbound.txt`](../190-06-aws-rds-security-group-inbound.txt) เคยพบ rule `0.0.0.0/0` ค้างอยู่ใน SG จริงของ Learner Lab แต่ใน Terraform ล่าสุดจำกัดเป็น `<DEV_PUBLIC_IP>/32`
  - **ช่องโหว่ที่พบในโค้ดปัจจุบัน:** `variables.tf` (บรรทัด 58) ยอมรับ CIDR รูปแบบ `\d{1,3}/0` ถึง `/32` ซึ่งยังเปิดโอกาสให้ใส่ `0.0.0.0/0` เข้า `my_ip_cidr` ได้ → **ส่งต่อให้ #261 เพิ่ม validation บังคับ `/32` เท่านั้น**

### 1.3 `max_connections` ของ RDS และเพดาน Concurrency ของ Lambda (Module10 หน้า 27)
- **สถานะการวัดจริงจาก AWS RDS (ข้อจำกัด environment):**
  - **ไม่ได้รัน `SHOW max_connections;` บน AWS RDS ใหม่ในวันที่ 25 พ.ย. 2569** เนื่องจากเครดิต Learner Lab หมดตามบันทึกใน [#263](https://github.com/KaylahJin/CS361-Project/issues/263) (`V7-overview.md` §7) และ stack ชั่วคราวถูกทำลายด้วย `terraform destroy` เพื่อไม่ให้เกิดค่าใช้จ่าย RDS คงค้าง (ตาม AC 1 ของ #260 ที่ให้ระบุเหตุผลหากไม่สามารถวัดสดได้)
- **การคำนวณตามสูตรอ้างอิง (Formula-derived / Estimate, ไม่ใช่ค่าที่ query สด):**
  - สูตร default parameter group ของ AWS RDS PostgreSQL คือ `LEAST({DBInstanceClassMemory / 9531392}, 5000)` สำหรับ `db.t4g.micro` / `db.t3.micro` (RAM 1 GiB = `1,073,741,824` bytes) ได้ค่าตามสูตร **`112` connections**
  - ค่า pool ใน `infra/lambda/companies/db.mjs` บรรทัด 16 คือ `MAX_CONNECTIONS = 5` ต่อ 1 Lambda execution context และใน Terraform (`lambda.tf`) ค่า `reserved_concurrent_executions` ยังเป็น `-1` (ไม่จำกัด)
  - แทนค่าตามสูตร **CS361 Module10 หน้า 27** โดยกัน `others = 12` (superuser/RDS internals/psql):
    $$\text{Max Lambda Concurrency} = \frac{(112 - 12) \times 0.8}{5} = 16\text{ concurrent contexts}$$
  - **จุดที่ควรพิจารณาใน #261:** ปัจจุบัน `MAX_CONNECTIONS = 5` ทั้งที่ Lambda 1 execution context ประมวลผลทีละ 1 request พร้อมกัน (`pg.Pool` เผื่อ `max: 5` เกินจำเป็นและลดเพดาน concurrency ลง 5 เท่า) การลด `MAX_CONNECTIONS` หรือตั้ง `reserved_concurrent_executions` (ภายใต้โควตา concurrency ของบัญชี) จะช่วยป้องกัน connection exhaustion บน RDS

### 1.4 Backup Retention, RPO / RTO และ DR Pattern (ACA M16 หน้า 30–42)
- **ค่าที่สังเกตจาก AWS จริง (ใน archived `terraform.tfstate` ทั้ง `us-east-1` และ `ap-southeast-2`):**
  - `infra/terraform/rds.tf` ไม่ได้ระบุ `backup_retention_period` จึงได้ค่า **`backup_retention_period = 0`** (ปิด automated backup และ Point-in-Time Recovery), `multi_az = false`, `storage_encrypted = false`, `skip_final_snapshot = true`
- **DR Pattern ที่เลือก (ACA M16 หน้า 30–42):** **Backup and Restore** (เหมาะสมกับระบบการศึกษาและข้อจำกัดงบ/สิทธิ์ของ Learner Lab แทน Pilot Light / Warm Standby / Multi-Site)
- **RPO / RTO ตามสภาพปัจจุบัน vs เป้าหมายหลังแก้ใน #261:**

| ข้อมูล | สถานะปัจจุบัน (`backup_retention_period = 0`) | เป้าหมายหลังแก้ใน #261 (`backup_retention_period = 1`) |
|---|---|---|
| **ข้อมูลตั้งต้น (companies / positions / periods / students seed)** | **RPO ≈ 0** (สร้างใหม่จาก Git + `db:load`) | **RPO ≈ 0** |
| **ข้อมูลแผนและประวัติรีวิว (`coop_plans`, `plan_reviews`)** | **RPO = นับจาก manual snapshot ล่าสุด** (เสี่ยงหายทั้งหมดหาก RDS พังเพราะ automated backup ปิดอยู่) | **RPO ≤ 5 นาที** (Point-in-Time Recovery + daily automated snapshot 1 วัน) |
| **RTO (เวลาฟื้นฟูระบบ)** | **~10–15 นาที** (`terraform apply` สร้าง RDS ~5–6 นาที + `db:load` + `env:sync` / `web:deploy`) | **~10–15 นาที** (Restore snapshot / re-provision) |

---

## 2. สรุปการแมปหลักฐานเข้ากับตาราง 6 ด้านใน `V7-overview.md` (§4.1–§4.7)

| หัวข้อใน `V7-overview.md` | จุดที่อ้างถึง `#260` | หลักฐานที่เก็บได้ใน `#260` | ส่งต่อไปยัง `#261` |
|---|---|---|---|
| **§4.1 Security** | ค่าจริง SG 5432 และ `publicly_accessible` | `publicly_accessible = true`; Terraform เปิด 5432 เฉพาะ `lambda-sg` + `/32` แต่ `190-06` เคยพบ `0.0.0.0/0` จาก drift | เพิ่ม validation บังคับ `my_ip_cidr` เป็น `/32` เท่านั้นใน `variables.tf` |
| **§4.2 Privacy** | ตรวจสิทธิ์ส่งออก / TLS / presigned URL | `route-policy.test.mjs`, `auth.test.mjs`, `authorize.test.mjs` ผ่าน 95/95; `attachmentRules.mjs` (`UPLOAD/DOWNLOAD_URL_TTL_SECONDS = 300`) | ไม่ต้องแก้ (คง control เดิม) |
| **§4.3 Availability** | Backup retention และ RPO/RTO | พบ `backup_retention_period = 0` จริงใน `tfstate`, `multi_az = false`, เลือก Backup & Restore | ตั้ง `backup_retention_period = 1` ใน `rds.tf` (พร้อม `apply_immediately` / ตรวจสิทธิ์ใน Lab) |
| **§4.4 Scalability** | `max_connections` และเพดาน Lambda concurrency | `db.mjs` `MAX_CONNECTIONS = 5`, `reserved_concurrent_executions = -1`, สูตร Module10 ได้เพดาน ~16 contexts (formula-derived; ไม่ได้ query สด) | ปรับ `MAX_CONNECTIONS` ใน `db.mjs` (เช่น 5→2) และ/หรือกำหนด `reserved_concurrent_executions` ตามโควตาบัญชี |
| **§4.5 Performance** | ผล Baseline และหลังปรับ V6 | อ้างอิง `docs/evidence/v6-01-employers-baseline/`, `v6-02-bottleneck/` (PR #256), `v6-03/` | ไม่ต้องปรับเพิ่มใน #261 |
| **§4.6 Cost** | RDS size, No NAT, Lambda/API | `db.t4g.micro` (variables.tf) / `db.t3.micro` (tfvars fallback), S3 Gateway Endpoint แทน NAT | ไม่เพิ่ม paid resource (automated backup 1 วันอยู่ในโควตา storage 20 GB) |
| **§4.7 จุดชี้แจง (`lambda.tf`)** | รัน `terraform validate` ยืนยัน `599e48c` | `terraform validate` และ `terraform fmt -check` บน `main` (`286451c`) **ผ่าน 100%** | — |

---

## 3. รายการที่ระบุให้ Issue #261 (`[V7-01-3]`) ปรับปรุงจากผลของ #260

1. **`infra/terraform/rds.tf` — เปิด Automated Backup (`backup_retention_period = 1`):** แก้ความเสี่ยงจากค่าปัจจุบันที่ `backup_retention_period = 0` เพื่อเปิด Point-in-Time Recovery (RPO ≤ 5 นาที) โดยอยู่ในโควตาพื้นที่ backup ฟรีเท่าขนาด DB ที่จัดสรร (20 GB)
2. **`infra/terraform/variables.tf` — ล็อก `my_ip_cidr` ให้รับเฉพาะ `/32`:** ป้องกันความผิดพลาดแบบที่เคยพบ `0.0.0.0/0` ในหลักฐาน `190-06` โดยแก้ regex validation ให้รับเฉพาะ `/32`
3. **`infra/lambda/companies/db.mjs` และ/หรือ `infra/terraform/lambda.tf` — คุม Connection Ceiling ของ Lambda → RDS:** ลด `MAX_CONNECTIONS` ต่อ context หรือกำหนด `reserved_concurrent_executions` (โดยต้องตรวจข้อจำกัดโควตาบัญชี AWS Academy / Free Tier ที่บังคับเหลือ unreserved concurrency ≥ 10 ก่อน apply)

*(หมายเหตุ: ยังไม่ได้แก้ `docs/overview/V7-overview.md` ใน PR นี้เพื่อหลีกเลี่ยง merge conflict กับ PR [#265](https://github.com/KaylahJin/CS361-Project/pull/265) ที่เปิดรอรีวิวอยู่ เมื่อ #265 merge แล้วสามารถลิงก์มายังโฟลเดอร์ `docs/evidence/v7-01/` ได้ทันที)*
