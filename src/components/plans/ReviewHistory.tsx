
import React from 'react';
import { Clock3 } from 'lucide-react';
import type { PlanReviewHistoryItem } from '../../types/planReview';
import type { CoopPlan, CoopPlanStatus } from '../../types/coopPlan';

type Decision = PlanReviewHistoryItem['decision'];

interface ReviewHistoryProps {
  reviews?: PlanReviewHistoryItem[];
  planStatus?: CoopPlanStatus;
}

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

function getReviewerRole(decision: Decision): string {
  switch (decision) {
    case 'ENDORSED':
    case 'NOT_ENDORSED':
      return 'Advisor';
    case 'ELIGIBLE':
    case 'INCOMPLETE':
    case 'NOT_ELIGIBLE':
      return 'Staff';
    case 'SELECTED':
    case 'NOT_SELECTED':
      return 'Committee';
    default:
      return 'ผู้พิจารณา';
  }
}

function getPendingStep(status?: CoopPlanStatus) {
  switch (status) {
    case 'SUBMITTED':
      return {
        role: 'Advisor',
        title: 'รอการรับรองจากอาจารย์ที่ปรึกษา',
      };
    case 'ENDORSED':
      return {
        role: 'Staff',
        title: 'รอเจ้าหน้าที่ตรวจสอบ',
      };
    case 'ELIGIBLE':
      return {
        role: 'Committee',
        title: 'รอพิจารณาจากคณะกรรมการ',
      };
    default:
      return null;
  }
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ReviewHistory: React.FC<ReviewHistoryProps> = ({
  reviews,
  planStatus,
}) => {
  const sortedReviews = [...(reviews ?? [])].sort((a, b) => {
    const dateDiff =
      new Date(b.reviewed_at).getTime() -
      new Date(a.reviewed_at).getTime();

    if (dateDiff !== 0 && !Number.isNaN(dateDiff)) {
      return dateDiff;
    }

    return b.review_id - a.review_id;
  });

  const pendingStep = getPendingStep(planStatus);

  if (sortedReviews.length === 0 && !pendingStep) {
    return (
      <p className="text-sm text-slate-400">
        ยังไม่มีประวัติการพิจารณา
      </p>
    );
  }

  return (
    <ol aria-label="ประวัติการพิจารณา" className="space-y-0">
      {pendingStep && (
        <li className="relative flex gap-3 pb-4">
          <div className="relative flex w-5 shrink-0 justify-center">
            <span className="absolute top-2 bottom-0 w-px bg-slate-200" />
            <span className="relative z-10 mt-1 h-3 w-3 rounded-full border-2 border-slate-400 bg-slate-100 ring-4 ring-white" />
          </div>

          <div className="mb-1 min-w-0 flex-1 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-600">
                {pendingStep.role}
              </span>
              <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                รอดำเนินการ
              </span>
            </div>

            <p className="mt-2 text-sm font-semibold text-slate-600">
              {pendingStep.title}
            </p>

            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Clock3 className="h-3.5 w-3.5" />
              รอพิจารณา
            </div>
          </div>
        </li>
      )}

      {sortedReviews.map((item, index) => {
        const stepLabel = item.step
          ? STEP_LABEL[item.step] || item.step
          : null;

        return (
          <li
            key={item.review_id}
            className="relative flex gap-3 pb-4 last:pb-0"
          >
            <div className="relative flex w-5 shrink-0 justify-center">
              {index !== sortedReviews.length - 1 && (
                <span className="absolute top-2 bottom-0 w-px bg-slate-200" />
              )}
              <span className="relative z-10 mt-1 h-3 w-3 rounded-full border-2 border-blue-500 bg-white ring-4 ring-white" />
            </div>

            <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-800">
                  {getReviewerRole(item.decision)}
                </span>

                {index === 0 && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-600">
                    ล่าสุด
                  </span>
                )}
              </div>

              {stepLabel && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {stepLabel}
                </p>
              )}

              <p className="mt-1 break-all text-[11px] text-slate-400">
                {item.reviewer_name || 'ไม่พบข้อมูลผู้พิจารณา'}
              </p>

              <div className="mt-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                    DECISION_STYLE[item.decision] ||
                    'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {DECISION_LABEL[item.decision] || item.decision}
                </span>
              </div>

              <p className="mt-2 text-[11px] text-slate-400">
                {formatWhen(item.reviewed_at)}
              </p>

              {item.comment && (
                <div className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-700">
                  {item.comment}
                </div>
              )}
            </div>
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

export function buildPlanActivityEvents(
  plan: CoopPlan
): ActivityTimelineEvent[] {
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

  if (plan.reviews?.length) {
    for (const review of plan.reviews) {
      const label =
        DECISION_LABEL[review.decision] || review.decision;
      const stepLabel = review.step
        ? STEP_LABEL[review.step] || review.step
        : 'การพิจารณาแผน';

      events.push({
        id: `review-${review.review_id}`,
        title: `${stepLabel}: ${label}`,
        actor: review.reviewer_name || 'ผู้ตรวจสอบ',
        timestamp: review.reviewed_at,
        detail: review.comment,
        badgeClass:
          DECISION_STYLE[review.decision] ||
          'bg-amber-50 text-amber-700 border-amber-200',
      });
    }
  } else if (
    plan.reviewed_at &&
    plan.reviewer_name &&
    DECISION_LABEL[plan.status]
  ) {
    events.push({
      id: `latest-review-${plan.plan_id}`,
      title: `ผลการพิจารณาล่าสุด: ${DECISION_LABEL[plan.status]}`,
      actor: plan.reviewer_name,
      timestamp: plan.reviewed_at,
      detail: plan.review_comment,
      badgeClass:
        DECISION_STYLE[plan.status] ||
        'bg-amber-50 text-amber-700 border-amber-200',
    });
  }

  return events.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() -
      new Date(a.timestamp).getTime()
  );
}

export const PlanActivityTimeline: React.FC<{ plan: CoopPlan }> = ({
  plan,
}) => {
  const events = buildPlanActivityEvents(plan);

  return (
    <div className="space-y-3">
      {events.length === 0 ? (
        <p className="text-xs text-slate-400">
          ไม่มีข้อมูลประวัติเหตุการณ์
        </p>
      ) : (
        <ol aria-label="ประวัติกิจกรรมของแผน" className="space-y-2.5">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-bold ${event.badgeClass}`}
                >
                  {event.title}
                </span>
                <span className="font-medium text-slate-400">
                  {formatWhen(event.timestamp)}
                </span>
              </div>

              <div className="mt-1.5 text-slate-600">
                <span className="font-semibold text-slate-700">
                  ผู้ดำเนินการ:{' '}
                </span>
                {event.actor}
              </div>

              {event.detail && (
                <p className="mt-1 rounded-lg border border-slate-100 bg-white/80 px-2.5 py-1.5 text-slate-700">
                  {event.detail}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className="rounded-lg border border-slate-200/70 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        <strong>ข้อจำกัดข้อมูล (Limited Activity History):</strong>{' '}
        แสดงเฉพาะเหตุการณ์ที่มีบันทึกเวลาจริงจากฐานข้อมูล (
        <code>created_at</code>, <code>terms_accepted_at</code>,{' '}
        <code>submitted_at</code> ล่าสุดใน <code>coop_plans</code>{' '}
        และประวัติการพิจารณาทุกรอบใน <code>plan_reviews</code>)
        ระบบไม่ได้เก็บ Full Audit Log ของการแก้ไขรายฟิลด์หรือเวลาที่กดยื่นแผนรอบก่อนหน้า
      </p>
    </div>
  );
};