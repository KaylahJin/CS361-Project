import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Check,
  Inbox,
  LayoutGrid,
  LayoutList,
  Loader2,
  Lock,
  LogIn,
  UserRound,
  XCircle,
} from 'lucide-react';

import type {
  PlanCounts,
  PlanReviewItem,
} from '../types/planReview';

import type {
  CoopPlan,
  CoopPlanQueryParams,
} from '../types/coopPlan';

import {
  getCoopPlan,
  getCoopPlans,
  reviewCoopPlan,
  CoopPlanApiError,
} from '../data/coopPlanApi';

import { useAuth } from '../auth/AuthContext';
import { PlanFilters } from '../components/plans/PlanFilters';
import { PlanListTable } from '../components/plans/PlanListTable';
import { PlanListCards } from '../components/plans/PlanListCards';
import { PlanProgressChart } from '../components/plans/PlanProgressChart';
import { PlanDetailModal } from '../components/plans/PlanDetailModal';

const PAGE_SIZE = 50;

interface ToastState {
  show: boolean;
  title: string;
  description: string;
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

      <h3 className="text-xl font-bold text-slate-800">
        {title}
      </h3>

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

      <div className="mt-8 rounded-xl bg-slate-50 border border-slate-200/70 p-3.5 text-xs text-slate-500 text-left w-full">
        <span className="font-semibold text-slate-700 block mb-1">
          💡 บัญชีทดสอบสำหรับผู้ตรวจ (Test Accounts):
        </span>
        <ul className="list-disc list-inside space-y-0.5 text-slate-600">
          <li>
            อาจารย์ที่ปรึกษา: <code className="bg-slate-200/60 px-1 py-0.5 rounded font-mono">advisor1@example.com</code>
          </li>
          <li>
            เจ้าหน้าที่สหกิจศึกษา: <code className="bg-slate-200/60 px-1 py-0.5 rounded font-mono">staff1@example.com</code>
          </li>
        </ul>
      </div>
    </div>
  );
}

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

interface CoopPlansProps {
  onNavigateLogin?: () => void;
}

