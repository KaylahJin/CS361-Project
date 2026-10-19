import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Loader2,
  RotateCcw,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import type { CoopPlan } from '../../types/coopPlan';
import type { ReviewDecision } from '../../types/planReview';
import { PlanStatusBadge } from './PlanListTable';
import { CircleCheckFill } from './CircleCheckFill';
import { CoopPlanApiError } from '../../data/coopPlanApi';

export interface PlanDetailModalProps {
  plan: CoopPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewerName?: string;
  onSaved?: (updatedPlan: CoopPlan) => void;
  onSubmitReview?: (payload: {
    planId: number;
    decision: ReviewDecision;
    comment: string;
  }) => Promise<void>;
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
  onSubmitReview,
}) => {
  const [decision, setDecision] = useState<ReviewDecision>('APPROVED');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [prevPlanId, setPrevPlanId] = useState<number | null>(null);

  // Sync state when plan changes without causing cascading renders
  if (plan && plan.plan_id !== prevPlanId) {
    setPrevPlanId(plan.plan_id);
    if (
      plan.status === 'APPROVED' ||
      plan.status === 'RETURNED' ||
      plan.status === 'REJECTED'
    ) {
      setDecision(plan.status as ReviewDecision);
    } else {
      setDecision('APPROVED');
    }
    setComment(plan.review_comment || '');
    setErrorMessage(null);
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // V3-05.2 requirement: Comment is mandatory for RETURNED and REJECTED
    if (
      (decision === 'RETURNED' || decision === 'REJECTED') &&
      !comment.trim()
    ) {
      setErrorMessage(
        'กรุณาระบุเหตุผลหรือข้อแนะนำเมื่อเลือก "ส่งกลับแก้ไข" หรือ "ไม่อนุมัติ"'
      );
      return;
    }

    setSubmitting(true);
    try {
      if (onSubmitReview) {
        await onSubmitReview({
          planId: plan.plan_id,
          decision,
          comment: comment.trim(),
        });
      }

      const updatedPlan: CoopPlan = {
        ...plan,
        status: decision,
        reviewer_name: reviewerName,
        reviewed_at: new Date().toISOString(),
        review_comment: comment.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (onSaved) {
        onSaved(updatedPlan);
      }

      onOpenChange(false);
    } catch (err) {
      if (err instanceof CoopPlanApiError && err.status === 409) {
        setErrorMessage(
          'คำร้องนี้ได้รับการพิจารณาไปแล้ว หรือไม่อยู่ในสถานะรอตรวจ (409 Conflict) กรุณารีเฟรชหน้าเพื่อดูสถานะล่าสุด'
        );
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'เกิดข้อผิดพลาดในการบันทึกผลการพิจารณา'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

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

          {/* Section 2: Form ผลการพิจารณา (V3-05.2 Readiness) */}
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border-2 border-blue-100 bg-blue-50/30 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  บันทึกผลการพิจารณา (สำหรับผู้ตรวจ)
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                ผู้ตรวจ:{' '}
                <span className="font-semibold text-slate-700">
                  {reviewerName}
                </span>
              </span>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Decision Radio Buttons */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                ผลการพิจารณา <span className="text-rose-500">*</span>
              </label>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {/* 1. APPROVE */}
                <label
                  id="label-decision-approved"
                  className={`flex items-center gap-2.5 rounded-xl border-2 p-3 text-xs sm:text-sm font-bold cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                    decision === 'APPROVED'
                      ? 'border-emerald-600 bg-emerald-50/40 text-emerald-800 ring-1 ring-emerald-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <input
                    id="radio-decision-approved"
                    type="radio"
                    name="decision"
                    value="APPROVED"
                    checked={decision === 'APPROVED'}
                    onChange={() => setDecision('APPROVED')}
                    className="sr-only"
                  />
                  <CircleCheckFill
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      decision === 'APPROVED'
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                    }`}
                  />
                  <span>อนุมัติ (Approve)</span>
                </label>

                {/* 2. RETURN */}
                <label
                  id="label-decision-returned"
                  className={`flex items-center gap-2.5 rounded-xl border-2 p-3 text-xs sm:text-sm font-bold cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                    decision === 'RETURNED'
                      ? 'border-amber-500 bg-amber-50/50 text-amber-900 ring-1 ring-amber-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <input
                    id="radio-decision-returned"
                    type="radio"
                    name="decision"
                    value="RETURNED"
                    checked={decision === 'RETURNED'}
                    onChange={() => setDecision('RETURNED')}
                    className="sr-only"
                  />
                  <RotateCcw
                    className={`h-4 w-4 ${
                      decision === 'RETURNED'
                        ? 'text-amber-500'
                        : 'text-slate-400'
                    }`}
                  />
                  <span>ส่งกลับแก้ไข (Return)</span>
                </label>

                {/* 3. REJECT */}
                <label
                  id="label-decision-rejected"
                  className={`flex items-center gap-2.5 rounded-xl border-2 p-3 text-xs sm:text-sm font-bold cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                    decision === 'REJECTED'
                      ? 'border-rose-600 bg-rose-50/50 text-rose-900 ring-1 ring-rose-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <input
                    id="radio-decision-rejected"
                    type="radio"
                    name="decision"
                    value="REJECTED"
                    checked={decision === 'REJECTED'}
                    onChange={() => setDecision('REJECTED')}
                    className="sr-only"
                  />
                  <XCircle
                    className={`h-4 w-4 ${
                      decision === 'REJECTED'
                        ? 'text-rose-600'
                        : 'text-slate-400'
                    }`}
                  />
                  <span>ไม่อนุมัติ (Reject)</span>
                </label>
              </div>
            </div>

            {/* Comment Textarea */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label
                  htmlFor="review-comment"
                  className="text-xs font-bold text-slate-700"
                >
                  ความคิดเห็น / เหตุผลการพิจารณา{' '}
                  {(decision === 'RETURNED' || decision === 'REJECTED') && (
                    <span className="text-rose-500 font-semibold">
                      (จำเป็นต้องระบุ)
                    </span>
                  )}
                </label>
                <span className="text-[11px] text-slate-400">
                  {comment.length} ตัวอักษร
                </span>
              </div>
              <textarea
                id="review-comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  decision === 'RETURNED'
                    ? 'ระบุสิ่งที่นักศึกษาต้องแก้ไขเพิ่มเติม เช่น รายวิชาที่ยังไม่ผ่าน หรือแผนการเรียน...'
                    : decision === 'REJECTED'
                    ? 'ระบุเหตุผลที่ไม่อนุมัติแผนฉบับนี้...'
                    : 'ระบุความคิดเห็นหรือคำแนะนำเพิ่มเติม (ถ้ามี)...'
                }
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                id="btn-cancel-modal"
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                id="btn-submit-decision"
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 transition cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>บันทึกผลการพิจารณา</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PlanDetailModal;
