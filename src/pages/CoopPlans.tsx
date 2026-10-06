import { useEffect, useState } from 'react';

import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileText,
  GraduationCap,
  Loader2,
  Search,
  UserRound,
  XCircle,
} from 'lucide-react';

import {
  getCoopPlan,
  getCoopPlans,
  CoopPlanApiError,
} from '../data/coopPlanApi';

import type {
  CoopPlan,
  CoopPlanQueryParams,
  CoopPlanStatus,
} from '../types/coopPlan';

function StatusBadge({ status }: { status: CoopPlanStatus }) {
  const config = {
    PREPARING: {
      label: 'กำลังเตรียม',
      className: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    SUBMITTED: {
      label: 'ยื่นแล้ว',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    UNDER_REVIEW: {
      label: 'กำลังตรวจสอบ',
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
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-full bg-red-50 p-4">
        <XCircle className="h-7 w-7 text-red-500" />
      </div>

      <h3 className="text-base font-bold text-slate-700">
        ไม่สามารถโหลดข้อมูลได้
      </h3>

      <p className="mt-2 max-w-md text-sm text-slate-400">
        {message}
      </p>

      <button
        onClick={onRetry}
        className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
      >
        ลองอีกครั้ง
      </button>
    </div>
  );
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

function PlanDetail({
  plan,
  onBack,
}: {
  plan: CoopPlan;
  onBack: () => void;
}) {
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

          <StatusBadge status={plan.status} />
        </div>
      </div>

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
    </main>
  );
}

function CoopPlans() {
  const [plans, setPlans] = useState<CoopPlan[]>([]);
  const [selectedPlan, setSelectedPlan] =
    useState<CoopPlan | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] =
    useState<CoopPlanStatus | ''>('');
  const [curriculum, setCurriculum] = useState('');
  const [periodId, setPeriodId] = useState('');

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

      const data = await getCoopPlans(params);
      setPlans(data);
    } catch (err) {
      if (err instanceof CoopPlanApiError) {
        setError(err.message);
      } else {
        setError('ไม่สามารถเชื่อมต่อกับ API ได้');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [search, status, curriculum, periodId]);

  const handleSelectPlan = async (planId: number) => {
    setDetailLoading(true);
    setError(null);

    try {
      const plan = await getCoopPlan(planId);
      setSelectedPlan(plan);
    } catch (err) {
      if (err instanceof CoopPlanApiError) {
        setError(err.message);
      } else {
        setError('ไม่สามารถโหลดรายละเอียดคำร้องได้');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  if (selectedPlan) {
    return (
      <PlanDetail
        plan={selectedPlan}
        onBack={() => setSelectedPlan(null)}
      />
    );
  }

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
            <option value="UNDER_REVIEW">กำลังตรวจสอบ</option>
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
            message={error}
            onRetry={loadPlans}
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