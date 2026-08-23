import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

export const HistoricalSection: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<string>('2568');
  const years = ['2568', '2567', '2566', '2565'];

  return (
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
  );
};

export default HistoricalSection;
