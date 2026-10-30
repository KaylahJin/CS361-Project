// ============================================================
// CS361 V3 — Coop Plans List & Review Dashboard
// Issue: #106, #107, #108 (V3-05) & #112, #113 (V3-04)
// ============================================================

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  FileText,
  GraduationCap,
  Inbox,
  LayoutGrid,
  LayoutList,
  Loader2,
  Lock,
  LogIn,
  Pencil,
  Plus,
  Send,
  UserRound,
  XCircle,
} from 'lucide-react';

import {
  getCoopPlan,
  getCoopPlans,
  submitCoopPlan,
  endorseCoopPlan,
  screenCoopPlan,
  CoopPlanApiError,
} from '../data/coopPlanApi';

import {
  isPlanEditable,
  type CoopPlan,
  type CoopPlanStatus,
} from '../types/coopPlan';

import type {
  PlanCounts,
  PlanReviewItem,
} from '../types/planReview';

import CoopPlanForm from '../pages/CoopPlanForm';
import { useAuth } from '../auth/AuthContext';
import { submissionFailureLabel } from './submissionMessages';
import { canEndorsePlans, canReviewPlans, canScreenPlans, reviewableStatusFor } from '../auth/roles';
import { PlanFilters } from '../components/plans/PlanFilters';
import { PlanListTable } from '../components/plans/PlanListTable';
import { PlanListCards } from '../components/plans/PlanListCards';
import { PlanProgressChart } from '../components/plans/PlanProgressChart';
import { PlanDetailModal } from '../components/plans/PlanDetailModal';
import PlanAttachmentSummary from '../components/plans/PlanAttachmentSummary';

const PAGE_SIZE = 50;

