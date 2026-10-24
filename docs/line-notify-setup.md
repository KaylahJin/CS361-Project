# เปิดใช้บอทแจ้งเตือน LINE

บอท `LINE Notify` (`.github/workflows/line-notify.yml`) ส่งข้อความสั้น ๆ เข้าแชทส่วนตัวของแต่ละคนกับบอท LINE ของทีม ทุกวันเวลา 09:00 หน้าตาประมาณนี้

```text
รอคุณรีวิว 2 งาน
1. https://github.com/KaylahJin/CS361-Project/pull/128 ⚠️ เลยกำหนด 3 ชม.
2. https://github.com/KaylahJin/CS361-Project/pull/129 เหลือ 11 ชม.
```

แต่ละคนเห็นเฉพาะงานของตัวเอง คือ PR ที่รอให้รีวิว, PR ของตัวเองที่ถูกขอให้แก้ / check ไม่ผ่าน / ยังไม่ขอ reviewer, งานที่ block คนอื่น และ issue ที่ถืออยู่ใน milestone ส่วนคนวางแผนจะได้หัวข้อ "ต้องตาม" เพิ่ม เป็นรายการที่ผิดกติกาข้อ 4, 5 และ 7 (§10.1) งานที่ปิดหรือ merge แล้วจะหายจากข้อความรอบถัดไปเอง และวันไหนใครไม่มีงานค้าง บอทก็ไม่ส่งให้คนนั้น

LINE Notify ปิดบริการไปแล้วตั้งแต่ 31 มี.ค. 2025 บอทนี้จึงใช้ LINE Messaging API แทน แพ็กเกจฟรีของไทยส่งได้ 300 ข้อความต่อเดือน นับ 1 ข้อความต่อ 1 คนที่ได้รับ บอทส่งไม่เกินวันละ 5 ข้อความ เดือนหนึ่งจึงใช้ไม่เกิน 155 ข้อความ ก่อนเปิดใช้ ทุกรอบเป็น dry run คือแสดงข้อความใน job summary เท่านั้น ไม่ส่งเข้า LINE

## กติกาที่บอทใช้

- **รีวิว:** กำหนดเวลาคือ 24 ชม. นับจากตอนที่ขอ reviewer ครั้งล่าสุด
- **งานที่ block คนอื่น:** ติด label `blocking` ที่ issue บอทนับวันตั้งแต่วันที่ assign (วันนั้นคือวันที่ 1) ถ้าถึงวันที่ 2 แล้วยังไม่มี PR ที่เขียน `Closes #<เลข>` หรือมีชื่อ branch แบบ `<type>/<เลข>-...` บอทจะเตือนเจ้าของงาน ถ้าเลยวันที่ 2 ไปแล้วจะเตือนคนวางแผนด้วย
- **issue:** กำหนดส่งคือ due date ของ milestone
- **check:** นับเฉพาะ check ที่ ruleset `protect-main` บังคับ และ `PR Standards`
- **ชื่อเล่นและ milestone:** แก้ได้ใน `.github/scripts/line-notify-team.json`

## 1. สร้าง LINE Official Account (ใครในทีมทำก็ได้)

1. เข้า <https://manager.line.biz> แล้วสร้างบัญชีแบบฟรี ตั้งชื่อเช่น "CS361 Bot"
2. ไปที่ ตั้งค่า → Messaging API → เปิดใช้ Messaging API แล้วสร้าง provider ใหม่ เช่น "CS361 Team"
3. ไปที่ ตั้งค่า → การตอบกลับ แล้วเปิด Webhook (ต้องใช้ในขั้นที่ 3) ส่วนข้อความตอบกลับอัตโนมัติจะปิดก็ได้
4. ถ้าคนที่สร้างบัญชีไม่ใช่ @KaylahJin ให้เพิ่มเธอเป็น Admin ของ channel ที่ <https://developers.line.biz/console/> → channel → Roles

## 2. ออก channel access token (@KaylahJin)

ใน <https://developers.line.biz/console/> → channel → แท็บ Messaging API → Channel access token (long-lived) → Issue แล้วคัดลอกไปวางในขั้นที่ 4 ทันที **ห้ามส่ง token ทางแชทหรือ commit ลง repo** คนที่ได้ token สามารถส่งข้อความในนามบอทได้ ถ้าหลุดให้กด Reissue

