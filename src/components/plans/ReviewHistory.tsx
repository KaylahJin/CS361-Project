import React from 'react';
import type { PlanReviewHistoryItem, ReviewDecision } from '../../types/planReview';

const DECISION_LABEL: Record<ReviewDecision, string> = {
  APPROVED: 'อนุมัติ',
  RETURNED: 'ส่งกลับให้แก้ไข',
  REJECTED: 'ไม่อนุมัติ',
};

const DECISION_STYLE: Record<ReviewDecision, string> = {
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETURNED: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Every decision made on a plan, newest first. coop_plans only keeps the latest
 * one, so after a plan is returned and sent in again this is the only place the
 * earlier reasons can still be read.
 */
export const ReviewHistory: React.FC<{ reviews?: PlanReviewHistoryItem[] }> = ({ reviews }) => {
  if (!reviews || reviews.length === 0) {
    return <p className="text-xs text-slate-400">ยังไม่มีประวัติการพิจารณา</p>;
  }

  return (
    <ol aria-label="ประวัติการพิจารณา" className="space-y-2">
      {reviews.map((item) => (
        <li
          key={item.review_id}
          className="rounded-lg border border-slate-200/70 bg-white p-3 text-xs text-slate-600"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 font-bold ${DECISION_STYLE[item.decision]}`}
            >
              {DECISION_LABEL[item.decision]}
            </span>
            <span className="font-semibold text-slate-700">{item.reviewer_name || '-'}</span>
            <span className="text-slate-400">{formatWhen(item.reviewed_at)}</span>
          </div>
          {item.comment && <p className="mt-1.5 text-slate-800">{item.comment}</p>}
        </li>
      ))}
    </ol>
  );
};
