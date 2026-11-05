import React, { useEffect } from 'react';
import { Building2, Calendar, CheckCircle2, GraduationCap, X } from 'lucide-react';
import type { CoopPlan } from '../../types/coopPlan';
import type { EndorseDecision, ScreenDecision, SelectDecision } from '../../types/planReview';
import { PlanStatusBadge } from './PlanListTable';
import { ReviewHistory } from './ReviewHistory';
import PlanAttachmentSummary from './PlanAttachmentSummary';
import EndorseForm from './EndorseForm';
import ScreenForm from './ScreenForm';
import SelectForm from './SelectForm';

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
  /** Given for the committee: shows the selection form (#149). */
  onSelect?: (payload: {
    planId: number;
    decision: SelectDecision;
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
  onSelect,
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
      <div className="relative w-full max-w-6xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden">        {/* Header */}
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
          {/* Two-column detail layout */}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {/* Left Column */}
            <div className="flex min-w-0 flex-col gap-4">
              {/* Student Info Card */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <GraduationCap className="h-4 w-4 text-blue-600" />
                  <span>ข้อมูลนักศึกษา</span>
                </div>

                <div className="mt-3 space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-400">
                      ชื่อ-นามสกุล
                    </span>
                    <p className="font-semibold text-slate-900">
                      {plan.first_name} {plan.last_name}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-slate-400">
                        รหัสนักศึกษา
                      </span>
                      <p className="font-mono font-medium text-slate-800">
                        {plan.student_id}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs text-slate-400">
                        หลักสูตร
                      </span>
                      <p className="font-medium text-slate-800">
                        หลักสูตร {plan.curriculum}
                      </p>
                    </div>

                    {plan.gpa !== undefined && plan.gpa !== null && (
                      <div>
                        <span className="text-xs text-slate-400">
                          GPA
                        </span>
                        <p className="font-bold text-blue-600">
                          {Number(plan.gpa).toFixed(2)}
                        </p>
                      </div>
                    )}

                    {plan.advisor_name && (
                      <div className="col-span-2">
                        <span className="text-xs text-slate-400">
                          อาจารย์ที่ปรึกษา
                        </span>
                        <p className="font-medium text-slate-700">
                          {plan.advisor_name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Company and Position Card */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  <span>สถานประกอบการและตำแหน่งงาน</span>
                </div>

                <div className="mt-3 space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-400">
                      ตำแหน่ง
                    </span>
                    <p className="font-semibold text-slate-900">
                      {plan.position_title || 'ยังไม่ระบุตำแหน่ง'}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400">
                      สถานประกอบการ
                    </span>
                    <p className="font-medium text-slate-800">
                      {plan.company_name || 'ยังไม่ระบุ'}
                      {plan.company_short_name
                        ? ` (${plan.company_short_name})`
                        : ''}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400">
                      รอบสหกิจ
                    </span>
                    <p className="text-sm text-slate-700">
                      {plan.period_name || plan.period_id}
                    </p>
                  </div>
                </div>
              </section>

              {/* Attachments */}
              <PlanAttachmentSummary
                planId={plan.plan_id}
                getIdToken={getIdToken}
                showEditHint={false}
              />
            </div>

            {/* Right Column */}
            <div className="flex min-w-0 flex-col gap-4">
              {/* Terms and Student Note */}
              <section className="self-start w-full rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>การยอมรับเงื่อนไข</span>
                </div>

                <div className="mt-3 rounded-xl bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700">
                      ยอมรับเงื่อนไขการเตรียมความพร้อมก่อนสหกิจ
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        plan.acknowledged_pre_course
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {plan.acknowledged_pre_course
                        ? 'ยอมรับแล้ว'
                        : 'ยังไม่ยอมรับ'}
                    </span>
                  </div>

                  {plan.terms_accepted_at && (
                    <p className="mt-2 text-xs text-slate-400">
                      ยอมรับเมื่อ {formatDate(plan.terms_accepted_at)}
                    </p>
                  )}
                </div>

                {plan.student_note && (
                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs leading-relaxed text-slate-700">
                    <span className="font-semibold text-slate-500">
                      หมายเหตุของนักศึกษา:{' '}
                    </span>
                    {plan.student_note}
                  </div>
                )}
              </section>

              {/* Review History */}
              <section className="self-start w-full rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <Calendar className="h-4 w-4 text-amber-600" />
                  <span>ผลการพิจารณา</span>
                </div>

                <ReviewHistory
                  reviews={plan.reviews}
                  planStatus={plan.status}
                />
              </section>
            </div>
          </div>

          {/* Review Form */}
          {/* Section 2: the form of the viewer's step: endorse (#147), screen (#148) or select (#149). */}
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
          ) : onSelect ? (
            <SelectForm
              committeeName={reviewerName}
              onCancel={() => onOpenChange(false)}
              onSelect={async (decision, selectComment) => {
                const saved = await onSelect({ planId: plan.plan_id, decision, comment: selectComment });
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
