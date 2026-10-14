import { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  XCircle,
  X,
} from 'lucide-react';
import type { PlanCounts } from '../../types/planReview';

interface PlanProgressChartProps {
  counts: PlanCounts;
  total: number;
}

export const PlanProgressChart = ({
  counts,
  total,
}: PlanProgressChartProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const approved = counts.APPROVED || 0;
  const submitted = counts.SUBMITTED || 0;
  const returned = counts.RETURNED || 0;
  const rejected = counts.REJECTED || 0;

  const reviewedTotal = approved + returned + rejected;
  const reviewProgress = total > 0 ? Math.round((reviewedTotal / total) * 100) : 0;

  const approvedPercent = total > 0 ? Math.round((approved / total) * 100) : 0;
  const submittedPercent = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const returnedPercent = total > 0 ? Math.round((returned / total) * 100) : 0;
  const rejectedPercent = total > 0 ? Math.round((rejected / total) * 100) : 0;

  // Donut Chart Geometry
  const radius = 42;
  const circumference = 2 * Math.PI * radius; // ~263.89

  // Close overlay when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const showOverlay = isOpen || isHovered;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative flex items-center justify-center rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs transition-all hover:border-blue-300 hover:shadow-sm"
    >
      {/* Circular Donut Graph Only */}
      <div
        id="plan-progress-donut"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-24 w-24 shrink-0 items-center justify-center cursor-pointer group transition-transform duration-200 hover:scale-105 active:scale-95"
        title="คลิกหรือชี้เพื่อดูรายละเอียดความคืบหน้า"
      >
        <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
          {/* Background Circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-slate-100"
            strokeWidth="9"
            fill="transparent"
          />

          {/* Unified Completed Progress Ring in System Color (Navy 950) */}
          {total > 0 && reviewedTotal > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="var(--color-blue-600)"
              strokeWidth="9"
              strokeDasharray={`${(reviewedTotal / total) * circumference} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-500 hover:opacity-85"
            />
          )}
        </svg>

        {/* Center Text (% and Label) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="font-heading text-lg font-black tracking-tight text-slate-800">
            {reviewProgress}%
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase -mt-0.5">
            ตรวจแล้ว
          </span>
        </div>
      </div>

      {/* Interactive Popover / Overlay with Full Details */}
      {showOverlay && (
        <div className="absolute top-full right-0 z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white/98 p-4 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <h4 className="font-heading text-xs font-bold text-slate-800">
                ผลงานที่ตรวจเสร็จแล้ว ({reviewedTotal}/{total} แผน {reviewProgress}%)
              </h4>
            </div>
            {isOpen && (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 hover:scale-110 active:scale-95 transition cursor-pointer"
                title="ปิด"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Detailed Breakdown of Completed Tasks */}
          <div className="mt-3 space-y-2.5 text-xs">
            {/* 1. Approved (Completed - Green as requested) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-emerald-600">
                <span className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>อนุมัติแล้ว</span>
                </span>
                <span className="font-semibold text-slate-800">
                  {approved} แผน ({approvedPercent}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${approvedPercent}%` }}
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                />
              </div>
            </div>

            {/* 2. Returned for Revision (Yellow desaturated to B&W: Lighter silver gray) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-zinc-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
                  <span>ส่งกลับแก้ไข</span>
                </span>
                <span className="font-semibold text-slate-800">
                  {returned} แผน ({returnedPercent}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${returnedPercent}%` }}
                  className="h-full bg-zinc-300 rounded-full transition-all duration-300"
                />
              </div>
            </div>

            {/* 3. Rejected (Red desaturated to B&W: Dark charcoal gray) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-zinc-700">
                <span className="flex items-center gap-1.5 font-semibold">
                  <XCircle className="h-3.5 w-3.5 text-zinc-600" />
                  <span>ไม่อนุมัติ</span>
                </span>
                <span className="font-semibold text-slate-800">
                  {rejected} แผน ({rejectedPercent}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${rejectedPercent}%` }}
                  className="h-full bg-zinc-600 rounded-full transition-all duration-300"
                />
              </div>
            </div>
          </div>

          {/* Pending Section - Remaining tasks waiting for review */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-100">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 text-blue-600 font-bold">
                <Clock className="h-3.5 w-3.5" />
                <span>คงเหลือรอตรวจ</span>
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              </div>
              <span className="font-bold text-blue-600">
                {submitted} แผน ({submittedPercent}%)
              </span>
            </div>
          </div>

          <div className="mt-2 text-[10px] text-slate-400 text-center">
            ชี้เมาส์หรือแตะที่กราฟเพื่อเปิด/ปิดรายละเอียด
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanProgressChart;
