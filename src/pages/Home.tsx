import React from 'react';
import { FileEdit, Building2, Flag, ArrowRight, Megaphone, ExternalLink, ArrowUpRight, FileSpreadsheet, FileText } from 'lucide-react';
import type { TabType } from '../components/Navbar';

interface HomeProps {
  onTabChange?: (tab: TabType) => void;
}

export const Home: React.FC<HomeProps> = ({ onTabChange }) => {
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-16">
        
        {/* Announcements & Updates Section */}
        <section className="mt-4">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                  <Megaphone className="w-4 h-4" />
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  ประกาศและอัปเดต
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                ข้อมูลข่าวสาร เอกสาร และเกณฑ์การดำเนินงานสหกิจศึกษาล่าสุด
              </p>
            </div>
          </div>

          {/* Announcement Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Card 1: เกณฑ์รับเข้าแผนสหกิจศึกษา (ไปหน้าเกณฑ์สหกิจ) */}
            <div
              onClick={() => onTabChange?.('requirements')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onTabChange?.('requirements');
                }
              }}
              className="group relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-white to-slate-50/60 border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all duration-200 cursor-pointer text-left"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-full">
                      เกณฑ์การรับเข้า
                    </span>
                    <span className="p-1 text-slate-400 group-hover:text-blue-600 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>

                <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  เกณฑ์รับเข้าแผนสหกิจศึกษา
                </h4>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  ข้อกำหนด คุณสมบัติผู้สมัคร และเงื่อนไขการคัดเลือกนักศึกษาเข้าสู่โครงการสหกิจศึกษา สาขาวิชาวิทยาการคอมพิวเตอร์
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="text-slate-400">หน้าเกณฑ์และคุณสมบัติ</span>
                <span className="font-medium text-blue-600 group-hover:underline flex items-center gap-1">
                  ดูเกณฑ์สหกิจ <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {/* Card 2: ทะเบียนสถานประกอบการปฏิบัติสหกิจศึกษา_2569 */}
            <a
              href="https://docs.google.com/spreadsheets/d/1mrexRW94TkVQUK91wLhqQtbEBResL4OBc9BWzcsvOjE/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col justify-between p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-white to-emerald-50/20 border border-slate-200/90 hover:border-emerald-300 hover:shadow-md transition-all duration-200"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full">
                      ปี 2569
                    </span>
                    <span className="p-1 text-slate-400 group-hover:text-emerald-600 transition-colors">
                      <ArrowUpRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>

                <h4 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                  ทะเบียนสถานประกอบการปฏิบัติสหกิจศึกษา 2569
                </h4>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  ตารางรวบรวมรายชื่อสถานประกอบการ ตำแหน่งงานที่เปิดรับ และรายละเอียดเงื่อนไขการรับสมัครสหกิจศึกษา ประจำปีการศึกษา 2569
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="text-slate-400">Google Sheets</span>
                <span className="font-medium text-emerald-600 group-hover:underline flex items-center gap-1">
                  เปิดตารางข้อมูล <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </a>
          </div>
        </section>

        {/* Timeline Section */}
        <section>
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

            <a
              href="https://sites.google.com/sci.tu.ac.th/cstuco-opstudyplan/job-offers?authuser=0#h.8irt0xkx73jp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs sm:text-sm rounded-md border border-blue-300 text-blue-700 bg-blue-50/70 hover:bg-blue-100/80 shadow-2xs font-medium transition-all duration-150 cursor-pointer"
            >
              2568 (2025)
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/*<a
              href="https://sites.google.com/sci.tu.ac.th/cstuco-opstudyplan/job-offers?authuser=0#h.8irt0xkx73jp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 ml-1 cursor-pointer transition"
            >
              ดูทั้งหมด <ArrowRight className="w-3.5 h-3.5" />
            </a>*/}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            ใช้สำหรับตรวจสอบเกณฑ์และตำแหน่งงานในปีก่อนหน้าเท่านั้น ไม่ควรใช้แทนข้อมูลของปีการศึกษาปัจจุบัน
          </p>
        </section>

        {/* Last Updated */}
        <div className="pt-8 pb-4 text-center">
          <span className="text-xs text-slate-400 tracking-wide">
            อัปเดตล่าสุด 31/08/2569
          </span>
        </div>
      </div>
    </main>
  );
};

export default Home;