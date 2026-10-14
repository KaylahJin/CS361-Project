import React from 'react';
import { CheckCircle2, Clock, RotateCcw, XCircle, TrendingUp } from 'lucide-react';
import type { PlanCounts } from '../../types/planReview';

interface PlanProgressChartProps {
  counts: PlanCounts;
  total: number;
}

export const PlanProgressChart: React.FC<PlanProgressChartProps> = ({
  counts,
  total,
}) => {
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

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <h3 className="font-heading text-sm font-bold text-slate-800">
            ความคืบหน้าการตรวจแผน
          </h3>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
          {reviewProgress}% ตรวจแล้ว
        </span>
      </div>

      {/* Stacked Progress Bar */}
      <div className="mt-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
          {approved > 0 && (
            <div
              style={{ width: `${approvedPercent}%` }}
              className="bg-emerald-500 transition-all duration-500"
              title={`อนุมัติแล้ว: ${approved} รายการ (${approvedPercent}%)`}
            />
          )}
          {submitted > 0 && (
            <div
              style={{ width: `${submittedPercent}%` }}
              className="bg-blue-500 transition-all duration-500"
              title={`รอตรวจ: ${submitted} รายการ (${submittedPercent}%)`}
            />
          )}
          {returned > 0 && (
            <div
              style={{ width: `${returnedPercent}%` }}
              className="bg-amber-500 transition-all duration-500"
              title={`ส่งกลับแก้ไข: ${returned} รายการ (${returnedPercent}%)`}
            />
          )}
          {rejected > 0 && (
            <div
              style={{ width: `${rejectedPercent}%` }}
              className="bg-rose-500 transition-all duration-500"
              title={`ไม่อนุมัติ: ${rejected} รายการ (${rejectedPercent}%)`}
            />
          )}
        </div>
      </div>

      {/* KPI Breakdown Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {/* Approved */}
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50/70 p-2.5 text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="text-[11px] text-emerald-700">อนุมัติแล้ว</p>
            <p className="font-bold text-emerald-900">{approved} แผน</p>
          </div>
        </div>

        {/* Pending (Submitted) */}
        <div className="flex items-center gap-2 rounded-xl bg-blue-50/70 p-2.5 text-blue-800">
          <Clock className="h-4 w-4 shrink-0 text-blue-600" />
          <div className="min-w-0">
            <p className="text-[11px] text-blue-700">รอตรวจ</p>
            <p className="font-bold text-blue-900">{submitted} แผน</p>
          </div>
        </div>

        {/* Returned */}
        <div className="flex items-center gap-2 rounded-xl bg-amber-50/70 p-2.5 text-amber-800">
          <RotateCcw className="h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-[11px] text-amber-700">ส่งกลับแก้ไข</p>
            <p className="font-bold text-amber-900">{returned} แผน</p>
          </div>
        </div>

        {/* Rejected */}
        <div className="flex items-center gap-2 rounded-xl bg-rose-50/70 p-2.5 text-rose-800">
          <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <div className="min-w-0">
            <p className="text-[11px] text-rose-700">ไม่อนุมัติ</p>
            <p className="font-bold text-rose-900">{rejected} แผน</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanProgressChart;
