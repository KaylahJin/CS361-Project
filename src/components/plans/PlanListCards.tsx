import React from 'react';
import { Building2, Calendar, ChevronRight } from 'lucide-react';
import type { PlanReviewItem } from '../../types/planReview';
import { PlanStatusBadge } from './PlanListTable';

interface PlanListCardsProps {
  plans: PlanReviewItem[];
  onOpen: (plan: PlanReviewItem) => void;
  onReview?: (plan: PlanReviewItem) => void;
  /** The status this viewer acts on: SUBMITTED for an advisor, ENDORSED for staff (#147). */
  reviewableStatus?: PlanReviewItem['status'];
}

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

export const PlanListCards: React.FC<PlanListCardsProps> = ({
  plans,
  onOpen,
  onReview,
  reviewableStatus = 'SUBMITTED',
}) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {plans.map((plan) => {
        const isPending = plan.status === reviewableStatus;
        // Only a viewer who was given onReview can review. Without it the plan is
        // read-only, so the button must not offer "ตรวจแผน" and look clickable.
        const canReview = isPending && Boolean(onReview);

        return (
          <div
            key={plan.plan_id}
            onClick={() => onOpen(plan)}
            className={`group flex flex-col justify-between rounded-2xl border p-4 shadow-xs transition-all cursor-pointer ${
              isPending
                ? 'border-blue-200/90 bg-blue-50/15 ring-1 ring-blue-500/20 hover:border-blue-400 hover:shadow-md'
                : 'border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-sm'
            }`}
          >
            <div>
              {/* Header with Student and Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 font-bold text-xs ring-1 ring-blue-100">
                    {plan.first_name.slice(0, 2)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {plan.first_name} {plan.last_name}
                    </h4>
                    <span className="font-mono text-xs text-slate-500">
                      {plan.student_id}
                    </span>
                  </div>
                </div>
                <PlanStatusBadge status={plan.status} />
              </div>

              {/* Position and Company */}
              <div className="mt-3.5 space-y-1.5 border-t border-slate-100 pt-3">
                <div className="text-sm font-semibold text-slate-800">
                  {plan.position_title || 'ยังไม่ระบุตำแหน่ง'}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">
                    {plan.company_short_name || plan.company_name || 'ยังไม่ระบุสถานประกอบการ'}
                  </span>
                </div>
              </div>

              {/* Meta tags */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                  หลักสูตร {plan.curriculum}
                </span>
                {plan.gpa !== undefined && plan.gpa !== null && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                    GPA {Number(plan.gpa).toFixed(2)}
                  </span>
                )}
                <span className="flex items-center gap-1 text-slate-400">
                  <Calendar className="h-3 w-3" />
                  {formatDate(plan.submitted_at)}
                </span>
              </div>

              {/* Review Comment Preview if exists */}
              {plan.review_comment && (
                <div className="mt-3 rounded-xl bg-zinc-50 border border-zinc-200/80 p-2.5 text-xs text-slate-700">
                  <span className="font-bold text-zinc-600">
                    {plan.reviewer_name}:{' '}
                  </span>
                  <span className="italic">"{plan.review_comment}"</span>
                </div>
              )}
            </div>

            {/* Action footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (canReview && onReview) {
                    onReview(plan);
                  } else {
                    onOpen(plan);
                  }
                }}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-bold transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] ${
                  canReview
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-xs hover:shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-xs'
                }`}
              >
                <span>{canReview ? 'ตรวจแผน' : 'ดูรายละเอียด'}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlanListCards;
