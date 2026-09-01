import React from 'react';
import { AlertCircle, Calendar, CheckCircle2, AlertTriangle } from 'lucide-react';
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
        
        {/* Prominent Notice Banner: Current year criteria not updated yet */}
        <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-900 shadow-xs flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-amber-950">
                สถานะข้อมูล: เกณฑ์ปีการศึกษาปัจจุบัน (2569) ยังไม่อัปเดต
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-200/80 text-amber-900 rounded-full">
                อ้างอิงข้อมูลปีก่อนหน้า
              </span>
            </div>
            <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
              ข้อมูลเกณฑ์และคุณสมบัติที่แสดงด้านล่างนี้เป็น <strong>เกณฑ์ของปีการศึกษา 2568 (ปีก่อนหน้า)</strong> เพื่อให้นักศึกษาใช้เป็นแนวทางในการเตรียมตัว โปรดรอประกาศเกณฑ์ทางการของปีการศึกษา 2569 อีกครั้ง
            </p>
          </div>
        </div>

        {/* Section Header & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-8 border-b border-slate-200 gap-3">
          <div>
            <div className="inline-block px-3.5 py-1.5 bg-slate-100 text-slate-900 font-bold text-base sm:text-lg rounded-xl mb-1.5">
              เกณฑ์รับสมัครเข้าแผนสหกิจศึกษา
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-500">
              ปีการศึกษา 2568
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80 w-fit">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>รอกำหนดการเกณฑ์ปี 2569</span>
          </div>
        </div>

        {/* Criteria List */}
        <div className="space-y-6 text-slate-800">
          
          {/* Item 1 */}
          <div className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs sm:text-sm shrink-0 mt-0.5 border border-blue-100">
              1
            </span>
            <div className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed pt-0.5">
              เป็นนักศึกษาสาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์ฯ ม.ธรรมศาสตร์
            </div>
          </div>

          {/* Item 2 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-start gap-3.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs sm:text-sm shrink-0 mt-0.5 border border-blue-100">
                2
              </span>
              <div className="font-bold text-xs sm:text-sm text-slate-900 pt-0.5">
                เคยศึกษาวิชา ดังนี้
              </div>
            </div>

            <div className="ml-10 space-y-2.5 text-xs sm:text-sm">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed">
                <span className="font-bold text-blue-700 block sm:inline mr-1.5">• หลักสูตร 61:</span>
                <span>เคยศึกษา วิชา คพ.101, คพ.102, คพ.111, (คพ.213 หรือ 216), คพ.251 และ คพ.264 โดยที่เกรดเฉลี่ยของรายวิชากลุ่มนี้</span>
                <span className="font-bold text-slate-900 ml-1">ไม่ต่ำกว่า 2.5</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed">
                <span className="font-bold text-indigo-700 block sm:inline mr-1.5">• หลักสูตร 66:</span>
                <span>เคยศึกษา วิชา คพ.100, คพ.101, คพ.102, คพ.111, (คพ.213 หรือ 216), คพ.251 และ คพ.261 โดยที่เกรดเฉลี่ยของรายวิชากลุ่มนี้</span>
                <span className="font-bold text-slate-900 ml-1">ไม่ต่ำกว่า 2.5</span>
              </div>
            </div>
          </div>

          {/* Item 3 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-start gap-3.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs sm:text-sm shrink-0 mt-0.5 border border-blue-100">
                3
              </span>
              <div className="font-bold text-xs sm:text-sm text-slate-900 pt-0.5">
                กำลังศึกษา หรือเคยศึกษาวิชา ดังนี้
              </div>
            </div>

            <div className="ml-10 space-y-2.5 text-xs sm:text-sm">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed">
                <span className="font-bold text-blue-700 block sm:inline mr-1.5">• หลักสูตร 61:</span>
                <span>กำลังศึกษา หรือเคยศึกษาวิชา คพ.384 และ วิชา (คพ.266 หรือ 322 หรือ 348)</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed">
                <span className="font-bold text-indigo-700 block sm:inline mr-1.5">• หลักสูตร 66:</span>
                <span>กำลังศึกษา หรือเคยศึกษาวิชา คพ.180 และ วิชา (คพ.262 หรือ 331 หรือ 240)</span>
              </div>
            </div>
          </div>

          {/* Item 4 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-start gap-3.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs sm:text-sm shrink-0 mt-0.5 border border-blue-100">
                4
              </span>
              <div className="font-bold text-xs sm:text-sm text-slate-900 pt-0.5">
                รับทราบว่าจะต้องสอบได้วิชา ดังนี้ ก่อนออกไปปฏิบัติงานจริง ณ สถานประกอบการ
              </div>
            </div>

            <div className="ml-10 space-y-2.5 text-xs sm:text-sm">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed">
                <span className="font-bold text-blue-700 mr-1.5">• หลักสูตร 61:</span>
                <span>จะต้องสอบได้วิชา <span className="font-semibold text-slate-900">คพ.302</span></span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed">
                <span className="font-bold text-indigo-700 mr-1.5">• หลักสูตร 66:</span>
                <span>จะต้องสอบได้วิชา <span className="font-semibold text-slate-900">คพ.301</span></span>
              </div>
            </div>
          </div>

          {/* Item 5 */}
          <div className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs sm:text-sm shrink-0 mt-0.5 border border-blue-100">
              5
            </span>
            <div className="text-xs sm:text-sm text-slate-800 leading-relaxed pt-0.5">
              <span>มีผลการเรียนเฉลี่ยสะสม (GPA) เมื่อสิ้นภาคการศึกษาสุดท้ายก่อนสมัครเข้าเป็นนักศึกษาสหกิจศึกษา </span>
              <span className="font-bold text-slate-900">ไม่ต่ำกว่า 2.75</span>
            </div>
          </div>

          {/* Item 6 */}
          <div className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs sm:text-sm shrink-0 mt-0.5 border border-blue-100">
              6
            </span>
            <div className="text-xs sm:text-sm text-slate-800 leading-relaxed pt-0.5 font-medium">
              มีความประพฤติเรียบร้อย ไม่เคยถูกลงโทษทางวินัยนักศึกษา
            </div>
          </div>

          {/* Item 7 */}
          <div className="flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs sm:text-sm shrink-0 mt-0.5 border border-blue-100">
              7
            </span>
            <div className="text-xs sm:text-sm text-slate-800 leading-relaxed pt-0.5 font-medium">
              รับทราบเกณฑ์และลงนามยอมรับว่าจะปฏิบัติตามเงื่อนไขและกระบวนการสหกิจศึกษาอย่างครบถ้วน
            </div>
          </div>

        </div>

        {/* Selection Process and Conditions Card */}
        <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-blue-50/60 border border-blue-100/90 text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-blue-900 text-sm sm:text-base">
            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
            <span>เงื่อนไขการคัดเลือกเข้าแผนสหกิจศึกษา</span>
          </div>
          <p className="pt-1">
            นักศึกษาที่ผ่านคุณสมบัติข้างต้นมีสิทธิ์ในการสมัครเพื่อคัดเลือกเข้าแผนสหกิจฯ เท่านั้น และจะไม่พิจารณานักศึกษาที่ไม่สามารถตรวจสอบได้ว่ามีคุณสมบัติครบถ้วน
          </p>
          <p>
            การคัดเลือกนักศึกษาเข้าแผนสหกิจฯ จะทำโดยคณะกรรมการบริหารสหกิจฯ ของสาขาวิชาฯ โดยจำนวนของนักศึกษาที่ได้รับการคัดเลือกขึ้นอยู่กับคุณสมบัติของนักศึกษา และภาระงานของอาจารย์ในสาขาวิชาฯ
          </p>
          <p className="font-bold text-slate-900 pt-1">
            ผลการคัดเลือกจากคณะกรรมการบริหารสหกิจฯ ถือเป็นที่สิ้นสุด
          </p>
        </div>

        {/* Note (Red Box) */}
        <div className="mt-6 p-4 rounded-xl bg-rose-50/70 border border-rose-200/80 text-rose-700 text-xs sm:text-sm font-medium flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span>
            <strong>หมายเหตุ :</strong> ขอสงวนสิทธิ์ในการเปลี่ยนแปลงข้อมูลตามความเหมาะสมสำหรับการจัดการโครงการสหกิจศึกษาในแต่ละปีการศึกษา โดยไม่แจ้งล่วงหน้า
          </span>
        </div>

        {/* Historical Data Section */}
        <HistoricalSection />

      </div>
    </main>
  );
};

export default Requirements;
