import React, { useState } from 'react';
import { FileEdit, Building2, Flag, ArrowRight } from 'lucide-react';

export const Home: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<string>('2568');
  const years = ['2568', '2567', '2566', '2565'];

  return (
    <main className="w-full min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-16 pb-12 sm:pt-20 sm:pb-16 text-center px-4">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
          <span className="text-blue-600 block sm:inline">Cooperative Education </span>
        </h1>
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-950 tracking-tight mt-1 sm:mt-2">
          Planning & Management System
        </h2>
        <p className="mt-5 text-xl sm:text-2xl font-bold text-slate-900">
          ระบบจัดการแผนสหกิจศึกษา
        </p>
      </section>

      {/* Main Content Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Timeline Section */}
        <section className="mt-8">
          {/* Section Header */}
          <div className="mb-10 sm:mb-12">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              กำหนดการสหกิจศึกษา ปี 2569
            </h3>
          </div>

          {/* Steps Flow Grid */}
          <div className="relative">
            {/* SVG Connecting Arches (Desktop) */}
            <div className="hidden md:block absolute top-6 left-0 right-0 h-16 pointer-events-none z-0">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 700 60">
                {/* Arch 1 -> 2 */}
                <path
                  d="M 170 30 Q 260 0 320 30"
                  fill="none"
                  stroke="#93c5fd"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                {/* Arch 2 -> 3 */}
                <path
                  d="M 380 30 Q 470 0 530 30"
                  fill="none"
                  stroke="#93c5fd"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              </svg>
            </div>

            {/* 3 Step Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 relative z-10">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100/80 shadow-2xs flex items-center justify-center transition-transform hover:scale-105">
                  <FileEdit className="w-6 h-6 text-rose-400 stroke-[1.8]" />
                </div>
                <h4 className="mt-4 font-bold text-slate-900 text-sm sm:text-base">
                  ยื่นแผนสหกิจศึกษา
                </h4>
                <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-800">
                  รอกำหนดการ
                </p>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-[220px]">
                  นักศึกษาจะต้องยื่นข้อมูล<br />
                  สถานประกอบการ ตำแหน่ง<br />
                  และแผนสหกิจให้สาขาพิจารณา
                </p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100/80 shadow-2xs flex items-center justify-center transition-transform hover:scale-105">
                  <Building2 className="w-6 h-6 text-indigo-400 stroke-[1.8]" />
                </div>
                <h4 className="mt-4 font-bold text-slate-900 text-sm sm:text-base">
                  สมัครกับสถานประกอบการ
                </h4>
                <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-800">
                  ติดตามกำหนดการจากสถานประกอบการ
                </p>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-[220px]">
                  นักศึกษาต้องดำเนินการสมัครกับสถ<br />
                  านประกอบการตามที่สถานประกอบ<br />
                  การกำหนด
                </p>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100/80 shadow-2xs flex items-center justify-center transition-transform hover:scale-105">
                  <Flag className="w-6 h-6 text-purple-400 stroke-[1.8]" />
                </div>
                <h4 className="mt-4 font-bold text-slate-900 text-sm sm:text-base">
                  เริ่มปฏิบัติสหกิจศึกษา
                </h4>
                <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-800">
                  รอกำหนดการ
                </p>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-[220px]">
                  เริ่มปฏิบัติงานสหกิจศึกษาตามรอบ<br />
                  ของปีการศึกษานั้น
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Historical Data Section */}
        <section className="mt-16 pt-6">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4">
            ข้อมูลย้อนหลัง
          </h3>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm font-bold text-slate-900 mr-1">
              ปีการศึกษา:
            </span>

            {years.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-3 py-1 text-xs sm:text-sm rounded-md border transition-all duration-150 cursor-pointer font-medium ${
                  selectedYear === year
                    ? 'border-blue-300 text-blue-700 bg-blue-50/70 shadow-2xs'
                    : 'border-slate-200 text-slate-700 hover:border-blue-200 hover:bg-slate-50'
                }`}
              >
                {year}
              </button>
            ))}

            <button
              onClick={() => {}}
              className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 ml-1 cursor-pointer transition"
            >
              ดูทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            ใช้สำหรับตรวจสอบเกณฑ์ในปีก่อนหน้าเท่านั้น ไม่ควรใช้แทนข้อมูลของปีการศึกษาปัจจุบัน
          </p>
        </section>

        {/* Last Updated */}
        <div className="mt-24 mb-10 text-center">
          <span className="text-xs text-slate-400 tracking-wide">
            อัปเดตล่าสุด -/-/2569
          </span>
        </div>
      </div>
    </main>
  );
};

export default Home;