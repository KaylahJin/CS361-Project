import { useEffect, useState, useCallback } from 'react';
import {
  Check,
  Inbox,
  UserRound,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';

import type {
  PlanCounts,
  PlanReviewItem,
  Reviewer,
} from '../types/planReview';

import {
  getAvailableReviewers,
  getCurrentReviewer,
  getPlanReviewCounts,
  getReviewPlans,
  setCurrentReviewer,
  resetPlansStore,
} from '../data/planReviewApi';

import PlanFilters from '../components/plans/PlanFilters';
import PlanListTable from '../components/plans/PlanListTable';
import PlanListCards from '../components/plans/PlanListCards';
import PlanDetailModal from '../components/plans/PlanDetailModal';
import PlanProgressChart from '../components/plans/PlanProgressChart';

const PAGE_SIZE = 50;

// Simple, self-contained Toast Alert
interface ToastState {
  show: boolean;
  title: string;
  description: string;
}

export default function CoopPlans() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [curriculumFilter, setCurriculumFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [plans, setPlans] = useState<PlanReviewItem[]>([]);
  const [counts, setCounts] = useState<PlanCounts>({
    ALL: 0,
    SUBMITTED: 0,
    RETURNED: 0,
    APPROVED: 0,
    REJECTED: 0,
    DRAFT: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedPlan, setSelectedPlan] = useState<PlanReviewItem | null>(null);

  // Reviewer and Role Switcher (V3-05.1: Advisor vs Staff view scopes)
  const availableReviewers = getAvailableReviewers();
  const [currentReviewer, setReviewerState] = useState<Reviewer>(getCurrentReviewer());
  const [reviewerDropdownOpen, setReviewerDropdownOpen] = useState(false);

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

  const reviewerName = currentReviewer.name;

  // Load status counts for current reviewer scope
  const loadCounts = useCallback(async () => {
    try {
      const nextCounts = await getPlanReviewCounts(currentReviewer.id);
      setCounts(nextCounts);
      setTotal(nextCounts.ALL || 0);
    } catch (err) {
      console.error('Failed to load plan counts:', err);
    }
  }, [currentReviewer.id]);

  // Load plans based on active filters
  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getReviewPlans({
        status: statusFilter,
        curriculum: curriculumFilter,
        search: searchQuery,
        reviewerId: currentReviewer.id,
      });
      setPlans(items);
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, curriculumFilter, searchQuery, currentReviewer.id]);

  // Trigger loading when filters or reviewer change
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCounts();
      loadPlans();
    }, 50);
    return () => clearTimeout(timer);
  }, [loadCounts, loadPlans]);

  // Handle switching active reviewer (Advisor 1 vs Advisor 2 vs Staff)
  const handleSelectReviewer = (reviewerId: string) => {
    const updated = setCurrentReviewer(reviewerId);
    setReviewerState(updated);
    setReviewerDropdownOpen(false);
  };

  // Callback when a review decision is submitted (V3-05.2)
  const handleSaved = (updatedPlan: PlanReviewItem) => {
    setSelectedPlan(null);
    loadPlans();
    loadCounts();

    let decisionLabel = 'อนุมัติแผน';
    if (updatedPlan.status === 'RETURNED') decisionLabel = 'ส่งกลับแก้ไข';
    if (updatedPlan.status === 'REJECTED') decisionLabel = 'ไม่อนุมัติแผน';

    showToast(
      `บันทึกผลการพิจารณาเรียบร้อยแล้ว (${decisionLabel})`,
      `แผน #${updatedPlan.plan_id} ของ ${updatedPlan.first_name} ${updatedPlan.last_name} ได้รับการบันทึกสถานะเป็น "${updatedPlan.status}"`
    );
  };

  // Reset demo data helper
  const handleResetData = () => {
    resetPlansStore();
    loadCounts();
    loadPlans();
    showToast('รีเซ็ตข้อมูลจำลองเรียบร้อยแล้ว', 'คืนค่าสถานะและข้อมูลผลการพิจารณาทั้งหมดเป็นค่าเริ่มต้น');
  };

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
            <h1 className="font-heading text-lg font-bold tracking-tight text-white sm:text-xl">
              แผนสหกิจศึกษาและการพิจารณา
            </h1>
            <p className="mt-0.5 text-xs text-blue-100 sm:text-sm">
              ระบบตรวจสอบ จัดการ และบันทึกผลการพิจารณาแผนสหกิจศึกษา
            </p>
          </div>

          {/* Reviewer Role Switcher Dropdown (V3-05.1 requirement) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setReviewerDropdownOpen((prev) => !prev)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/25 bg-white/10 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-xs backdrop-blur-xs hover:bg-white/20 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-center gap-2 text-left">
                <UserRound className="h-4 w-4 shrink-0 text-blue-200" />
                <div>
                  <div className="font-bold leading-none">{reviewerName}</div>
                  <div className="text-[11px] text-blue-200 leading-tight mt-0.5">
                    {currentReviewer.roleTitle}
                  </div>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
            </button>

            {/* Dropdown Menu */}
            {reviewerDropdownOpen && (
              <>
                <div
                  onClick={() => setReviewerDropdownOpen(false)}
                  className="fixed inset-0 z-40"
                />
                <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in zoom-in-95">
                  <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    สลับบทบาทผู้ตรวจ (ทดสอบสิทธิ์)
                  </div>
                  {availableReviewers.map((r) => {
                    const isSelected = r.id === currentReviewer.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelectReviewer(r.id)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl p-2.5 text-left text-xs transition-all duration-150 cursor-pointer hover:scale-[1.01] hover:translate-x-0.5 ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{r.name}</div>
                          <div className="text-[11px] text-slate-500 font-normal">
                            {r.roleTitle}
                          </div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Top Control Bar & KPI Section */}
        <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-heading text-lg font-bold text-slate-900">
                  รายการแผนสหกิจศึกษา
                </h2>
              </div>

              {/* Reset Demo Data Button */}
              <button
                type="button"
                onClick={handleResetData}
                className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:scale-105 hover:-translate-y-0.5 hover:shadow-xs active:scale-95 transition-all duration-200 cursor-pointer"
                title="รีเซ็ตผลการพิจารณาเป็นค่าเริ่มต้น"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>รีเซ็ตข้อมูลทดสอบ</span>
              </button>
            </div>

            {/* Filters Component */}
            <PlanFilters
              value={statusFilter}
              onChange={setStatusFilter}
              counts={counts}
              total={total}
              search={searchQuery}
              onSearchChange={setSearchQuery}
              curriculum={curriculumFilter}
              onCurriculumChange={setCurriculumFilter}
            />
          </div>

          {/* Right Column: Circular Progress Chart */}
          <div className="lg:sticky lg:top-20">
            <PlanProgressChart counts={counts} total={total} />
          </div>
        </div>

        {/* Content Section: Table for Desktop, Cards for Mobile */}
        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-slate-400">
            <div className="flex flex-col items-center gap-3">
              <span className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
              <p className="text-sm font-medium">กำลังโหลดรายการแผนสหกิจ...</p>
            </div>
          </div>
        ) : plans.length === 0 ? (
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
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <PlanListTable
                plans={plans}
                onOpen={(plan) => setSelectedPlan(plan)}
              />
            </div>

            {/* Mobile / Tablet Cards View */}
            <div className="block md:hidden">
              <PlanListCards
                plans={plans}
                onOpen={(plan) => setSelectedPlan(plan)}
              />
            </div>

            {/* Simple Pagination / Record Counter */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
              <div>
                แสดง <span className="font-bold text-slate-700">{plans.length}</span> จาก{' '}
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
        onOpenChange={(open) => !open && setSelectedPlan(null)}
        reviewerName={reviewerName}
        onSaved={handleSaved}
      />
    </div>
  );
}