export default function CoopPlans({ onNavigateLogin }: CoopPlansProps = {}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [curriculumFilter, setCurriculumFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const [plans, setPlans] = useState<PlanReviewItem[]>([]);
  const [counts, setCounts] = useState<PlanCounts>({
    ALL: 0,
    SUBMITTED: 0,
    RETURNED: 0,
    APPROVED: 0,
    REJECTED: 0,
    DRAFT: 0,
    PREPARING: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PlanError | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<PlanReviewItem | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<ToastState>({
    show: false,
    title: '',
    description: '',
  });

  const showToast = (title: string, description: string) => {
    setToast({ show: true, title, description });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4000);
  };

  // Read right before each request
  const { getIdToken, status: authStatus, user } = useAuth();
  const getIdTokenRef = useRef(getIdToken);
  getIdTokenRef.current = getIdToken;

  // Load plans & counts from real backend API
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getIdTokenRef.current();
      const params: CoopPlanQueryParams = {
        search: searchQuery.trim() || undefined,
        curriculum: curriculumFilter && curriculumFilter !== 'ALL' ? curriculumFilter : undefined,
        periodId: periodId && periodId !== 'ALL' ? periodId : undefined,
      };

      const apiPlans = await getCoopPlans(params, token);
      setPlans(apiPlans);

      const nextCounts: PlanCounts = {
        ALL: apiPlans.length,
        SUBMITTED: apiPlans.filter((p) => p.status === 'SUBMITTED').length,
        RETURNED: apiPlans.filter((p) => p.status === 'RETURNED').length,
        APPROVED: apiPlans.filter((p) => p.status === 'APPROVED').length,
        REJECTED: apiPlans.filter((p) => p.status === 'REJECTED').length,
        PREPARING: apiPlans.filter((p) => p.status === 'PREPARING').length,
        DRAFT: 0,
      };
      setCounts(nextCounts);
      setTotal(apiPlans.length);
    } catch (err) {
      setPlans([]);
      setSelectedPlan(null);
      setError(describePlanError(err, 'ไม่พบคำร้องที่ขอ'));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, curriculumFilter, periodId]);

  useEffect(() => {
    if (authStatus === 'loading') return;
    loadData();
  }, [loadData, authStatus]);

  // Callback when a review decision is saved
  const handleSaved = (updatedPlan: PlanReviewItem) => {
    setSelectedPlan(null);
    loadData();

    let decisionLabel = 'อนุมัติแผน';
    if (updatedPlan.status === 'RETURNED') decisionLabel = 'ส่งกลับแก้ไข';
    if (updatedPlan.status === 'REJECTED') decisionLabel = 'ไม่อนุมัติแผน';

    showToast(
      `บันทึกผลการพิจารณาเรียบร้อยแล้ว (${decisionLabel})`,
      `แผน #${updatedPlan.plan_id} ของ ${updatedPlan.first_name} ${updatedPlan.last_name} ได้รับการบันทึกสถานะเป็น "${updatedPlan.status}"`,
    );
  };

  const handleOpenPlan = async (plan: CoopPlan) => {
    setSelectedPlan(plan);
    try {
      const fresh = await getCoopPlan(plan.plan_id, await getIdToken());
      if (fresh) setSelectedPlan(fresh);
    } catch {
      // Keep existing plan item
    }
  };

  // Filter plans by status tab
  const displayedPlans = plans.filter((plan) => {
    if (!statusFilter || statusFilter === 'ALL') return true;
    return plan.status === statusFilter;
  });

  const isUnauthenticated = error && error.title === 'ลงชื่อเข้าใช้เพื่อดูแผนสหกิจ';

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
              <h4 className="text-sm font-bold text-slate-900">{toast.title}</h4>
              <p className="mt-0.5 text-xs text-slate-500">{toast.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Header with OKLCH Gradient */}
      <header
        style={{
          background:
            'linear-gradient(to right, oklch(0.38 0.15 266.5), oklch(0.12 0 0), oklch(0.37 0.12 245.27))',
        }}
        className="border-b border-white/10 text-white shadow-sm from-[oklch(0.38_0.15_266.5)] via-[oklch(0.12_0_0)] to-[oklch(0.37_0.12_245.27)] bg-gradient-to-r"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {/* Title */}
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-bold tracking-tight text-white sm:text-2xl">
              แผนสหกิจศึกษาและการพิจารณา
            </h1>
            <p className="mt-1 text-xs text-blue-100 sm:text-sm">
              ระบบตรวจสอบ จัดการ และบันทึกผลการพิจารณาแผนสหกิจศึกษา
            </p>
          </div>

          {/* User Account / Sign In Status Badge */}
          <div className="flex items-center gap-3">
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
        {/* Top Control Grid: Filters & Circular Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Title and Filters */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-bold text-slate-800 tracking-tight">
                  รายการแผนสหกิจศึกษา
                </h2>
              </div>

              <div className="flex items-center gap-2">
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
            </div>

            {/* Filters Component */}
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

          {/* Right Column: Circular Progress Chart */}
          {!isUnauthenticated && total > 0 && (
            <div className="lg:sticky lg:top-20">
              <PlanProgressChart counts={counts} total={total} />
            </div>
          )}
        </div>

        {/* Content Section: Table for Desktop, Cards for Mobile */}
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
              onRetry={error.canRetry ? loadData : undefined}
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
            {/* View Mode or Responsive (Table vs Cards) */}
            {viewMode === 'table' ? (
              <PlanListTable
                plans={displayedPlans}
                onOpen={handleOpenPlan}
              />
            ) : (
              <PlanListCards
                plans={displayedPlans}
                onOpen={handleOpenPlan}
              />
            )}

            {/* Simple Pagination / Record Counter */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
              <div>
                แสดง <span className="font-bold text-slate-700">{displayedPlans.length}</span> จาก{' '}
                <span className="font-bold text-slate-700">{total}</span> แผนทั้งหมดในความดูแล
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
      <PlanDetailModal
        plan={selectedPlan}
        open={Boolean(selectedPlan)}
        onOpenChange={(open) => {
          if (!open) setSelectedPlan(null);
        }}
        reviewerName={user?.email || 'ผู้ตรวจสอบ'}
        onSubmitReview={async ({ planId, decision, comment }) => {
          const token = await getIdToken();
          await reviewCoopPlan(planId, decision, comment, token);
          await loadData();
        }}
        onSaved={handleSaved}
      />
    </div>
  );
}