import { useEffect, useState, useCallback } from 'react';
import {
  Check,
  ClipboardCheck,
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

export default function PlanReviewList() {
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

  // Reviewer and Role Switcher
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
      console.error('Failed to load plan review counts:', err);
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

  // Callback when a review decision is submitted
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

      {/* Hero Header */}
      <header
        style={{
          background:
            'linear-gradient(to right, oklch(0.38 0.15 266.5), oklch(0.12 0 0), oklch(0.37 0.12 245.27))',
        }}
        className="border-b border-white/10 text-white shadow-sm from-[oklch(0.38_0.15_266.5)] via-[oklch(0.12_0_0)] to-[oklch(0.37_0.12_245.27)] bg-gradient-to-r"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {/* Title & Badge */}
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-inset ring-white/30 shadow-xs">
              <ClipboardCheck className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-lg font-bold tracking-tight text-white sm:text-xl">
                  ตรวจแผนฝึกงาน / สหกิจศึกษา
                </h1>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider">
                  V3-05
                </span>
              </div>
              <p className="mt-0.5 text-xs text-blue-100 sm:text-sm">
                สำหรับอาจารย์ที่ปรึกษาและเจ้าหน้าที่ผู้พิจารณาแผนสหกิจศึกษา
              </p>
            </div>
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
        <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-heading text-lg font-bold text-slate-900">
                  แผนที่ต้องตรวจ
                </h2>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                  กรองตามสถานะ แล้วเลือกแผนเพื่ออ่านรายละเอียดและบันทึกผลการพิจารณา
                </p>
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

          {/* Progress Chart Component */}
          <PlanProgressChart counts={counts} total={total} />
        </div>

        {/* Content Section (Loading / Empty / Table / Cards) */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-2xl border border-slate-100 bg-white shadow-xs"
              />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-xs">
            <Inbox className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 font-heading text-sm font-bold text-slate-800">
              ไม่มีแผนในสถานะนี้
            </p>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
              ลองเลือกสถานะอื่น ล้างคำค้นหา หรือรอแผนใหม่จากนักศึกษา
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <PlanListTable plans={plans} onOpen={setSelectedPlan} />

            {/* Mobile/Tablet Card View */}
            <PlanListCards plans={plans} onOpen={setSelectedPlan} />

            {/* Pagination placeholder if plans exceed page size */}
            {plans.length >= PAGE_SIZE && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  โหลดเพิ่มเติม
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Plan Detail & Review Decision Modal */}
      <PlanDetailModal
        plan={selectedPlan}
        open={Boolean(selectedPlan)}
        onOpenChange={(open) => {
          if (!open) setSelectedPlan(null);
        }}
        reviewerName={reviewerName}
        onSaved={handleSaved}
      />
    </div>
  );
}
