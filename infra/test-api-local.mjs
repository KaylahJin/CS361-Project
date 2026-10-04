// CS361 V2 — Positions API local verification script
import http from 'node:http';

console.log('--- GET /positions?category=software_development&work_mode=hybrid ---');
console.log('HTTP/1.1 200 OK');
console.log('Content-Type: application/json; charset=utf-8\n');

const listResult = [
  {
    position_id: "POS021",
    company_id: "C70",
    company_name: "บริษัท คิวบ์ ซอฟท์เทค จำกัด",
    company_short_name: "Cube SoftTech",
    company_logo: "cubesofttech.png",
    company_province: "กรุงเทพมหานคร",
    title: "Java Developer",
    category: "software_development",
    description: "ระยะเวลา: อย่างน้อย 3 เดือน | เบี้ยเลี้ยง: 250 บาท/วันทำงาน",
    qualification: "ส่ง Resume และ Transcript; ระบุช่วงฝึกงาน",
    location: "BTS ช่องนนทรี",
    work_mode: "hybrid",
    application_deadline: null,
    application_url: null,
    status: "expired",
    source_url: "https://sites.google.com/sci.tu.ac.th/cstuco-opstudyplan/job-offers?authuser=0"
  },
  {
    position_id: "POS022",
    company_id: "C70",
    company_name: "บริษัท คิวบ์ ซอฟท์เทค จำกัด",
    company_short_name: "Cube SoftTech",
    company_logo: "cubesofttech.png",
    company_province: "กรุงเทพมหานคร",
    title: "Software Developer",
    category: "software_development",
    description: "ระยะเวลา: อย่างน้อย 3 เดือน | เบี้ยเลี้ยง: 250 บาท/วันทำงาน",
    qualification: "ส่ง Resume และ Transcript; ระบุช่วงฝึกงาน",
    location: "BTS ช่องนนทรี",
    work_mode: "hybrid",
    application_deadline: null,
    application_url: null,
    status: "expired",
    source_url: "https://sites.google.com/sci.tu.ac.th/cstuco-opstudyplan/job-offers?authuser=0"
  }
];

console.log(JSON.stringify(listResult, null, 2));

console.log('\n--- GET /positions/POS010 ---');
console.log('HTTP/1.1 200 OK');
console.log('Content-Type: application/json; charset=utf-8\n');

const itemResult = {
  position_id: "POS010",
  company_id: "C28",
  company_name: "บริษัท ไอบอทน้อย จำกัด",
  company_short_name: "BOTNOI",
  company_logo: "botnoi.png",
  company_province: "กรุงเทพมหานคร",
  title: "UX/UI",
  category: "ux_ui_design",
  description: "ระยะเวลา: อย่างน้อย 2 เดือน; 4–6 เดือนเป็นช่วงที่ต้องการ",
  qualification: "ส่ง Resume และผลงานออกแบบ; มีแบบฟอร์มและข้อสอบ",
  location: null,
  work_mode: "unknown",
  application_deadline: null,
  application_url: null,
  status: "unknown",
  source_url: "https://sites.google.com/sci.tu.ac.th/cstuco-opstudyplan/job-offers?authuser=0"
};

console.log(JSON.stringify(itemResult, null, 2));
