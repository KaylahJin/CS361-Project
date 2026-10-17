import { useEffect, useState } from 'react';
import {
  FileText,
  LayoutGrid,
  LayoutList,
  Loader2,
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
} from '../types/coopPlan';

import type { PlanCounts } from '../types/planReview';

import { useAuth } from '../auth/AuthContext';
import { PlanFilters } from '../components/plans/PlanFilters';
import { PlanListTable } from '../components/plans/PlanListTable';
import { PlanListCards } from '../components/plans/PlanListCards';
import { PlanProgressChart } from '../components/plans/PlanProgressChart';
import { PlanDetailModal } from '../components/plans/PlanDetailModal';

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
};

function describePlanError(err: unknown, notFound: string): PlanError {
  if (err instanceof CoopPlanApiError) {
    if (err.status === 401) {
      return {
        title: 'ลงชื่อเข้าใช้เพื่อดูแผนสหกิจ',
        detail: 'คำร้องแผนสหกิจเปิดให้เฉพาะผู้ที่ลงชื่อเข้าใช้แล้วเท่านั้น',
        canRetry: false,
      };
    }

    if (err.status === 403) {
      return {
        title: 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงแผนสหกิจ',
        detail:
          'การดูแผนสหกิจต้องใช้บทบาทนักศึกษา อาจารย์ที่ปรึกษา หรือเจ้าหน้าที่สหกิจ ' +
          'หากต้องการสิทธิ์นี้ ให้ผู้ดูแลระบบกำหนดบทบาทให้บัญชีของคุณ',
        canRetry: false,
      };
    }

    if (err.status === 404) {
      return {
        title: notFound,
        detail: 'ข้อมูลที่ขอไม่มีอยู่ หรือไม่อยู่ในสิทธิ์ของบัญชีนี้',
        canRetry: false,
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

function CoopPlans() {
  const [plans, setPlans] = useState<CoopPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<CoopPlan | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PlanError | null>(null);

  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [curriculum, setCurriculum] = useState('ALL');
  const [periodId, setPeriodId] = useState('');

  // Read right before each request, never at mount: the token expires after an
  // hour and this is what refreshes it. `authStatus` is here so the list
  // reloads when the session changes — see the effect below.
  const { getIdToken, status: authStatus, user } = useAuth();

  const loadPlans = async () => {
    setLoading(true);
    setError(null);

    try {
      const params: CoopPlanQueryParams = {
        search: search.trim() || undefined,
        curriculum: curriculum && curriculum !== 'ALL' ? curriculum : undefined,
        periodId: periodId && periodId !== 'ALL' ? periodId : undefined,
      };

      const data = await getCoopPlans(params, await getIdToken());
      setPlans(data);
    } catch (err) {
      // Drop whatever the previous caller could see. Leaving their rows on
      // screen after a refusal would show one person's plans to whoever is at
      // the keyboard next.
      setPlans([]);
      setSelectedPlan(null);
      setModalOpen(false);

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
  }, [search, curriculum, periodId, authStatus]);

  const handleOpenPlan = async (plan: CoopPlan) => {
    setSelectedPlan(plan);
    setModalOpen(true);

    try {
      const freshPlan = await getCoopPlan(plan.plan_id, await getIdToken());
      if (freshPlan) {
        setSelectedPlan(freshPlan);
      }
    } catch {
      // Keep displaying the current plan item if detail request fails
    }
  };

  const handlePlanSaved = (updatedPlan: CoopPlan) => {
    setPlans((prev) =>
      prev.map((p) => (p.plan_id === updatedPlan.plan_id ? updatedPlan : p))
    );
    setSelectedPlan(updatedPlan);
  };

  // Status aggregation counts across all plans
  const counts: PlanCounts = {
    ALL: plans.length,
    SUBMITTED: plans.filter((p) => p.status === 'SUBMITTED').length,
    RETURNED: plans.filter((p) => p.status === 'RETURNED').length,
    APPROVED: plans.filter((p) => p.status === 'APPROVED').length,
    REJECTED: plans.filter((p) => p.status === 'REJECTED').length,
    PREPARING: plans.filter((p) => p.status === 'PREPARING').length,
  };

  // Filter plans based on selected status tab
  const displayedPlans = plans.filter((plan) => {
    if (!statusFilter || statusFilter === 'ALL') return true;
    return plan.status === statusFilter;
  });

  const reviewerDisplayName = user?.email
    ? `ผู้ตรวจสอบ (${user.email})`
    : 'อาจารย์ที่ปรึกษา / เจ้าหน้าที่';

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header with Circular Progress Chart */}
      <section className="mb-8 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-bold text-blue-600">
            <FileText className="h-4 w-4" />
            Co-op Plan Review Dashboard
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            <span className="text-blue-600">Co-op</span> Plans Review
          </h1>

          <h2 className="mt-1 text-lg font-bold text-slate-700">
            ตรวจและติดตามแผนสหกิจศึกษา
          </h2>

          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-xl">
            ตรวจสอบรายการคำร้อง พิจารณาอนุมัติ ส่งกลับแก้ไข หรือติดตามสถานะแผนสหกิจของนักศึกษา
          </p>
        </div>

        {/* Progress chart summary (only rendered when there is data) */}
        {!loading && !error && plans.length > 0 && (
          <div className="self-start md:self-auto shrink-0">
            <PlanProgressChart counts={counts} total={plans.length} />
          </div>
        )}
      </section>

      {/* Filter Section */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <PlanFilters
          value={statusFilter}
          onChange={(newStatus) => setStatusFilter(newStatus)}
          counts={counts}
          total={plans.length}
          search={search}
          onSearchChange={(newSearch) => setSearch(newSearch)}
          curriculum={curriculum}
          onCurriculumChange={(newCurriculum) => setCurriculum(newCurriculum)}
          periodId={periodId}
          onPeriodChange={(newPeriod) => setPeriodId(newPeriod)}
        />
      </section>

      {/* Content Area */}
      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-6">
          <LoadingState text="กำลังโหลดข้อมูลคำร้อง..." />
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
        <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-6">
          <EmptyState />
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1 text-xs text-slate-500">
            <span>
              แสดง <strong className="font-semibold text-slate-700">{displayedPlans.length}</strong> จากทั้งหมด{' '}
              <strong className="font-semibold text-slate-700">{plans.length}</strong> รายการ
            </span>

            {/* View Mode Switcher */}
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

          {/* Table or Cards View */}
          {viewMode === 'table' ? (
            <PlanListTable plans={displayedPlans} onOpen={handleOpenPlan} />
          ) : (
            <PlanListCards plans={displayedPlans} onOpen={handleOpenPlan} />
          )}
        </section>
      )}

      {/* Plan Detail Modal */}
      <PlanDetailModal
        plan={selectedPlan}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedPlan(null);
        }}
        reviewerName={reviewerDisplayName}
        onSaved={handlePlanSaved}
      />
    </main>
  );
}

export default CoopPlans;