## 3. เก็บ LINE userId ของทุกคน (ทำครั้งเดียว)

บอทจะส่งข้อความหาใครได้ คนนั้นต้องเป็นเพื่อนกับบอทก่อน และต้องรู้ userId ของคนนั้น (ขึ้นต้นด้วย `U` และใช้ได้กับบอทตัวนี้เท่านั้น) วิธีด้านล่างใช้ Google Sheet ส่วนตัวเป็น webhook ชั่วคราว ข้อมูลจึงไม่ผ่านเว็บของคนอื่น และไม่ต้องใส่ token

1. สร้าง Google Sheet ใหม่ แล้วไปที่ ส่วนขยาย → Apps Script วางโค้ดนี้แล้วบันทึก

   ```js
   function doPost(e) {
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
     for (const ev of JSON.parse(e.postData.contents).events) {
       sheet.appendRow([new Date(), ev.type, ev.source.userId, ev.message ? ev.message.text : '']);
     }
     return ContentService.createTextOutput('ok');
   }
   ```

2. กด ทำให้ใช้งานได้ → การทำให้ใช้งานได้รายการใหม่ → เว็บแอป ตั้ง "ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน" แล้วคัดลอก URL
3. นำ URL ไปใส่ที่ LINE Developers → แท็บ Messaging API → Webhook URL แล้วเปิด Use webhook (ถ้ากด Verify แล้วขึ้น 302 ไม่เป็นไร ข้อมูลยังเข้า sheet ตามปกติ)
4. ส่ง QR code ของบอท (LINE OA Manager → หน้าแรก → เพิ่มเพื่อน) ให้ทุกคน แต่ละคนเพิ่มเพื่อนแล้วพิมพ์ GitHub login ของตัวเองส่งให้บอท 1 ข้อความ
5. ดูใน sheet ว่า userId ไหนพิมพ์ login อะไร แล้วเรียงเป็น JSON 1 บรรทัด เช่น `{"KaylahJin":"U...","Pawit-Billamas":"U..."}`
6. เก็บเสร็จแล้วให้ลบ Webhook URL ใน LINE, ปิด Use webhook, กด เก็บถาวร (archive) การทำให้ใช้งานได้ใน Apps Script และลบ sheet ทิ้ง

## 4. เพิ่ม secret ใน GitHub (@KaylahJin)

repo นี้เป็น repo ส่วนตัว คนที่เพิ่ม secret ได้จึงมีแค่เจ้าของ repo ให้ไปที่ GitHub → Settings → Secrets and variables → Actions → New repository secret แล้วเพิ่ม 2 ตัว (หรือใช้ `gh secret set <ชื่อ> --repo KaylahJin/CS361-Project` ซึ่งถามค่าทีหลัง ค่าจึงไม่ค้างใน history ของ shell)

- `LINE_CHANNEL_ACCESS_TOKEN` = token จากขั้นที่ 2
- `LINE_USER_IDS` = JSON จากขั้นที่ 3

## 5. ทดลอง

1. Actions → LINE Notify → Run workflow แล้วเลือก `dry_run` ไว้ เปิดผลรันแล้วอ่านข้อความใน summary ว่าถูกต้อง
2. ถ้าอยากลองกับคนเดียวก่อน ให้ใส่ `LINE_USER_IDS` เฉพาะ userId ของคนนั้น (คนที่สร้าง channel ดู userId ของตัวเองได้ที่ LINE Developers → Basic settings → Your user ID) แล้วรันอีกรอบโดยเอา `dry_run` ออก บอทจะส่งจริงเฉพาะคนที่มี userId ส่วนคนอื่นจะขึ้นเป็นคำเตือนใน summary

## 6. เปิดใช้ทุกวัน

Settings → Secrets and variables → Actions → แท็บ Variables → เพิ่ม `LINE_NOTIFY_ENABLED` = `true` บอทจะส่งทุกวันเวลา 09:00 (GitHub อาจส่งช้ากว่านี้ไม่กี่นาที) ถ้าจะหยุดส่ง ให้เปลี่ยนค่าเป็น `false`
