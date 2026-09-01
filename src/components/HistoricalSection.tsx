import React from 'react';
import { ExternalLink } from 'lucide-react';

export const HistoricalSection: React.FC = () => {
  return (
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
  );
};

export default HistoricalSection;
