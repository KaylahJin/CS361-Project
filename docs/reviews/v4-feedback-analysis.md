# V4 Feedback Analysis

## 1. Overview

เอกสารนี้รวบรวม Feedback และปัญหาที่พบจากการพัฒนาและทดสอบระบบ V4 รวมถึงงานจาก Milestone ก่อนหน้าที่ยังดำเนินการไม่เสร็จ เพื่อกำหนดขอบเขตการปรับปรุงใน Milestone **V4-feedback**

เป้าหมายของรอบนี้คือปิดงานค้างที่มีผลต่อการทำงานหลักของระบบ ตรวจสอบความถูกต้องของ Workflow และข้อมูล รวมถึงทดสอบระบบหลังรวมการแก้ไข โดยไม่สร้าง Issue ซ้ำกับงานเดิม

## 2. Feedback Analysis

จากการตรวจสอบ Issue และเอกสารที่เกี่ยวข้อง พบว่างานที่ยังต้องติดตามแบ่งได้เป็นกลุ่มหลักดังนี้

| ด้าน | ปัญหา / งานที่ต้องดำเนินการ | ความสำคัญ |
|---|---|---|
| Workflow | ขั้นตอน Advisor → Coordinator → Committee ต้องทำงานครบตาม Role และเงื่อนไขที่กำหนด | สูง |
| Criteria & Quota | เกณฑ์คุณสมบัติและจำนวนรับต้องถูกต้องและรองรับข้อมูลแยกตาม Period | สูง |
| Database & Import | Schema, Migration และการนำเข้าข้อมูลต้องไม่ทำให้ข้อมูลเดิมสูญหายหรือถูกเขียนทับด้วย NULL | สูง |
| Testing | ต้องทดสอบ Flow หลักของทุก Role และตรวจ Regression หลังรวมการแก้ไข | สูง |
| Frontend | มีบั๊กการ Refresh หน้าและเครื่องมือค้นหาที่แสดงผิด Role | กลาง |

### 2.1 งานที่ต้องให้ความสำคัญ

1. **Workflow:** ตรวจสอบว่าการรับรอง การตรวจสอบคุณสมบัติ และการคัดเลือกแยกตาม Role และลำดับขั้นตอนถูกต้อง
2. **Criteria & Quota:** ตรวจสอบเกณฑ์และจำนวนรับ รวมถึงข้อมูลที่ใช้ทดสอบให้ตรงกับ Requirement
3. **Database & Import:** ตรวจสอบ Schema หลัง Migration และป้องกันการ Import ที่ทำให้ข้อมูลเดิมสูญหาย
4. **QA:** ทดสอบ Flow หลักหลังรวมการแก้ไข พร้อมบันทึกผลและหลักฐาน
5. **UI Bugs:** แก้ปัญหาที่พบจากการทดสอบจริง โดยไม่ขยายขอบเขตเป็น Feature ใหม่

## 3. Existing Issues to Continue

รายการต่อไปนี้เป็น Issue ที่มีอยู่แล้ว จึงไม่สร้าง Issue ใหม่ซ้ำ ให้ตรวจสอบและดำเนินงานต่อจาก Issue เดิม รวมถึงย้ายเข้า Milestone V4-feedback ตามการจัดการของทีม

| Issue | งาน | ขอบเขตที่ต้องตรวจสอบ |
|---|---|---|
| #146 | ขั้นพิจารณาใหม่ (รับรอง → ตรวจ → คัดเลือก) | Workflow ของ Advisor, Coordinator และ Committee รวมถึงสถานะและสิทธิ์ |
| #150 | เกณฑ์และข้อมูลทดสอบ | Criteria, Quota, Seed และข้อมูลสำหรับทดสอบ |
| #153 | สร้างฐานข้อมูลใหม่และ Import | Schema, Constraint และการป้องกัน NULL overwrite |
| #154 | ทดสอบรวมก่อนปิด Milestone | Self-test และ Flow ของทุก Role |
| #200 | Refresh แล้วถูกเด้งกลับหน้าแรก | คงหน้าปัจจุบันหลัง Refresh |
| #203 | เครื่องมือค้นหาแสดงในฝั่งนักศึกษา | จำกัดการแสดงเครื่องมือค้นหาตาม Role |

**หมายเหตุ:** ปัจจุบัน #153, #200 และ #203 อยู่ใน Milestone `V4 - Feedback` แล้ว โดยคง Assignee และรายละเอียดเดิมไว้

