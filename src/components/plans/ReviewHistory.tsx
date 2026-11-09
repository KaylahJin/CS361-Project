import React from 'react';
import type { PlanReviewHistoryItem } from '../../types/planReview';
import type { CoopPlan } from '../../types/coopPlan';

const DECISION_LABEL: Record<string, string> = {
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

const DECISION_STYLE: Record<string, string> = {
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

const STEP_LABEL: Record<string, string> = {
  ENDORSEMENT: 'ขั้นรับรองโดยอาจารย์ที่ปรึกษา',
  SCREENING: 'ขั้นตรวจคุณสมบัติโดยเจ้าหน้าที่',
  SELECTION: 'ขั้นคัดเลือกโดยกรรมการ',
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
      {reviews.map((item) => {
        const label = DECISION_LABEL[item.decision] || item.decision;
        const style =
          DECISION_STYLE[item.decision] || 'bg-slate-100 text-slate-700 border-slate-200';
        const stepLabel = item.step ? STEP_LABEL[item.step] || item.step : null;

        return (
          <li
            key={item.review_id}
            className="rounded-lg border border-slate-200/70 bg-white p-3 text-xs text-slate-600"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 font-bold ${style}`}>
                {label}
              </span>
              {stepLabel && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {stepLabel}
                </span>
              )}
              <span className="font-semibold text-slate-700">{item.reviewer_name || '-'}</span>
              <span className="text-slate-400">{formatWhen(item.reviewed_at)}</span>
            </div>
            {item.comment && <p className="mt-1.5 text-slate-800">{item.comment}</p>}
          </li>
        );
      })}
    </ol>
  );
};

export interface ActivityTimelineEvent {
  id: string;
  title: string;
  actor: string;
  timestamp: string;
  detail?: string | null;
  badgeClass: string;
}

/**
 * Builds the verified activity history from existing database timestamps on
 * `coop_plans` and `plan_reviews` without fabricating events (FR7 / REL6).
 */
export function buildPlanActivityEvents(plan: CoopPlan): ActivityTimelineEvent[] {
  const events: ActivityTimelineEvent[] = [];
  const studentActor = `${plan.first_name} ${plan.last_name} (${plan.student_id})`;

  if (plan.created_at) {
    events.push({
      id: `created-${plan.plan_id}`,
      title: 'สร้างแผนสหกิจศึกษา (ฉบับร่าง)',
      actor: studentActor,
      timestamp: plan.created_at,
      detail: plan.period_name ? `รอบสหกิจ: ${plan.period_name}` : null,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    });
  }

  if (plan.terms_accepted_at) {
    events.push({
      id: `terms-${plan.plan_id}`,
      title: 'ยอมรับเงื่อนไขก่อนปฏิบัติสหกิจศึกษา',
      actor: studentActor,
      timestamp: plan.terms_accepted_at,
      detail: plan.acknowledged_pre_course
        ? 'รับทราบเงื่อนไขวิชาเตรียมสหกิจศึกษาแล้ว'
        : null,
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    });
  }

  if (plan.submitted_at) {
    events.push({
      id: `submitted-${plan.plan_id}`,
      title: 'ยื่นแผนสหกิจศึกษา (การยื่นล่าสุด)',
      actor: studentActor,
      timestamp: plan.submitted_at,
      detail: plan.position_title
        ? `ตำแหน่ง: ${plan.position_title} (${plan.company_short_name || plan.company_name || '-'})`
        : null,
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    });
  }

  if (plan.reviews && plan.reviews.length > 0) {
    for (const r of plan.reviews) {
      const label = DECISION_LABEL[r.decision] || r.decision;
      const stepLabel = r.step ? STEP_LABEL[r.step] || r.step : 'การพิจารณาแผน';
      events.push({
        id: `review-${r.review_id}`,
        title: `${stepLabel}: ${label}`,
        actor: r.reviewer_name || 'ผู้ตรวจสอบ',
        timestamp: r.reviewed_at,
        detail: r.comment,
        badgeClass:
          DECISION_STYLE[r.decision] || 'bg-amber-50 text-amber-700 border-amber-200',
      });
    }
  } else if (plan.reviewed_at && plan.reviewer_name && DECISION_LABEL[plan.status]) {
    const label = DECISION_LABEL[plan.status];
    events.push({
      id: `latest-review-${plan.plan_id}`,
      title: `ผลการพิจารณาล่าสุด: ${label}`,
      actor: plan.reviewer_name,
      timestamp: plan.reviewed_at,
      detail: plan.review_comment,
      badgeClass:
        DECISION_STYLE[plan.status] || 'bg-amber-50 text-amber-700 border-amber-200',
    });
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export const PlanActivityTimeline: React.FC<{ plan: CoopPlan }> = ({ plan }) => {
  const events = buildPlanActivityEvents(plan);

  return (
    <div className="space-y-3">
      {events.length === 0 ? (
        <p className="text-xs text-slate-400">ไม่มีข้อมูลประวัติเหตุการณ์</p>
      ) : (
        <ol aria-label="ประวัติกิจกรรมของแผน" className="space-y-2.5">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-bold ${ev.badgeClass}`}
                >
                  {ev.title}
                </span>
                <span className="text-slate-400 font-medium">
                  {formatWhen(ev.timestamp)}
                </span>
              </div>
              <div className="mt-1.5 text-slate-600">
                <span className="font-semibold text-slate-700">ผู้ดำเนินการ: </span>
                <span>{ev.actor}</span>
              </div>
              {ev.detail && (
                <p className="mt-1 text-slate-700 bg-white/80 rounded-lg border border-slate-100 px-2.5 py-1.5">
                  {ev.detail}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="rounded-lg border border-slate-200/70 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        <strong>ข้อจำกัดข้อมูล (Limited Activity History):</strong> แสดงเฉพาะเหตุการณ์ที่มีบันทึกเวลาจริงจากฐานข้อมูล (
        <code>created_at</code>, <code>terms_accepted_at</code>, <code>submitted_at</code> ล่าสุดใน{' '}
        <code>coop_plans</code> และประวัติการพิจารณาทุกรอบใน <code>plan_reviews</code>) ระบบไม่ได้เก็บ Full Audit Log ของการแก้ไขรายฟิลด์หรือเวลาที่กดยื่นแผนรอบก่อนหน้า
      </p>
    </div>
  );
};
