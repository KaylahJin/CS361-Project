import React, { useEffect } from 'react';
import { Building2, Calendar, CheckCircle2, GraduationCap, X } from 'lucide-react';
import type { CoopPlan } from '../../types/coopPlan';
import type { EndorseDecision, ScreenDecision } from '../../types/planReview';
import { PlanStatusBadge } from './PlanListTable';
import PlanAttachmentSummary from './PlanAttachmentSummary';
import EndorseForm from './EndorseForm';
import ScreenForm from './ScreenForm';

export interface PlanDetailModalProps {
  plan: CoopPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewerName?: string;
  onSaved?: (updatedPlan: CoopPlan) => void;
  getIdToken: () => Promise<string | null>;
  /** Given for an advisor: shows the endorse form (#147). */
  onEndorse?: (payload: {
    planId: number;
    decision: EndorseDecision;
    comment: string;
  }) => Promise<CoopPlan>;
  /** Given for staff: shows the screening form (#148). */
  onScreen?: (payload: {
    planId: number;
    decision: ScreenDecision;
    comment: string;
  }) => Promise<CoopPlan>;
}

function formatDate(isoString: string | null): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export const PlanDetailModal: React.FC<PlanDetailModalProps> = ({
  plan,
  open,
  onOpenChange,
  reviewerName = 'ผู้ตรวจสอบ',
  onSaved,
  getIdToken,
  onEndorse,
  onScreen,
}) => {
  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  if (!open || !plan) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        onClick={() => onOpenChange(false)}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Dialog Content */}
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 font-bold text-sm">
              #{plan.plan_id}
            </span>
            <div>
              <h2
                id="modal-title"
                className="text-base sm:text-lg font-bold text-slate-900"
              >
                ตรวจและพิจารณาแผนสหกิจศึกษา
              </h2>
              <p className="text-xs text-slate-500">
                {plan.period_name || plan.period_id} · ยื่นเมื่อ{' '}
                {formatDate(plan.submitted_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PlanStatusBadge status={plan.status} />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              aria-label="ปิดหน้าต่าง"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Section 1: ข้อมูลนักศึกษาและสถานประกอบการ */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Student Info Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <GraduationCap className="h-4 w-4 text-blue-600" />
                <span>ข้อมูลนักศึกษา</span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <span className="text-xs text-slate-400">ชื่อ-นามสกุล:</span>
                  <p className="font-semibold text-slate-900">
                    {plan.first_name} {plan.last_name}
                  </p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <span className="text-xs text-slate-400">รหัสนักศึกษา:</span>
                    <p className="font-mono font-medium text-slate-800">
                      {plan.student_id}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">หลักสูตร:</span>
                    <p className="font-medium text-slate-800">
                      หลักสูตร {plan.curriculum}
                    </p>
                  </div>
                  {plan.gpa !== undefined && plan.gpa !== null && (
                    <div>
                      <span className="text-xs text-slate-400">GPA:</span>
                      <p className="font-bold text-blue-600">
                        {Number(plan.gpa).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
                {plan.advisor_name && (
                  <div>
                    <span className="text-xs text-slate-400">
                      อาจารย์ที่ปรึกษา:
                    </span>
                    <p className="text-xs font-medium text-slate-700">
                      {plan.advisor_name}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Position and Company Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Building2 className="h-4 w-4 text-indigo-600" />
                <span>สถานประกอบการและตำแหน่งงาน</span>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div>
                  <span className="text-xs text-slate-400">ตำแหน่ง:</span>
                  <p className="font-semibold text-slate-900">
                    {plan.position_title || 'ยังไม่ระบุตำแหน่ง'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">
                    สถานประกอบการ:
                  </span>
                  <p className="font-medium text-slate-800">
                    {plan.company_name || 'ยังไม่ระบุ'}
                    {plan.company_short_name
                      ? ` (${plan.company_short_name})`
                      : ''}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">รอบสหกิจ:</span>
                  <p className="text-xs text-slate-700">
                    {plan.period_name || plan.period_id}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Student Notes & Conditions */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              เงื่อนไขและข้อความจากนักศึกษา
            </h4>
            <div className="mt-2.5 flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-slate-700 font-medium">
                  ยอมรับเงื่อนไขการเตรียมความพร้อมก่อนสหกิจ
                </span>
              </div>
              <span className="text-slate-400">
                {plan.terms_accepted_at
                  ? formatDate(plan.terms_accepted_at)
                  : plan.acknowledged_pre_course
                  ? 'ยอมรับแล้ว'
                  : 'ยังไม่ยอมรับ'}
              </span>
            </div>
            {plan.student_note && (
              <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs text-slate-700">
                <span className="font-semibold text-slate-500">
                  หมายเหตุของนักศึกษา:{' '}
                </span>
                <span>"{plan.student_note}"</span>
              </div>
            )}
          </div>
          {/* Plan Attachments — Read Only for Reviewers */}
          <PlanAttachmentSummary
            planId={plan.plan_id}
            getIdToken={getIdToken}
            showEditHint={false}
          />
          {/* Review History / Current Review */}
          {plan.reviewed_at && (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Calendar className="h-4 w-4 text-amber-600" />
                <span>ประวัติการพิจารณาล่าสุด</span>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>
                  <span className="text-slate-400">ผู้ตรวจ:</span>{' '}
                  <span className="font-semibold text-slate-700">
                    {plan.reviewer_name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">เมื่อ:</span>{' '}
                  <span>{formatDate(plan.reviewed_at)}</span>
                </div>
                {plan.review_comment && (
                  <div className="rounded-lg bg-white p-2.5 border border-slate-200/60 mt-1">
                    <span className="text-slate-400 block mb-0.5">
                      ความคิดเห็น / เหตุผล:
                    </span>
                    <p className="text-slate-800">{plan.review_comment}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 2: the advisor's endorse form (#147) or staff's screening form (#148). Approving in one step is gone (#148). */}
          {onEndorse ? (
            <EndorseForm
              advisorName={reviewerName}
              onCancel={() => onOpenChange(false)}
              onEndorse={async (decision, endorseComment) => {
                const saved = await onEndorse({ planId: plan.plan_id, decision, comment: endorseComment });
                onSaved?.(saved);
                onOpenChange(false);
              }}
            />
          ) : onScreen ? (
            <ScreenForm
              key={plan.plan_id}
              planId={plan.plan_id}
              staffName={reviewerName}
              getIdToken={getIdToken}
              onCancel={() => onOpenChange(false)}
              onScreen={async (decision, screenComment) => {
                const saved = await onScreen({ planId: plan.plan_id, decision, comment: screenComment });
                onSaved?.(saved);
                onOpenChange(false);
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PlanDetailModal;
