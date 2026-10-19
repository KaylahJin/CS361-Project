import { useEffect, useRef, useState } from 'react';

import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Search,
  UserRound,
  XCircle,
  Send,
} from 'lucide-react';

import {
  getCoopPlan,
  getCoopPlans,
  submitCoopPlan,
  CoopPlanApiError,
} from '../data/coopPlanApi';

import {
  isPlanEditable,
  type CoopPlan,
  type CoopPlanQueryParams,
  type CoopPlanStatus,
} from '../types/coopPlan';

import CoopPlanForm from '../pages/CoopPlanForm';

import { useAuth } from '../auth/AuthContext';

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
    APPROVED: {
      label: 'อนุมัติแล้ว',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    REJECTED: {
      label: 'ไม่อนุมัติ',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
  };

  const item = config[status];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${item.className}`}
    >
      {item.label}
    </span>
  );
}

function LoadingState({
  text = 'กำลังโหลดข้อมูล...',
}: {
  text?: string;
}) {
  return (
    <div className="flex min-h-[360px] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-500">
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

      <h3 className="text-base font-bold text-slate-700">
        {title}
      </h3>

      <p className="mt-2 max-w-md text-sm text-slate-400">
        {message}
      </p>

      {/* No retry button for a refusal: the same request can only be refused
          again, and offering the button suggests the problem is the network. */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          ลองอีกครั้ง
        </button>
      )}
    </div>
  );
}

/* ============================================================
   Why the list is empty

   The three answers mean different things to the person reading the
   page: sign in, ask for access, or try again. The API's own message
   ("Failed to fetch coop plans: Forbidden") said none of them, and sent
   an admin who simply has no plan access off to debug a network fault.

   An ADMIN reaching the 403 branch is not a bug — managing accounts and
   roles does not carry plan access, which is why the message names the
   roles that do.
   ============================================================ */

type PlanError = {
  title: string;
  detail: string;
  canRetry: boolean;
  // The HTTP status when the API answered. The page uses it to stop offering
  // "create a plan" to a caller the API has just refused.
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

function EmptyState() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
      <div className="mb-4 rounded-full bg-slate-100 p-4">
        <FileText className="h-7 w-7 text-slate-400" />
      </div>

      <h3 className="text-base font-bold text-slate-700">
        ไม่พบรายการคำร้อง
      </h3>

      <p className="mt-1 text-sm text-slate-400">
        ลองเปลี่ยนคำค้นหาหรือตัวกรอง
      </p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return '-';

  return new Date(value).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Why there is no edit button. Shown instead of the button so a student looking
// at a submitted or decided plan is told, not left to wonder where it went.
function lockedReason(status: CoopPlanStatus): string | null {
  switch (status) {
    case 'SUBMITTED':
      return 'แผนนี้ยื่นแล้วจึงแก้ไขไม่ได้ จนกว่าผู้พิจารณาจะส่งกลับให้แก้ไข';
    case 'APPROVED':
      return 'แผนนี้ได้รับอนุมัติแล้ว แก้ไขไม่ได้';
    case 'REJECTED':
      return 'แผนนี้ไม่ได้รับอนุมัติ แก้ไขไม่ได้';
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
      <span className="text-xs font-semibold text-slate-400">
        {label}
      </span>

      <span className="text-sm font-medium text-slate-700">
        {value || '-'}
      </span>
    </div>
  );
}

function submissionFailureLabel(code?: string): string {
  const labels: Record<string, string> = {
    POSITION_REQUIRED: 'กรุณาเลือกตำแหน่งงานก่อนยื่นแผน',
    ACKNOWLEDGEMENT_REQUIRED: 'กรุณารับทราบเงื่อนไขก่อนเริ่มสหกิจ',
    TERMS_NOT_ACCEPTED: 'กรุณายอมรับข้อกำหนดและเงื่อนไข',
    STUDENT_NOT_ELIGIBLE: 'คุณสมบัตินักศึกษายังไม่ผ่านเกณฑ์การยื่นแผน',
    GPA_TOO_LOW: 'เกรดเฉลี่ยยังไม่ถึงเกณฑ์ที่กำหนด',
    COURSE_GROUP_GPA_TOO_LOW:
      'เกรดเฉลี่ยในกลุ่มรายวิชายังไม่ถึงเกณฑ์ที่กำหนด',
    ONGOING_OR_STUDIED_COURSE_MISSING:
      'ยังไม่ผ่านเงื่อนไขรายวิชาที่กำหนด',
    SUBMISSION_WINDOW_CLOSED:
      'ยังไม่อยู่ในช่วงเวลาที่เปิดรับยื่นแผน',
    APPLICATION_WINDOW_CLOSED:
      'ยังไม่อยู่ในช่วงเวลาที่เปิดรับยื่นแผน',
  };

  if (code && labels[code]) {
    return labels[code];
  }

  return code
    ? `ยังไม่ผ่านเงื่อนไขข้อ ${code.replace(/_/g, ' ').toLowerCase()}`
    : 'กรุณาตรวจสอบข้อมูลและเงื่อนไขก่อนยื่นแผน';
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
      error.details?.map((item) => submissionFailureLabel(item.code)) ?? [];

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
}: {
  plan: CoopPlan;
  onBack: () => void;
  onEdit: () => void;
  onSubmitted: (plan: CoopPlan) => void;
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

            {/* A convenience, not the access control: the API checks the owner
                and the status again on every save. Advisors and staff can read
                a draft too, so the caption says who the button is for. */}
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

          <InfoRow
            label="รหัสนักศึกษา"
            value={plan.student_id}
          />

          <InfoRow
            label="ชื่อ-นามสกุล"
            value={`${plan.first_name} ${plan.last_name}`}
          />

          <InfoRow
            label="หลักสูตร"
            value={`หลักสูตร ${plan.curriculum}`}
          />

          <InfoRow
            label="รอบสหกิจ"
            value={plan.period_name || plan.period_id}
          />
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

          <InfoRow
            label="ชื่อบริษัท"
            value={plan.company_name}
          />

          <InfoRow
            label="ชื่อย่อ"
            value={plan.company_short_name}
          />

          <InfoRow
            label="รหัสบริษัท"
            value={plan.company_id}
          />

          <InfoRow
            label="ตำแหน่ง"
            value={plan.position_title}
          />

          <InfoRow
            label="รหัสตำแหน่ง"
            value={plan.position_id}
          />
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
            <InfoRow
              label="หมายเหตุจากนักศึกษา"
              value={plan.student_note}
            />
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

          <InfoRow
            label="ผู้ตรวจสอบ"
            value={plan.reviewer_name}
          />

          <InfoRow
            label="วันที่ตรวจสอบ"
            value={formatDate(plan.reviewed_at)}
          />

          <InfoRow
            label="ความคิดเห็น"
            value={plan.review_comment}
          />

          <InfoRow
            label="วันที่ยื่นคำร้อง"
            value={formatDate(plan.submitted_at)}
          />
        </section>
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

function CoopPlans() {
  const [plans, setPlans] = useState<CoopPlan[]>([]);
  const [selectedPlan, setSelectedPlan] =
    useState<CoopPlan | null>(null);

  // The create/edit form, when open. `plan` is absent for a new plan.
  const [editor, setEditor] = useState<{ plan?: CoopPlan } | null>(null);

  // The newest plan the open form saved, exactly as the API returned it. When
  // the form closes the page shows this, so what is on screen is what the
  // database holds rather than what the student last typed.
  const savedInEditor = useRef<CoopPlan | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<PlanError | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] =
    useState<CoopPlanStatus | ''>('');
  const [curriculum, setCurriculum] = useState('');
  const [periodId, setPeriodId] = useState('');

  // Read right before each request, never at mount: the token expires after an
  // hour and this is what refreshes it. `authStatus` is here so the list
  // reloads when the session changes — see the effect below.
  const { getIdToken, status: authStatus } = useAuth();

  const loadPlans = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: CoopPlanQueryParams = {
        search: search.trim() || undefined,
        status: status || undefined,
        curriculum: curriculum || undefined,
        periodId: periodId || undefined,
      };

      const data = await getCoopPlans(params, await getIdToken());
      setPlans(data);
    } catch (err) {
      // Drop whatever the previous caller could see. Leaving their rows on
      // screen after a refusal would show one person's plans to whoever is at
      // the keyboard next.
      setPlans([]);
      setSelectedPlan(null);

      setError(describePlanError(err, 'ไม่พบคำร้องที่ขอ'));
    } finally {
      setLoading(false);
    }
  };

  // authStatus belongs in here: signing in or out changes which plans exist
  // for this caller, and without it the page keeps showing the previous
  // session's result until something else happens to re-render.
  //
  // Nothing is fetched while the stored session is still being restored. A
  // request sent in that window would carry no token and come back 401, and
  // the user would watch an error appear and then correct itself.
  useEffect(() => {
    if (authStatus === 'loading') return;
    loadPlans();
  }, [search, status, curriculum, periodId, authStatus]);

  const handleSelectPlan = async (planId: number) => {
    setDetailLoading(true);
    setError(null);

    try {
      const plan = await getCoopPlan(planId, await getIdToken());
      setSelectedPlan(plan);
    } catch (err) {
      setError(describePlanError(err, 'ไม่พบคำร้องนี้'));
    } finally {
      setDetailLoading(false);
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

    // The list behind the form should show what was just saved.
    void loadPlans();
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
      />
    );
  }

  // Offered to anyone signed in, except a caller the list has just refused: a
  // 401/403 there means the account has no plan role, so a create form could
  // only be refused too. Which role may create is still decided by the API —
  // an advisor or staff member gets the button and a 403 when they use it.
  const canCreate =
    authStatus === 'authenticated' &&
    !(error && (error.status === 401 || error.status === 403));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <section className="mb-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-bold text-blue-600">
          <FileText className="h-4 w-4" />
          Co-op Plan Management
        </div>

        <h1 className="text-4xl font-black tracking-tight text-slate-900">
          <span className="text-blue-600">Co-op</span> Plans
        </h1>

        <h2 className="mt-2 text-xl font-bold text-slate-800">
          รายการคำร้องแผนสหกิจศึกษา
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          ตรวจสอบรายการคำร้องแผนสหกิจศึกษา
          สถานะการพิจารณา และรายละเอียดนักศึกษาและสถานประกอบการ
        </p>

        {canCreate && (
          <button
            type="button"
            onClick={() => openEditor()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            สร้างแผนใหม่
          </button>
        )}
      </section>

      {/* Filters */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_180px_200px_180px]">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหารหัสนักศึกษา ชื่อ ตำแหน่ง หรือบริษัท..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Curriculum Filter */}
          <select
            value={curriculum}
            onChange={(e) => setCurriculum(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">ทุกหลักสูตร</option>
            <option value="61">หลักสูตร 61</option>
            <option value="66">หลักสูตร 66</option>
          </select>

          {/* Term Filter */}
          <select
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">
              ทุกรอบปีการศึกษา / ภาคเรียน
            </option>

            <option value="P2568-1">
              ปีการศึกษา 2568 ภาคเรียนที่ 1
            </option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) =>
              setStatus(
                e.target.value as CoopPlanStatus | '',
              )
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">ทุกสถานะ</option>
            <option value="PREPARING">กำลังเตรียม</option>
            <option value="SUBMITTED">ยื่นแล้ว</option>
            <option value="RETURNED">ส่งกลับแก้ไข</option>
            <option value="APPROVED">อนุมัติแล้ว</option>
            <option value="REJECTED">ไม่อนุมัติ</option>
          </select>
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="font-bold text-slate-800">
              รายการคำร้อง
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              {loading
                ? 'กำลังโหลดข้อมูล...'
                : `${plans.length} รายการ`}
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingState text="กำลังโหลดข้อมูลคำร้อง..." />
        ) : error ? (
          <ErrorState
            title={error.title}
            message={error.detail}
            onRetry={error.canRetry ? loadPlans : undefined}
          />
        ) : plans.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500">
                    นักศึกษา
                  </th>

                  <th className="px-6 py-4 text-xs font-bold text-slate-500">
                    หลักสูตร
                  </th>

                  <th className="px-6 py-4 text-xs font-bold text-slate-500">
                    ตำแหน่ง / บริษัท
                  </th>

                  <th className="px-6 py-4 text-xs font-bold text-slate-500">
                    วันที่ยื่น
                  </th>

                  <th className="px-6 py-4 text-xs font-bold text-slate-500">
                    สถานะ
                  </th>
                </tr>
              </thead>

              <tbody>
                {plans.map((plan) => (
                  <tr
                    key={plan.plan_id}
                    onClick={() =>
                      handleSelectPlan(plan.plan_id)
                    }
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-blue-50/40 last:border-0"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">
                        {plan.first_name} {plan.last_name}
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        {plan.student_id}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {plan.curriculum}
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-700">
                        {plan.position_title ||
                          'ยังไม่ได้เลือกตำแหน่ง'}
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        {plan.company_name ||
                          'ยังไม่ได้เลือกสถานประกอบการ'}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-500">
                      {formatDate(plan.submitted_at)}
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge status={plan.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Detail loading */}
      {detailLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />

            <span className="text-sm font-semibold text-slate-600">
              กำลังโหลดรายละเอียด...
            </span>
          </div>
        </div>
      )}
    </main>
  );
}

export default CoopPlans;