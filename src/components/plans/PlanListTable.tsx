import React from 'react';
import { Building2, Calendar, CheckCircle2, ChevronRight, FileText, RotateCcw, XCircle } from 'lucide-react';
import type { PlanReviewItem } from '../../types/planReview';

interface PlanListTableProps {
  plans: PlanReviewItem[];
  onOpen: (plan: PlanReviewItem) => void;
}

export const PlanStatusBadge: React.FC<{ status: PlanReviewItem['status'] }> = ({
  status,
}) => {
  switch (status) {
    case 'SUBMITTED':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          รอตรวจ
        </span>
      );
    case 'RETURNED':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
          <RotateCcw className="h-3 w-3" />
          ส่งกลับแก้ไข
        </span>
      );
    case 'APPROVED':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          อนุมัติแล้ว
        </span>
      );
    case 'REJECTED':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
          <XCircle className="h-3 w-3" />
          ไม่อนุมัติ
        </span>
      );
    case 'DRAFT':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          <FileText className="h-3 w-3" />
          ฉบับร่าง
        </span>
      );
  }
};

function formatDate(isoString: string | null): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export const PlanListTable: React.FC<PlanListTableProps> = ({
  plans,
  onOpen,
}) => {
  return (
    <div className="hidden lg:block overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-4 pl-6">นักศึกษา</th>
              <th className="py-3.5 px-4">หลักสูตร</th>
              <th className="py-3.5 px-4">ตำแหน่ง / สถานประกอบการ</th>
              <th className="py-3.5 px-4">วันที่ยื่น</th>
              <th className="py-3.5 px-4">สถานะ</th>
              <th className="py-3.5 px-4">ผลการพิจารณา</th>
              <th className="py-3.5 px-4 pr-6 text-right">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {plans.map((plan) => {
              const isPending = plan.status === 'SUBMITTED';

              return (
                <tr
                  key={plan.plan_id}
                  onClick={() => onOpen(plan)}
                  className="group hover:bg-slate-50/80 cursor-pointer transition-colors"
                >
                  {/* Student */}
                  <td className="py-4 px-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 font-bold text-xs ring-1 ring-blue-100">
                        {plan.first_name.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {plan.first_name} {plan.last_name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {plan.student_id}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Curriculum & GPA */}
                  <td className="py-4 px-4">
                    <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      หลักสูตร {plan.curriculum}
                    </span>
                    {plan.gpa && (
                      <div className="mt-1 text-xs text-slate-500">
                        GPA: {plan.gpa.toFixed(2)}
                      </div>
                    )}
                  </td>

                  {/* Position & Company */}
                  <td className="py-4 px-4">
                    <div className="font-medium text-slate-800">
                      {plan.position_title || 'ยังไม่ระบุตำแหน่ง'}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="truncate max-w-[200px]">
                        {plan.company_short_name || plan.company_name || 'ยังไม่ระบุสถานประกอบการ'}
                      </span>
                    </div>
                  </td>

                  {/* Submitted Date */}
                  <td className="py-4 px-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{formatDate(plan.submitted_at)}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-4 px-4">
                    <PlanStatusBadge status={plan.status} />
                  </td>

                  {/* Review Info */}
                  <td className="py-4 px-4 text-xs">
                    {plan.reviewer_name ? (
                      <div>
                        <span className="font-medium text-slate-700">
                          {plan.reviewer_name}
                        </span>
                        {plan.review_comment && (
                          <p className="mt-0.5 max-w-[200px] truncate text-slate-500" title={plan.review_comment}>
                            {plan.review_comment}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-4 pr-6 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(plan);
                      }}
                      className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        isPending
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>{isPending ? 'ตรวจแผน' : 'ดูรายละเอียด'}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlanListTable;
