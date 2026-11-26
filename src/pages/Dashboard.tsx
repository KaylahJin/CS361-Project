import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { canViewDashboard } from '../auth/roles';
import { CoopPlanApiError, getDashboardSummary } from '../data/coopPlanApi';
import type { CoopPlanStatus, DashboardSummary } from '../types/coopPlan';
import { formatDeadlineDate } from '../utils/deadline';

const STATUS_CARDS: Array<{ status: CoopPlanStatus; label: string; tone: string }> = [
  { status: 'PREPARING', label: 'กำลังเตรียม', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
  { status: 'SUBMITTED', label: 'รอตรวจ', tone: 'border-blue-200 bg-blue-50 text-blue-700' },
  { status: 'RETURNED', label: 'ส่งกลับแก้ไข', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  { status: 'ENDORSED', label: 'อาจารย์รับรองแล้ว', tone: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  { status: 'ELIGIBLE', label: 'ผ่านเกณฑ์ รอคัดเลือก', tone: 'border-teal-200 bg-teal-50 text-teal-700' },
  { status: 'NOT_ELIGIBLE', label: 'ไม่ผ่านเกณฑ์', tone: 'border-red-200 bg-red-50 text-red-700' },
  { status: 'SELECTED', label: 'ได้รับคัดเลือก', tone: 'border-violet-200 bg-violet-50 text-violet-700' },
  { status: 'NOT_SELECTED', label: 'ไม่ได้รับคัดเลือก', tone: 'border-slate-300 bg-slate-100 text-slate-700' },
  { status: 'APPROVED', label: 'อนุมัติแล้ว', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { status: 'REJECTED', label: 'ไม่อนุมัติ', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
];

const STATUS_LABEL = Object.fromEntries(STATUS_CARDS.map((c) => [c.status, c.label])) as Record<CoopPlanStatus, string>;

interface DashboardProps {
  onOpenPlan: (planId: number) => void;
}

export default function Dashboard({ onOpenPlan }: DashboardProps) {
  const { role, getIdToken } = useAuth();
  const allowed = canViewDashboard(role);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      setSummary(await getDashboardSummary(token));
    } catch (err) {
      if (err instanceof CoopPlanApiError && err.status === 403) {
        setError('ไม่มีสิทธิ์เข้าถึงหน้า Dashboard (เฉพาะ STAFF และ ADMIN)');
      } else {
        setError('โหลดข้อมูลภาพรวมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setLoading(false);
    }
  }, [allowed, getIdToken]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  if (!allowed) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 text-center">
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          ไม่มีสิทธิ์เข้าถึงหน้า Dashboard (เฉพาะ STAFF และ ADMIN เท่านั้น)
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <BarChart3 className="h-6 w-6 text-blue-600" aria-hidden="true" />
            ภาพรวมแผนสหกิจศึกษา
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            สรุปจำนวนนักศึกษาตามสถานะและรายการค้างหรือเกินกำหนดจากข้อมูลล่าสุด
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSummary()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          รีเฟรช
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
          กำลังคำนวณภาพรวม...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      )}

      {!loading && !error && summary && (
        <div className="space-y-8">
          <section aria-label="จำนวนตามสถานะ">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-slate-800">จำนวนแผนแยกตามสถานะ</h2>
              <span className="text-sm text-slate-600">ทั้งหมด {summary.totalPlans} แผน</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {STATUS_CARDS.map((card) => (
                <div key={card.status} className={`rounded-xl border p-4 ${card.tone}`}>
                  <div className="text-xs font-medium">{card.label}</div>
                  <div className="mt-1 text-2xl font-bold tabular-nums">
                    {summary.statusCounts[card.status] ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="รายการแผนเกินกำหนด">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                <AlertTriangle className="h-4 w-4 text-rose-600" aria-hidden="true" />
                รายการค้างหรือเกินกำหนด
              </h2>
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                {summary.overdueCount} รายการ
              </span>
            </div>

            {summary.overduePlans.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                ไม่มีรายการแผนที่เกินกำหนดในขณะนี้
              </p>
            ) : (
              <>
                <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                      <tr>
                        <th className="px-4 py-3">นักศึกษา</th>
                        <th className="px-4 py-3">สถานะ</th>
                        <th className="px-4 py-3">สถานประกอบการ / รอบ</th>
                        <th className="px-4 py-3">กำหนดส่ง</th>
                        <th className="px-4 py-3 text-right">ดูรายละเอียด</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.overduePlans.map((plan) => (
                        <tr key={plan.plan_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {plan.student_id} {plan.first_name} {plan.last_name}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{STATUS_LABEL[plan.status] ?? plan.status}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {plan.company_short_name || plan.company_name || '-'} ({plan.period_name || '-'})
                          </td>
                          <td className="px-4 py-3 text-rose-700">
                            {formatDeadlineDate(plan.submission_deadline)} (เกิน {plan.days_overdue} วัน)
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => onOpenPlan(plan.plan_id)}
                              className="text-sm font-medium text-blue-600 hover:underline"
                            >
                              เปิดดูแผน #{plan.plan_id}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 md:hidden">
                  {summary.overduePlans.map((plan) => (
                    <div key={plan.plan_id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-slate-900">
                          {plan.student_id} {plan.first_name} {plan.last_name}
                        </div>
                        <span className="text-xs font-medium text-rose-700">เกิน {plan.days_overdue} วัน</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {STATUS_LABEL[plan.status] ?? plan.status} · {plan.company_short_name || plan.company_name || '-'}
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenPlan(plan.plan_id)}
                        className="mt-3 text-xs font-medium text-blue-600 hover:underline"
                      >
                        เปิดดูแผน #{plan.plan_id}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
