import { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  XCircle,
  TrendingUp,
  X,
  ChevronDown,
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

  const slices = [
    { key: 'approved', count: approved, percent: approvedPercent, color: '#10b981', label: 'อนุมัติแล้ว' },
    { key: 'returned', count: returned, percent: returnedPercent, color: '#f59e0b', label: 'ส่งกลับแก้ไข' },
    { key: 'rejected', count: rejected, percent: rejectedPercent, color: '#f43f5e', label: 'ไม่อนุมัติ' },
    { key: 'submitted', count: submitted, percent: submittedPercent, color: '#3b82f6', label: 'รอตรวจ' },
  ];

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

  let accumulatedOffset = 0;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:border-blue-300 hover:shadow-sm"
    >
      {/* Compact Main View: Header + Circular Chart + % */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <TrendingUp className="h-4 w-4 text-blue-600 shrink-0" />
            <h3 className="font-heading text-xs sm:text-sm font-bold">
              ความคืบหน้าการตรวจ
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            ตรวจแล้ว {reviewedTotal} จาก {total} แผน
          </p>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="mt-2.5 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <span>{showOverlay ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}</span>
            <ChevronDown
              className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
                showOverlay ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {/* Circular Donut Graph */}
        <div
          onClick={() => setIsOpen((prev) => !prev)}
          className="relative flex h-24 w-24 shrink-0 items-center justify-center cursor-pointer group"
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

            {/* Render Donut Segments */}
            {total > 0 &&
              slices.map((slice) => {
                if (slice.count <= 0) return null;
                const strokeLength = (slice.count / total) * circumference;
                const offset = accumulatedOffset;
                accumulatedOffset += strokeLength;

                return (
                  <circle
                    key={slice.key}
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke={slice.color}
                    strokeWidth="9"
                    strokeDasharray={`${strokeLength} ${circumference}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-500 hover:opacity-85"
                  />
                );
              })}
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
      </div>

      {/* Interactive Popover / Overlay with Full Details */}
      {showOverlay && (
        <div className="absolute top-full left-0 right-0 z-30 mt-2 rounded-2xl border border-slate-200 bg-white/98 p-4 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              <h4 className="font-heading text-xs font-bold text-slate-800">
                รายละเอียดผลการตรวจ ({total} แผน)
              </h4>
            </div>
            {isOpen && (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                title="ปิด"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Detailed Breakdown List */}
          <div className="mt-3 space-y-2.5 text-xs">
            {/* Approved */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  อนุมัติแล้ว
                </span>
                <span className="font-bold text-slate-900">
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

            {/* Waiting for Review (Submitted) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  รอตรวจพิจารณา
                </span>
                <span className="font-bold text-slate-900">
                  {submitted} แผน ({submittedPercent}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${submittedPercent}%` }}
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                />
              </div>
            </div>

            {/* Returned for Revision */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-1.5 font-medium">
                  <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                  ส่งกลับแก้ไข
                </span>
                <span className="font-bold text-slate-900">
                  {returned} แผน ({returnedPercent}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${returnedPercent}%` }}
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                />
              </div>
            </div>

            {/* Rejected */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-1.5 font-medium">
                  <XCircle className="h-3.5 w-3.5 text-rose-600" />
                  ไม่อนุมัติ
                </span>
                <span className="font-bold text-slate-900">
                  {rejected} แผน ({rejectedPercent}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${rejectedPercent}%` }}
                  className="h-full bg-rose-500 rounded-full transition-all duration-300"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 border-t border-slate-100 pt-2 text-[10px] text-slate-400 text-center">
            ชี้เมาส์หรือแตะที่กราฟเพื่อเปิด/ปิดรายละเอียด
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanProgressChart;
