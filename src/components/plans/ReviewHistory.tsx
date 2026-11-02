import React from 'react';
import type { PlanReviewHistoryItem } from '../../types/planReview';

type Decision = PlanReviewHistoryItem['decision'];

const DECISION_LABEL: Record<Decision, string> = {
  APPROVED: 'อนุมัติ',
  RETURNED: 'ส่งกลับให้แก้ไข',
  REJECTED: 'ไม่อนุมัติ',
  ENDORSED: 'อาจารย์รับรอง',
  NOT_ENDORSED: 'อาจารย์ไม่รับรอง',
  ELIGIBLE: 'ผ่านการตรวจ',
  INCOMPLETE: 'เอกสารไม่ครบ',
  NOT_ELIGIBLE: 'ไม่ผ่านคุณสมบัติ',
  SELECTED: 'ได้รับการคัดเลือก',
  NOT_SELECTED: 'ไม่ได้รับการคัดเลือก',
};

const DECISION_STYLE: Record<Decision, string> = {
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETURNED: 'bg-amber-50 text-amber-700 border-amber-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  ENDORSED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  NOT_ENDORSED: 'bg-amber-50 text-amber-700 border-amber-200',
  ELIGIBLE: 'bg-teal-50 text-teal-700 border-teal-200',
  INCOMPLETE: 'bg-amber-50 text-amber-700 border-amber-200',
  NOT_ELIGIBLE: 'bg-rose-50 text-rose-700 border-rose-200',
  SELECTED: 'bg-violet-50 text-violet-700 border-violet-200',
  NOT_SELECTED: 'bg-slate-100 text-slate-700 border-slate-300',
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