function StatusBadge({ status }: { status: CoopPlanStatus }) {
  const config = {
    PREPARING: {
      label: 'กำลังเตรียม',
      className: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    SUBMITTED: {
      label: 'รอตรวจ',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    RETURNED: {
      label: 'ส่งกลับแก้ไข',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    ENDORSED: {
      label: 'อาจารย์รับรองแล้ว',
      className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    ELIGIBLE: {
      label: 'ผ่านการตรวจ รอคัดเลือก',
      className: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    NOT_ELIGIBLE: {
      label: 'ไม่ผ่านการตรวจคุณสมบัติ',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
    APPROVED: {
      label: 'อนุมัติแล้ว',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    REJECTED: {
      label: 'ไม่อนุมัติ',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
  };

  const item = config[status] || config.PREPARING;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${item.className}`}
    >
      {item.label}
    </span>
  );
}

interface ToastState {
  show: boolean;
  title: string;
  description: string;
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

function LoadingState({
  text = 'กำลังโหลดข้อมูล...',
}: {
  text?: string;
}) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">{text}</p>
      </div>
    </div>
  );
}

function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-full bg-red-50 p-4">
        <XCircle className="h-7 w-7 text-red-500" />
      </div>

      <h3 className="text-base font-bold text-slate-700">{title}</h3>

      <p className="mt-2 max-w-md text-sm text-slate-400">{message}</p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition"
        >
          ลองอีกครั้ง
        </button>
      )}
    </div>
  );
}

function UnauthenticatedState({
  title,
  message,
  onLogin,
}: {
  title: string;
  message: string;
  onLogin?: () => void;
}) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-10 text-center max-w-lg mx-auto">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 shadow-xs">
        <Lock className="h-7 w-7" />
      </div>

      <h3 className="text-xl font-bold text-slate-800">{title}</h3>

      <p className="mt-2 text-sm text-slate-500 leading-relaxed">
        {message} สำหรับอาจารย์ที่ปรึกษาและเจ้าหน้าที่ในการตรวจสอบ อนุมัติ หรือส่งกลับแก้ไขแผนสหกิจ
      </p>

      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
        {onLogin && (
          <button
            type="button"
            onClick={onLogin}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-blue-700 active:scale-95 transition cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            <span>เข้าสู่ระบบ (Sign In)</span>
          </button>
        )}
      </div>
    </div>
  );
}

type PlanError = {
  title: string;
  detail: string;
  canRetry: boolean;
  status?: number;
};

function describePlanError(err: unknown, notFound: string): PlanError {
  if (err instanceof CoopPlanApiError) {
    if (err.status === 401) {
      return {
        title: 'ลงชื่อเข้าใช้เพื่อดูแผนสหกิจ',
        detail: 'คำร้องแผนสหกิจเปิดให้เฉพาะผู้ที่ลงชื่อเข้าใช้แล้วเท่านั้น',
        canRetry: false,
        status: 401,
      };
    }

    if (err.status === 403) {
      return {
        title: 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงแผนสหกิจ',
        detail:
          'การดูแผนสหกิจต้องใช้บทบาทนักศึกษา อาจารย์ที่ปรึกษา หรือเจ้าหน้าที่สหกิจ ' +
          'หากต้องการสิทธิ์นี้ ให้ผู้ดูแลระบบกำหนดบทบาทให้บัญชีของคุณ',
        canRetry: false,
        status: 403,
      };
    }

    if (err.status === 404) {
      return {
        title: notFound,
        detail: 'ข้อมูลที่ขอไม่มีอยู่ หรือไม่อยู่ในสิทธิ์ของบัญชีนี้',
        canRetry: false,
        status: 404,
      };
    }
  }

  return {
    title: 'ไม่สามารถโหลดข้อมูลได้',
    detail: 'เกิดข้อผิดพลาดระหว่างเชื่อมต่อกับระบบ กรุณาลองใหม่อีกครั้ง',
    canRetry: true,
  };
}

function lockedReason(status: CoopPlanStatus): string | null {
  switch (status) {
    case 'SUBMITTED':
      return 'แผนนี้ยื่นแล้วจึงแก้ไขไม่ได้ จนกว่าผู้พิจารณาจะส่งกลับให้แก้ไข';
    case 'APPROVED':
      return 'แผนนี้ได้รับอนุมัติแล้ว แก้ไขไม่ได้';
    case 'REJECTED':
      return 'แผนนี้ไม่ได้รับอนุมัติ แก้ไขไม่ได้';
    case 'ELIGIBLE':
      return 'แผนนี้ผ่านการตรวจแล้ว รอคัดเลือก แก้ไขไม่ได้';
    case 'NOT_ELIGIBLE':
      return 'แผนนี้ไม่ผ่านการตรวจคุณสมบัติ แก้ไขไม่ได้';
    default:
      return null;
  }
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-700">{value || '-'}</span>
    </div>
  );
}

function describeSubmissionError(error: unknown): string[] {
  if (!(error instanceof CoopPlanApiError)) {
    return ['เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง'];
  }

  if (error.status === 401) {
    return ['เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'];
  }

  if (error.status === 403) {
    return ['บัญชีนี้ไม่มีสิทธิ์ยื่นแผนนี้ หรือแผนนี้ไม่ใช่ของคุณ'];
  }

  if (error.code === 'ALREADY_SUBMITTED') {
    return ['แผนนี้ถูกยื่นแล้ว ไม่สามารถยื่นซ้ำได้'];
  }

  if (error.code === 'PLAN_NOT_SUBMITTABLE') {
    return ['สถานะปัจจุบันไม่อนุญาตให้ยื่นแผน'];
  }

  if (error.code === 'SUBMISSION_REQUIREMENTS_NOT_MET') {
    const details =
      error.details?.map((item) => submissionFailureLabel(item.code, item.message)) ?? [];

    return details.length
      ? details
      : ['ข้อมูลหรือคุณสมบัติยังไม่ครบตามเงื่อนไขการยื่นแผน'];
  }

  if (error.status === 409) {
    return ['สถานะของแผนเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุด'];
  }

  return ['ยื่นแผนไม่สำเร็จเนื่องจากระบบขัดข้อง กรุณาลองอีกครั้ง'];
}

function PlanDetail({
  plan,
  onBack,
  onEdit,
  onSubmitted,
  onReview,
  reviewableStatus,
}: {
  plan: CoopPlan;
  onBack: () => void;
  onEdit: () => void;
  onSubmitted: (plan: CoopPlan) => void;
  onReview?: (plan: CoopPlan) => void;
  reviewableStatus: CoopPlanStatus;
}) {
  const locked = lockedReason(plan.status);
  const { getIdToken } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string[] | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const canSubmit =
    plan.status === 'PREPARING' || plan.status === 'RETURNED';

  const handleSubmitPlan = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const submitted = await submitCoopPlan(
        plan.plan_id,
        await getIdToken()
      );

      onSubmitted(submitted);
      setConfirmSubmit(false);
      setSubmitSuccess(true);
    } catch (error) {
      setSubmitError(describeSubmissionError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-blue-600"
      >
        <ArrowLeft className="h-4 w-4" />
        กลับรายการคำร้อง
      </button>

      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-bold text-blue-600">
          <FileText className="h-4 w-4" />
          Co-op Plan Detail
        </div>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              รายละเอียดแผนสหกิจ
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Plan #{plan.plan_id} · {plan.period_name || plan.period_id}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <StatusBadge status={plan.status} />

            {isPlanEditable(plan.status) && (
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  <Pencil className="h-4 w-4" />
                  แก้ไขแผน
                </button>

                <p className="text-xs text-slate-500">
                  แก้ไขได้เฉพาะนักศึกษาเจ้าของแผน
                </p>
              </div>
            )}

            {canSubmit && (
              <button
                type="button"
                onClick={() => {
                  setSubmitError(null);
                  setConfirmSubmit(true);
                }}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {plan.status === 'RETURNED' ? 'ยื่นแผนอีกครั้ง' : 'ยื่นแผน'}
              </button>
            )}

            {plan.status === reviewableStatus && onReview && (
              <button
                type="button"
                onClick={() => onReview(plan)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                ตรวจพิจารณาแผน
              </button>
            )}
          </div>
        </div>

        {locked && (
          <p className="mt-4 text-sm text-slate-500">{locked}</p>
        )}
      </div>

      {submitSuccess && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"
        >
          ยื่นแผนสำเร็จแล้ว
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Student */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3">
              <GraduationCap className="h-5 w-5 text-blue-600" />
            </div>

            <div>
              <h2 className="font-bold text-slate-800">
                ข้อมูลนักศึกษา
              </h2>

              <p className="text-xs text-slate-400">
                Student Information
              </p>
            </div>
          </div>

          <InfoRow label="รหัสนักศึกษา" value={plan.student_id} />
          <InfoRow label="ชื่อ-นามสกุล" value={`${plan.first_name} ${plan.last_name}`} />
          <InfoRow label="หลักสูตร" value={`หลักสูตร ${plan.curriculum}`} />
          <InfoRow label="รอบสหกิจ" value={plan.period_name || plan.period_id} />
        </section>

        {/* Company */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 p-3">
              <Building2 className="h-5 w-5 text-indigo-600" />
            </div>

            <div>
              <h2 className="font-bold text-slate-800">
                สถานประกอบการ
              </h2>

              <p className="text-xs text-slate-400">
                Company Information
              </p>
            </div>
          </div>

          <InfoRow label="ชื่อบริษัท" value={plan.company_name} />
          <InfoRow label="ชื่อย่อ" value={plan.company_short_name} />
          <InfoRow label="รหัสบริษัท" value={plan.company_id} />
          <InfoRow label="ตำแหน่ง" value={plan.position_title} />
          <InfoRow label="รหัสตำแหน่ง" value={plan.position_id} />
        </section>

        {/* Terms */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>

            <div>
              <h2 className="font-bold text-slate-800">
                การยอมรับเงื่อนไข
              </h2>

              <p className="text-xs text-slate-400">
                Pre-co-op Conditions
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">
                ยอมรับเงื่อนไขก่อนเริ่มสหกิจ
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {plan.terms_accepted_at
                  ? `ยอมรับเมื่อ ${formatDate(plan.terms_accepted_at)}`
                  : 'ยังไม่ได้ยอมรับเงื่อนไข'}
              </p>
            </div>

            {plan.acknowledged_pre_course ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            ) : (
              <XCircle className="h-6 w-6 text-slate-300" />
            )}
          </div>

          <div className="mt-4">
            <InfoRow label="หมายเหตุจากนักศึกษา" value={plan.student_note} />
          </div>
        </section>

        {/* Review */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-3">
              <UserRound className="h-5 w-5 text-amber-600" />
            </div>

            <div>
              <h2 className="font-bold text-slate-800">
                ผลการพิจารณา
              </h2>

              <p className="text-xs text-slate-400">
                Review Information
              </p>
            </div>
          </div>

          <InfoRow label="ผู้ตรวจสอบ" value={plan.reviewer_name} />
          <InfoRow label="วันที่ตรวจสอบ" value={formatDate(plan.reviewed_at)} />
          <InfoRow label="ความคิดเห็น" value={plan.review_comment} />
        </section>

        <PlanAttachmentSummary
          planId={plan.plan_id}
          getIdToken={getIdToken}
        />
      </div>

      {confirmSubmit && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => {
            if (!submitting) setConfirmSubmit(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-submit-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="confirm-submit-title"
              className="text-lg font-bold text-slate-900"
            >
              ยืนยันการยื่นแผน
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              เมื่อต้องการยื่นแผน ระบบจะส่งข้อมูลเพื่อรอการพิจารณา
              โปรดตรวจสอบข้อมูลก่อนยืนยัน
            </p>

            {submitError && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"
              >
                <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
                  {submitError.map((message, index) => (
                    <li key={`${index}-${message}`}>{message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmSubmit(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitPlan}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                ยืนยันยื่นแผน
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

interface CoopPlansProps {
  onNavigateLogin?: () => void;
}

export default function CoopPlans({ onNavigateLogin }: CoopPlansProps = {}) {
  const [plans, setPlans] = useState<PlanReviewItem[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<CoopPlan | null>(null);
  const [reviewPlan, setReviewPlan] = useState<CoopPlan | null>(null);

  const [editor, setEditor] = useState<{ plan?: CoopPlan } | null>(null);
  const savedInEditor = useRef<CoopPlan | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PlanError | null>(null);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [curriculumFilter, setCurriculumFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const [toast, setToast] = useState<ToastState>({
    show: false,
    title: '',
    description: '',
  });

  const { getIdToken, status: authStatus, user, role } = useAuth();
  // Only reviewer roles get the review button and form. A student sees their
  // plans read-only. The API refuses a student's review call anyway (403).
  const canReview = canReviewPlans(role);
  const reviewableStatus = reviewableStatusFor(role);

  const loadPlans = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getCoopPlans({}, await getIdToken());
      setPlans(data || []);
    } catch (err) {
      setPlans([]);
      setSelectedPlan(null);
      setError(describePlanError(err, 'ไม่พบคำร้องที่ขอ'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus === 'loading') return;
    loadPlans();
  }, [authStatus]);

  const counts: PlanCounts = {
    ALL: plans.length,
    SUBMITTED: plans.filter((p) => p.status === 'SUBMITTED').length,
    RETURNED: plans.filter((p) => p.status === 'RETURNED').length,
    APPROVED: plans.filter((p) => p.status === 'APPROVED').length,
    REJECTED: plans.filter((p) => p.status === 'REJECTED').length,
    PREPARING: plans.filter((p) => p.status === 'PREPARING').length,
  };
  const total = plans.length;

  const handleSelectPlan = async (plan: CoopPlan) => {
    setSelectedPlan(plan);
    try {
      const fresh = await getCoopPlan(plan.plan_id, await getIdToken());
      if (fresh) setSelectedPlan(fresh);
    } catch {
      // keep existing
    }
  };

  const handleReviewPlan = async (plan: CoopPlan) => {
    setReviewPlan(plan);
    try {
      const fresh = await getCoopPlan(plan.plan_id, await getIdToken());
      if (fresh) setReviewPlan(fresh);
    } catch {
      // keep existing
    }
  };

  const openEditor = (plan?: CoopPlan) => {
    savedInEditor.current = null;
    setEditor({ plan });
  };

  const closeEditor = () => {
    const back = savedInEditor.current ?? editor?.plan ?? null;
    savedInEditor.current = null;
    setEditor(null);
    setSelectedPlan(back);
    void loadPlans();
  };

  const handleSavedReview = (updatedPlan: CoopPlan) => {
    setPlans((prev) =>
      prev.map((p) => (p.plan_id === updatedPlan.plan_id ? updatedPlan : p))
    );
    setToast({
      show: true,
      title: 'บันทึกผลสำเร็จ',
      description: `บันทึกผลการพิจารณาสำหรับแผน ${updatedPlan.student_id} เรียบร้อยแล้ว`,
    });
    setTimeout(() => {
      setToast({ show: false, title: '', description: '' });
    }, 4000);
  };

  if (editor) {
    return (
      <CoopPlanForm
        key={editor.plan?.plan_id ?? 'new'}
        plan={editor.plan}
        onBack={closeEditor}
        onSaved={(saved) => {
          savedInEditor.current = saved;
        }}
      />
    );
  }

  if (selectedPlan) {
    return (
      <PlanDetail
        plan={selectedPlan}
        onBack={() => setSelectedPlan(null)}
        onEdit={() => openEditor(selectedPlan)}
        onSubmitted={(submitted) => {
          setSelectedPlan(submitted);
          void loadPlans();
        }}
        onReview={canReview ? (plan) => handleReviewPlan(plan) : undefined}
        reviewableStatus={reviewableStatus}
      />
    );
  }

  const canCreate =
    authStatus === 'authenticated' &&
    !(error && (error.status === 401 || error.status === 403));

  const isUnauthenticated =
    error && error.title === 'ลงชื่อเข้าใช้เพื่อดูแผนสหกิจ';

  const displayedPlans = plans.filter((plan) => {
    if (statusFilter && statusFilter !== 'ALL') {
      if (plan.status !== statusFilter) return false;
    }
    if (curriculumFilter && curriculumFilter !== 'ALL') {
      if (plan.curriculum !== curriculumFilter) return false;
    }
    if (periodId) {
      if (plan.period_id !== periodId) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchStudentId = plan.student_id?.toLowerCase().includes(q);
      const matchName = `${plan.first_name} ${plan.last_name}`
        .toLowerCase()
        .includes(q);
      const matchPosition = plan.position_title?.toLowerCase().includes(q);
      const matchCompany = (
        plan.company_name || plan.company_short_name
      )
        ?.toLowerCase()
        .includes(q);
      if (!matchStudentId && !matchName && !matchPosition && !matchCompany) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      {/* Toast Notification Banner */}
      {toast.show && (
        <div className="fixed top-20 right-4 z-50 max-w-md rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl shadow-slate-900/10 transition-all animate-in slide-in-from-top-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Check className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-900">
                {toast.title}
              </h4>
              <p className="mt-0.5 text-xs text-slate-500">
                {toast.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <header
        style={{
          background:
            'linear-gradient(to right, oklch(0.38 0.15 266.5), oklch(0.12 0 0), oklch(0.37 0.12 245.27))',
        }}
        className="border-b border-white/10 text-white shadow-sm from-[oklch(0.38_0.15_266.5)] via-[oklch(0.12_0_0)] to-[oklch(0.37_0.12_245.27)] bg-gradient-to-r"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-bold tracking-tight text-white sm:text-2xl">
              แผนสหกิจศึกษาและการพิจารณา
            </h1>
            <p className="mt-1 text-xs text-blue-100 sm:text-sm">
              ระบบตรวจสอบ จัดการ และบันทึกผลการพิจารณาแผนสหกิจศึกษา
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canCreate && (
              <button
                type="button"
                onClick={() => openEditor()}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-blue-500 active:scale-95 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>สร้างแผนใหม่</span>
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm text-white shadow-xs">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-blue-100">
                  <UserRound className="h-4 w-4 shrink-0" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-xs sm:text-sm leading-none">
                    {user.email}
                  </div>
                  <div className="text-[11px] text-blue-200 leading-tight mt-1">
                    เข้าสู่ระบบแล้ว
                  </div>
                </div>
              </div>
            ) : onNavigateLogin ? (
              <button
                type="button"
                onClick={onNavigateLogin}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-4 py-2 text-xs sm:text-sm font-bold text-white backdrop-blur-sm hover:bg-white/25 transition cursor-pointer"
              >
                <LogIn className="h-4 w-4" />
                <span>เข้าสู่ระบบ</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-bold text-slate-800 tracking-tight">
                  รายการคำร้องแผนสหกิจศึกษา
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      viewMode === 'table'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="มุมมองตาราง"
                  >
                    <LayoutList className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">ตาราง</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                      viewMode === 'cards'
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="มุมมองการ์ด"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">การ์ด</span>
                  </button>
                </div>
              </div>
            </div>

            {!isUnauthenticated && (
              <PlanFilters
                value={statusFilter}
                onChange={setStatusFilter}
                counts={counts}
                total={total}
                search={searchQuery}
                onSearchChange={setSearchQuery}
                curriculum={curriculumFilter}
                onCurriculumChange={setCurriculumFilter}
                periodId={periodId}
                onPeriodChange={setPeriodId}
              />
            )}
          </div>

          {!isUnauthenticated && total > 0 && (
            <div className="lg:sticky lg:top-20">
              <PlanProgressChart counts={counts} total={total} />
            </div>
          )}
        </div>

        {loading ? (
          <LoadingState text="กำลังโหลดรายการแผนสหกิจ..." />
        ) : isUnauthenticated ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-6">
            <UnauthenticatedState
              title={error.title}
              message={error.detail}
              onLogin={onNavigateLogin}
            />
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-6">
            <ErrorState
              title={error.title}
              message={error.detail}
              onRetry={error.canRetry ? loadPlans : undefined}
            />
          </section>
        ) : displayedPlans.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Inbox className="h-7 w-7" />
            </div>
            <h3 className="mt-4 font-heading text-base font-bold text-slate-800">
              ไม่พบรายการแผนสหกิจศึกษา
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm">
              {searchQuery || statusFilter !== 'ALL' || curriculumFilter !== 'ALL'
                ? 'ลองปรับเปลี่ยนเงื่อนไขการค้นหา หรือตัวกรองสถานะ'
                : 'ยังไม่มีแผนที่อยู่ในขอบเขตของผู้ตรวจในขณะนี้'}
            </p>
            {(searchQuery || statusFilter !== 'ALL' || curriculumFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setCurriculumFilter('ALL');
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {viewMode === 'table' ? (
              <PlanListTable
                plans={displayedPlans}
                onOpen={handleSelectPlan}
                onReview={canReview ? handleReviewPlan : undefined}
                reviewableStatus={reviewableStatus}
              />
            ) : (
              <PlanListCards
                plans={displayedPlans}
                onOpen={handleSelectPlan}
                onReview={canReview ? handleReviewPlan : undefined}
                reviewableStatus={reviewableStatus}
              />
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
              <div>
                แสดง{' '}
                <span className="font-bold text-slate-700">
                  {displayedPlans.length}
                </span>{' '}
                จาก{' '}
                <span className="font-bold text-slate-700">{total}</span>{' '}
                แผนทั้งหมดในความดูแล
              </div>
              {plans.length >= PAGE_SIZE && (
                <div className="text-[11px] text-slate-400">
                  (จำกัดการแสดงผล {PAGE_SIZE} รายการแรก)
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Plan Detail & Consideration Modal (V3-05.2) */}
      {canReview && (
        <PlanDetailModal
          plan={reviewPlan}
          open={Boolean(reviewPlan)}
          onOpenChange={(open) => {
            if (!open) setReviewPlan(null);
          }}
          reviewerName={user?.email || 'ผู้ตรวจสอบ'}
          getIdToken={getIdToken}
          onEndorse={
            canEndorsePlans(role)
              ? async ({ planId, decision, comment }) =>
                  endorseCoopPlan(planId, decision, comment, await getIdToken())
              : undefined
          }
          onScreen={
            canScreenPlans(role)
              ? async ({ planId, decision, comment }) =>
                  screenCoopPlan(planId, decision, comment, await getIdToken())
              : undefined
          }
          onSaved={handleSavedReview}
        />
      )}
    </div>
  );
}