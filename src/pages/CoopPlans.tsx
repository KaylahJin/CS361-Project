import { useEffect, useState } from 'react';
import {
  FileText,
  LayoutGrid,
  LayoutList,
  Loader2,
  Lock,
  LogIn,
  Sparkles,
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

// Sample plans for local demonstration & preview
const DEMO_PLANS: CoopPlan[] = [
  {
    plan_id: 101,
    student_id: '6609600001',
    first_name: 'กิตติภูมิ',
    last_name: 'พัฒนาชัย',
    curriculum: '66',
    gpa: 3.75,
    advisor_name: 'อ.สมชาย ใจดี',
    period_id: 'P2568-1',
    period_name: 'ปีการศึกษา 2568/1',
    position_id: 'POS-01',
    position_title: 'Software Engineer Intern (Fullstack)',
    company_id: 'COMP-01',
    company_name: 'บริษัท อโกด้า เซอร์วิสเซส จำกัด',
    company_short_name: 'Agoda',
    status: 'SUBMITTED',
    acknowledged_pre_course: true,
    terms_accepted_at: '2026-05-20T09:30:00Z',
    student_note: 'สนใจพัฒนา Web Application ด้วย React และ Go พร้อมเริ่มงานสหกิจภาคเรียนที่ 1/2568',
    submitted_at: '2026-05-20T10:15:00Z',
    reviewer_name: null,
    reviewed_at: null,
    review_comment: null,
    created_at: '2026-05-15T08:00:00Z',
    updated_at: '2026-05-20T10:15:00Z',
  },
  {
    plan_id: 102,
    student_id: '6609600002',
    first_name: 'ณภัทร',
    last_name: 'แสงสุวรรณ',
    curriculum: '66',
    gpa: 3.42,
    advisor_name: 'อ.สมหญิง รักษา',
    period_id: 'P2568-1',
    period_name: 'ปีการศึกษา 2568/1',
    position_id: 'POS-02',
    position_title: 'Frontend Developer Intern',
    company_id: 'COMP-02',
    company_name: 'บริษัท ไลน์ คอมพานี (ประเทศไทย) จำกัด',
    company_short_name: 'LINE',
    status: 'SUBMITTED',
    acknowledged_pre_course: true,
    terms_accepted_at: '2026-05-21T11:00:00Z',
    student_note: 'ผ่านเกณฑ์ภาษาอังกฤษและวิชาบังคับครบถ้วนแล้วครับ',
    submitted_at: '2026-05-21T14:20:00Z',
    reviewer_name: null,
    reviewed_at: null,
    review_comment: null,
    created_at: '2026-05-18T09:00:00Z',
    updated_at: '2026-05-21T14:20:00Z',
  },
  {
    plan_id: 103,
    student_id: '6109600001',
    first_name: 'ธนกฤต',
    last_name: 'ศิริวัฒน์',
    curriculum: '61',
    gpa: 3.1,
    advisor_name: 'อ.สมชาย ใจดี',
    period_id: 'P2568-1',
    period_name: 'ปีการศึกษา 2568/1',
    position_id: 'POS-03',
    position_title: 'Data Engineer Intern',
    company_id: 'COMP-03',
    company_name: 'บริษัท ทรู ดิจิทัล กรุ๊ป จำกัด',
    company_short_name: 'True Digital',
    status: 'RETURNED',
    acknowledged_pre_course: true,
    terms_accepted_at: '2026-05-19T08:30:00Z',
    student_note: 'ยื่นเอกสารการสมัครงานฉบับแรก',
    submitted_at: '2026-05-19T09:00:00Z',
    reviewer_name: 'อ.สมชาย ใจดี',
    reviewed_at: '2026-05-20T16:00:00Z',
    review_comment: 'กรุณาแนบรายละเอียด Course Outline และหัวข้อโปรเจกต์ที่ตกลงกับสถานประกอบการเพิ่มเติม',
    created_at: '2026-05-16T10:00:00Z',
    updated_at: '2026-05-20T16:00:00Z',
  },
  {
    plan_id: 104,
    student_id: '6109600002',
    first_name: 'พัชริดา',
    last_name: 'บุญญาพร',
    curriculum: '61',
    gpa: 3.68,
    advisor_name: 'อ.สมหญิง รักษา',
    period_id: 'P2568-1',
    period_name: 'ปีการศึกษา 2568/1',
    position_id: 'POS-04',
    position_title: 'UX/UI Designer Intern',
    company_id: 'COMP-04',
    company_name: 'บริษัท กสิกร ไลน์ จำกัด',
    company_short_name: 'LINE BK',
    status: 'APPROVED',
    acknowledged_pre_course: true,
    terms_accepted_at: '2026-05-18T10:00:00Z',
    student_note: 'ได้รับหนังสือตอบรับจากบริษัทเรียบร้อยแล้วค่ะ',
    submitted_at: '2026-05-18T11:00:00Z',
    reviewer_name: 'อ.สมหญิง รักษา',
    reviewed_at: '2026-05-19T13:45:00Z',
    review_comment: 'คุณสมบัติตรงตามเกณฑ์ และได้รับหนังสือตอบรับครบถ้วน อนุมัติแผนสหกิจ',
    created_at: '2026-05-15T09:00:00Z',
    updated_at: '2026-05-19T13:45:00Z',
  },
  {
    plan_id: 105,
    student_id: '6609600005',
    first_name: 'สิรภพ',
    last_name: 'ปรีชากุล',
    curriculum: '66',
    gpa: 2.15,
    advisor_name: 'อ.สมชาย ใจดี',
    period_id: 'P2568-1',
    period_name: 'ปีการศึกษา 2568/1',
    position_id: 'POS-05',
    position_title: 'IT Support Intern',
    company_id: 'COMP-05',
    company_name: 'บริษัท ซีดีจี ซิสเต็มส์ จำกัด',
    company_short_name: 'CDGS',
    status: 'REJECTED',
    acknowledged_pre_course: false,
    terms_accepted_at: null,
    student_note: 'ขอผ่อนผันเกณฑ์หน่วยกิตสะสมครับ',
    submitted_at: '2026-05-22T08:00:00Z',
    reviewer_name: 'อ.สมชาย ใจดี',
    reviewed_at: '2026-05-22T15:30:00Z',
    review_comment: 'เกรดเฉลี่ยสะสม (GPA) ยังไม่ถึงเกณฑ์ขั้นต่ำ 2.25 และยังไม่ผ่านรายวิชาเตรียมความพร้อมก่อนสหกิจ',
    created_at: '2026-05-20T10:00:00Z',
    updated_at: '2026-05-22T15:30:00Z',
  },
];

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

function UnauthenticatedState({
  title,
  message,
  onLogin,
  onEnableDemo,
}: {
  title: string;
  message: string;
  onLogin?: () => void;
  onEnableDemo?: () => void;
}) {
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center px-6 py-10 text-center max-w-lg mx-auto">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 shadow-xs">
        <Lock className="h-8 w-8" />
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

        {onEnableDemo && (
          <button
            type="button"
            onClick={onEnableDemo}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition cursor-pointer shadow-2xs"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>ดูตัวอย่างระบบตรวจแผน (Demo Mode)</span>
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

interface CoopPlansProps {
  onNavigateLogin?: () => void;
}

function CoopPlans({ onNavigateLogin }: CoopPlansProps = {}) {
  const [plans, setPlans] = useState<CoopPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<CoopPlan | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

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
    if (isDemoMode) return;
    loadPlans();
  }, [search, curriculum, periodId, authStatus, isDemoMode]);

  const handleOpenPlan = async (plan: CoopPlan) => {
    setSelectedPlan(plan);
    setModalOpen(true);

    if (isDemoMode) return;

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

  const handleEnableDemo = () => {
    setIsDemoMode(true);
    setError(null);
    setPlans(DEMO_PLANS);
    setLoading(false);
  };

  // Filter plans based on search, curriculum, and period in demo mode
  const basePlans = isDemoMode
    ? plans.filter((plan) => {
        if (curriculum && curriculum !== 'ALL' && plan.curriculum !== curriculum) {
          return false;
        }
        if (periodId && periodId !== 'ALL' && plan.period_id !== periodId) {
          return false;
        }
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          const target = `${plan.student_id} ${plan.first_name} ${plan.last_name} ${plan.position_title || ''} ${plan.company_name || ''}`.toLowerCase();
          if (!target.includes(q)) return false;
        }
        return true;
      })
    : plans;

  // Status aggregation counts across all plans
  const counts: PlanCounts = {
    ALL: basePlans.length,
    SUBMITTED: basePlans.filter((p) => p.status === 'SUBMITTED').length,
    RETURNED: basePlans.filter((p) => p.status === 'RETURNED').length,
    APPROVED: basePlans.filter((p) => p.status === 'APPROVED').length,
    REJECTED: basePlans.filter((p) => p.status === 'REJECTED').length,
    PREPARING: basePlans.filter((p) => p.status === 'PREPARING').length,
  };

  // Filter plans based on selected status tab
  const displayedPlans = basePlans.filter((plan) => {
    if (!statusFilter || statusFilter === 'ALL') return true;
    return plan.status === statusFilter;
  });

  const reviewerDisplayName = isDemoMode
    ? 'อ.สมชาย ใจดี (โหมดตัวอย่าง)'
    : user?.email
    ? `ผู้ตรวจสอบ (${user.email})`
    : 'อาจารย์ที่ปรึกษา / เจ้าหน้าที่';

  const isUnauthenticated = error && error.title === 'ลงชื่อเข้าใช้เพื่อดูแผนสหกิจ';

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Demo Mode Notice Banner */}
      {isDemoMode && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5 text-amber-900">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
            <div>
              <strong className="font-bold">โหมดตัวอย่าง (Demo Preview Mode):</strong>{' '}
              กำลังแสดงข้อมูลจำลองสำหรับทดสอบระบบตรวจแผน (Issue #107) คุณสามารถทดลองตัวกรอง สลับมุมมอง และคลิก "ตรวจแผน" เพื่อเปิดดู Modal ได้
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsDemoMode(false);
              loadPlans();
            }}
            className="self-end sm:self-auto shrink-0 rounded-lg bg-amber-200/80 px-3 py-1 font-semibold text-amber-900 hover:bg-amber-200 transition cursor-pointer"
          >
            ออกจากโหมดตัวอย่าง
          </button>
        </div>
      )}

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
        {!loading && !error && basePlans.length > 0 && (
          <div className="self-start md:self-auto shrink-0">
            <PlanProgressChart counts={counts} total={basePlans.length} />
          </div>
        )}
      </section>

      {/* When Unauthenticated, show friendly Access & Demo Callout without distracting empty filter controls */}
      {isUnauthenticated ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-xs p-6">
          <UnauthenticatedState
            title={error.title}
            message={error.detail}
            onLogin={onNavigateLogin}
            onEnableDemo={handleEnableDemo}
          />
        </section>
      ) : (
        <>
          {/* Filter Section */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <PlanFilters
              value={statusFilter}
              onChange={(newStatus) => setStatusFilter(newStatus)}
              counts={counts}
              total={basePlans.length}
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
                  <strong className="font-semibold text-slate-700">{basePlans.length}</strong> รายการ
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
        </>
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