import React from 'react';
import { ArrowRight, ExternalLink  } from 'lucide-react';
import HistoricalSection from '../components/HistoricalSection';

export const Requirements: React.FC = () => {
  return (
    <main className="w-full min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-16 pb-8 sm:pt-20 sm:pb-12 text-center px-4">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
          <span className="text-blue-600">Cooperative Education </span>
          <span className="text-slate-950">Requirements</span>
        </h1>
        <p className="mt-3 text-xl sm:text-2xl font-bold text-slate-900">
          เกณฑ์และคุณสมบัติสหกิจศึกษา
        </p>
      </section>

      {/* Content Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        
        {/* Metadata Information Block */}
        <div className="text-xs sm:text-sm text-slate-600 space-y-1.5 mb-12">
          <p className="font-medium text-slate-700 mb-2">
            ข้อมูลเกณฑ์และคุณสมบัติสำหรับนักศึกษาที่ประสงค์เข้าร่วมสหกิจศึกษา
          </p>
          <p>
            <span className="font-semibold text-slate-800">ปีการศึกษา:</span> 2568
          </p>
          <p>
            <span className="font-semibold text-slate-800">มีผลตั้งแต่:</span> ภาคการศึกษาที่ 1
          </p>
          <p>
            <span className="font-semibold text-slate-800">อัปเดตล่าสุด:</span> 01/09/2569
          </p>
          <p>
            <span className="font-semibold text-slate-800">แหล่งข้อมูล: </span> 
              <a
                href="https://sites.google.com/sci.tu.ac.th/computerscience-cstuco-opstudy/admission-criteria"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
              >
                เกณฑ์รับสมัครเข้าแผนสหกิจศึกษา
                <ExternalLink className="w-3.5 h-3.5 inline" />
              </a>
          </p>
        </div>

        {/* Section 1: Basic Eligibility */}
        <section className="mb-12">
          <div className="border-b border-slate-200 pb-2 mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Basic Eligibility
            </h2>
            <h3 className="text-sm sm:text-base font-bold text-blue-600">
              คุณสมบัติเบื้องต้น
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mb-3">
            นักศึกษาควรตรวจสอบว่าตนเองมีคุณสมบัติตามเกณฑ์ที่กำหนดก่อนดำเนินการสมัครสหกิจศึกษา
          </p>
          <ul className="text-xs sm:text-sm text-slate-600 space-y-2">
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>มีสถานภาพเป็นนักศึกษาปัจจุบันของสาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์ฯ ม.ธรรมศาสตร์</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>เป็นผู้ที่กำลังศึกษาอยู่ในชั้นปีที่ 3 ขึ้นไป</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>มีผลการเรียนเฉลี่ยสะสม (GPA) ไม่ต่ำกว่า 2.75</span>
            </li>
          </ul>
        </section>

        {/* Section 2: Academic Requirements */}
        <section className="mb-12">
          <div className="border-b border-slate-200 pb-2 mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Academic Requirements
            </h2>
            <h3 className="text-sm sm:text-base font-bold text-blue-600">
              รายวิชาและเงื่อนไขทางการศึกษา
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mb-4">
            รายวิชาหรือเงื่อนไขที่นักศึกษาต้องผ่านก่อนออกสหกิจศึกษา
          </p>

          <div className="border border-slate-200 rounded-lg overflow-hidden text-xs sm:text-sm">
            <div className="grid grid-cols-[80px_1fr_1fr] bg-slate-50 border-b border-slate-200 px-4 py-2.5 font-bold text-slate-900">
              <div>หลักสูตร</div>
              <div>รายการ</div>
              <div>เงื่อนไข</div>
            </div>
            <div className="divide-y divide-slate-100 bg-white">
              <div className="grid grid-cols-[80px_1fr_1fr] px-4 py-2.5 text-slate-600">
                <div>61</div>
                <div><b>เคยศึกษา</b> วิชา คพ.101, คพ.102, คพ.111, (คพ.213 หรือ 216), คพ.251 และ คพ.264</div>
                <div>เกรดเฉลี่ยรวมไม่ต่ำกว่า 2.5</div>
              </div>
              <div className="grid grid-cols-[80px_1fr_1fr] px-4 py-2.5 text-slate-600">
                <div></div>
                <div><b>กำลังศึกษาหรือเคยศึกษา</b> วิชา คพ.384 และ วิชา (คพ.266 หรือ 322 หรือ 348)</div>
                <div></div>
              </div>
              <div className="grid grid-cols-[80px_1fr_1fr] px-4 py-2.5 text-slate-600">
                <div></div>
                <div>ก่อนออกไปปฏิบัติงานจริงจะต้องสอบได้วิชา คพ.302</div>
                <div></div>
              </div>
              <div className="grid grid-cols-[80px_1fr_1fr] px-4 py-2.5 text-slate-600">
                <div>66</div>
                <div><b>เคยศึกษา</b> วิชา คพ.100, คพ.101, คพ.102, คพ.111, (คพ.213 หรือ 216), คพ.251 และ คพ.261</div>
                <div>เกรดเฉลี่ยรวมไม่ต่ำกว่า 2.5</div>
              </div>
              <div className="grid grid-cols-[80px_1fr_1fr] px-4 py-2.5 text-slate-600">
                <div></div>
                <div><b>กำลังศึกษาหรือเคยศึกษา</b> วิชา คพ.180 และ วิชา (คพ.262 หรือ 331 หรือ 240)</div>
                <div></div>
              </div>
              <div className="grid grid-cols-[80px_1fr_1fr] px-4 py-2.5 text-slate-600">
                <div></div>
                <div>ก่อนออกไปปฏิบัติงานจริงจะต้องสอบได้วิชา คพ.301</div>
                <div></div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Preparation Requirements */}
        <section className="mb-12">
          <div className="border-b border-slate-200 pb-2 mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Preparation Requirements
            </h2>
            <h3 className="text-sm sm:text-base font-bold text-blue-600">
              การเตรียมความพร้อม
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mb-3">
            ก่อนเข้าสู่กระบวนการสหกิจ นักศึกษาอาจต้องดำเนินการหรือผ่านกิจกรรมเตรียมความพร้อมตามที่สาขากำหนด
          </p>
          <ul className="text-xs sm:text-sm text-slate-600 space-y-2">
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>เข้าร่วมช่องทางสื่อสารในการดำเนินการสหกิจศึกษา</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>ลงทะเบียนและสอบผ่านวิชา คพ.302 เตรียมสหกิจศึกษา</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <div>
                <span>เอกสารต่าง ๆ ที่ต้องเตรียม มีดังนี้</span>
                <ul className="mt-2 ml-4 space-y-2">
                  <li className="flex items-start">
                    <span className="mr-2 text-slate-400">•</span>
                    <span>
                      <b>รูปถ่ายนักศึกษาในชุดสุภาพ</b> หน้าตรง เห็นใบหน้าชัดเจนจนถึงหน้าอกช่วงบน
                      (ตั้งชื่อ xxxxxxxxxx_photo.jpg โดย xxxxxxxxxxx คือรหัสนักศึกษา)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 text-slate-400">•</span>
                    <span>
                      <b>ทรานสคริปต์แสดงประวัติการลงทะเบียน</b> และผลการศึกษาตั้งแต่ภาคการเรียนแรกที่เข้าศึกษา
                      จนถึงภาคเรียนที่สมัครเข้าแผนสหกิจศึกษา
                      (สามารถ save ไฟล์ PDF จากหน้าเว็บในระบบสำนักทะเบียน reg.tu.ac.th ได้
                      ตั้งชื่อ xxxxxxxxxx_transcript.pdf)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 text-slate-400">•</span>
                    <span>
                      <b>Resume หรือ Curriculum Vitae (CV)</b> แสดงประวัติและประสบการณ์ย่อของนักศึกษา
                      (ตั้งชื่อ xxxxxxxxxx_resume.pdf หรือ xxxxxxxxxx_cv.pdf)
                    </span>
                  </li>
                </ul>
              </div>
            </li>
          </ul>
        </section>

        {/* Section 4: Employer Requirements
        <section className="mb-12">
          <div className="border-b border-slate-200 pb-2 mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Employer Requirements
            </h2>
            <h3 className="text-sm sm:text-base font-bold text-blue-600">
              เกณฑ์เกี่ยวกับสถานประกอบการ
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mb-3">
            สถานประกอบการหรือตำแหน่งที่นักศึกษาเลือกควรเป็นไปตามเงื่อนไขของสาขาวิชา
          </p>
          <ul className="text-xs sm:text-sm text-slate-600 space-y-2">
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>ลักษณะงาน: [ต้องเกี่ยวข้องกับสาขา / เงื่อนไข]</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>ระยะเวลาสหกิจ: […]</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>ช่วงเวลาปฏิบัติงาน: […]</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>ผู้ดูแลหรือพี่เลี้ยงจากสถานประกอบการ: […]</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>เงื่อนไขอื่น ๆ: […]</span>
            </li>
          </ul>
          <p className="text-xs text-slate-400 mt-3">
            หากสถานประกอบการที่สนใจยังไม่มีอยู่ในข้อมูลของสาขา อาจต้องดำเนินการเสนอหรือขอพิจารณาตามขั้นตอนที่กำหนด
          </p>
        </section> */}

        {/* Section 5: Required Documents */}
        <section className="mb-12">
          <div className="border-b border-slate-200 pb-2 mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Required Documents
            </h2>
            <h3 className="text-sm sm:text-base font-bold text-blue-600">
              เอกสารที่เกี่ยวข้อง
            </h3>
          </div>
          <ul className="text-xs sm:text-sm text-slate-600 space-y-2">
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>แบบคำร้องขอสมัครเข้าแผนสหกิจศึกษา</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>แบบฟอร์มนักศึกษาแจ้งข้อมูลสถานประกอบการเพื่อพิจารณาขึ้นทะเบียน</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>แบบฟอร์มนักศึกษาแจ้งข้อมูลผลการสมัครเข้าปฏิบัติงานสหกิจศึกษา</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2 text-slate-400">•</span>
              <span>แบบฟอร์มนักศึกษาแจ้งสถานะการสมัครเข้าปฏิบัติงานสหกิจศึกษา </span>
            </li>
          </ul>
          <div className="mt-3">
            <a
              href="#all-documents"
              className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
            >
              ดูรายละเอียดเอกสารทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>

        {/* Section 6: Important Notes */}
        <section className="mb-12">
          <div className="border-b border-slate-200 pb-2 mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Important Notes
            </h2>
            <h3 className="text-sm sm:text-base font-bold text-blue-600">
              ข้อควรทราบ
            </h3>
          </div>
          <div className="text-xs sm:text-sm text-slate-600 space-y-1.5 leading-relaxed">
            <p>เกณฑ์อาจมีการเปลี่ยนแปลงในแต่ละปีการศึกษา</p>
            <p>ควรตรวจสอบข้อมูลของปีการศึกษาที่ตนเองจะออกสหกิจ</p>
            <p>หากข้อมูลในหน้านี้ไม่ตรงกับประกาศทางการ ให้ยึดข้อมูลจากแหล่งต้นทางที่สาขากำหนด</p>
          </div>
        </section>

        {/* Section 7: Historical Data (Shared Component) */}
        <HistoricalSection />

      </div>
    </main>
  );
};

export default Requirements;