## 4. New Issues

จาก Issue ที่ตรวจสอบ ยังไม่พบงานใหม่ที่จำเป็นต้องสร้างแยกจากงานเดิมในทันที เนื่องจากประเด็นหลักมี Issue รองรับอยู่แล้ว

หากพบปัญหาเพิ่มเติมระหว่างการดำเนินงาน ให้สร้าง Bug Issue ตาม Template ของทีม โดยระบุขั้นตอนที่ทำให้พบ ผลลัพธ์ที่คาดหวัง ผลลัพธ์จริง และ Issue ต้นทางให้ชัดเจน

## 5. Scope

### In Scope

- ดำเนินงาน Workflow และ Criteria ตาม #146 และ #150
- ดำเนินงาน Database / Schema / Import ตาม #153
- ทดสอบระบบรวมตาม #154
- แก้ Bug ที่พบและมี Issue รองรับ ได้แก่ #200 และ #203
- ตรวจ Regression ของ Flow ที่ได้รับผลกระทบจากการแก้ไข

### Deferred

- Feature ใหม่ที่ไม่จำเป็นต่อการปิดงานค้าง
- การเปลี่ยน State Model หรือ Workflow ที่ไม่มี Requirement รองรับ
- การปรับปรุง UI ที่ไม่กระทบการใช้งานหลัก
- งานที่ไม่สามารถดำเนินการได้ภายในเวลาของ Milestone ให้บันทึกเหตุผลและข้อจำกัดไว้

## 6. Completion Criteria

- งานเดิมที่อยู่ใน Scope ได้รับการดำเนินการและมีหลักฐานตาม Acceptance Criteria ของแต่ละ Issue
- Workflow หลักทำงานได้ตาม Role และลำดับที่กำหนด
- Database และ Import ไม่ทำให้ข้อมูลเดิมสูญหายหรือเกิดความไม่สอดคล้อง
- TC1 และ TC2 มีผลทดสอบตาม Expected Result ใน [V4 Overview](../overview/V4-overview.md)
- RT1–RT5 มีผลทดสอบตามเงื่อนไขที่กำหนดใน V4 Overview
- REL1–REL6 มีผลทดสอบตามเงื่อนไขที่กำหนดใน V4 Overview
- ทุกกรณีทดสอบระบุผล Pass / Fail / Not Run พร้อมวันที่ สภาพแวดล้อม และหลักฐานที่ตรวจสอบได้
- กรณี Not Run ต้องระบุเหตุผลและข้อจำกัดที่ทำให้ไม่สามารถทดสอบได้ โดยไม่กล่าวอ้างว่าผ่านการทดสอบ
- Blocker ที่ขัดขวางกระบวนการหลักต้องแยกจาก Known Issue โดยระบุผลกระทบและแนวทางจัดการให้ชัดเจน
- Blocker ต้องได้รับการแก้ไข หรือมีข้อสรุปจากทีมว่าจะจัดการอย่างไร พร้อมบันทึก Issue ที่เกี่ยวข้องหากต้องเลื่อนการแก้ไข
- Bug ที่ยังไม่แก้ไขและไม่ใช่ Blocker ถูกบันทึกเป็น Known Issue พร้อมผลกระทบและ Issue ที่เกี่ยวข้อง (ถ้ามี)
- ไม่มีการปิด Issue โดยไม่มีหลักฐานรองรับ

## 7. References

- [V3 Feedback Analysis #125](https://github.com/KaylahJin/CS361-Project/issues/125)
- [V4 Overview](../overview/V4-overview.md)
- [V4 Issue Breakdown](../overview/V4-Issue.md)
- [Working Agreement](../working-agreement.md)

### Related Issues

- [#146 – Workflow](https://github.com/KaylahJin/CS361-Project/issues/146)
- [#150 – Criteria & Test Data](https://github.com/KaylahJin/CS361-Project/issues/150)
- [#153 – Database & Import](https://github.com/KaylahJin/CS361-Project/issues/153)
- [#154 – Integration Testing](https://github.com/KaylahJin/CS361-Project/issues/154)
- [#200 – Refresh Bug](https://github.com/KaylahJin/CS361-Project/issues/200)
- [#203 – Role-based Search UI](https://github.com/KaylahJin/CS361-Project/issues/203)