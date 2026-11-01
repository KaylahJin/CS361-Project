import React from 'react';
import { Search, X, Filter, Calendar } from 'lucide-react';
import type { PlanCounts } from '../../types/planReview';

interface PlanFiltersProps {
  value: string;
  onChange: (status: string) => void;
  counts: PlanCounts;
  total: number;
  search?: string;
  onSearchChange?: (search: string) => void;
  curriculum?: string;
  onCurriculumChange?: (curriculum: string) => void;
  periodId?: string;
  onPeriodChange?: (periodId: string) => void;
}

// Every status the plan list can show, in the order the tabs appear. Counting
// and labelling live in one place so a status added to the workflow later is
// never silently dropped from the tabs (#142).
const STATUS_TABS: { id: string; label: string; badgeColor: string }[] = [
  { id: 'SUBMITTED', label: 'รอตรวจ', badgeColor: 'text-blue-600 font-bold' },
  { id: 'ENDORSED', label: 'อาจารย์รับรองแล้ว', badgeColor: 'text-indigo-600 font-semibold' },
  { id: 'ELIGIBLE', label: 'ผ่านคุณสมบัติ', badgeColor: 'text-teal-600 font-semibold' },
  { id: 'INCOMPLETE', label: 'เอกสารไม่ครบ', badgeColor: 'text-amber-600 font-semibold' },
  { id: 'NOT_ELIGIBLE', label: 'ไม่ผ่านคุณสมบัติ', badgeColor: 'text-rose-600 font-semibold' },
  { id: 'SELECTED', label: 'ได้รับคัดเลือก', badgeColor: 'text-violet-600 font-semibold' },
  { id: 'RETURNED', label: 'ส่งกลับแก้ไข', badgeColor: 'text-zinc-500 font-medium' },
  { id: 'APPROVED', label: 'อนุมัติแล้ว', badgeColor: 'text-emerald-600 font-semibold' },
  { id: 'REJECTED', label: 'ไม่อนุมัติ', badgeColor: 'text-zinc-700 font-semibold' },
];

// Shown as one tab: DRAFT is the old name for the same state.
const PREPARING_IDS = ['PREPARING', 'DRAFT'];

// Statuses that always get a tab, even at zero, so the row does not jump
// around while the list is being filtered.
const ALWAYS_SHOWN = new Set(['SUBMITTED', 'RETURNED', 'APPROVED', 'REJECTED']);

const countOf = (counts: PlanCounts, id: string) => counts[id] ?? 0;

/**
 * Tabs for the statuses in `counts`, in STATUS_TABS order. A status that is
 * not in the list yet still gets a tab labelled with its own code, so the
 * numbers on the tabs always add up to the total.
 */
export function buildStatusTabs(counts: PlanCounts, total: number) {
  const tabs = [
    { id: 'ALL', label: 'ทั้งหมด', count: total, badgeColor: 'text-slate-600' },
  ];

  for (const tab of STATUS_TABS) {
    const count = countOf(counts, tab.id);
    if (count > 0 || ALWAYS_SHOWN.has(tab.id)) {
      tabs.push({ ...tab, count });
    }
  }

  const preparing = PREPARING_IDS.reduce((sum, id) => sum + countOf(counts, id), 0);
  if (preparing > 0) {
    tabs.push({
      id: 'PREPARING',
      label: 'ฉบับร่าง',
      count: preparing,
      badgeColor: 'text-slate-400 font-normal',
    });
  }

  const known = new Set<string>([
    'ALL',
    ...PREPARING_IDS,
    ...STATUS_TABS.map((tab) => tab.id),
  ]);
  for (const [id, count] of Object.entries(counts)) {
    if (known.has(id) || !count) continue;
    tabs.push({ id, label: id, count, badgeColor: 'text-slate-600 font-semibold' });
  }

  return tabs;
}

export const PlanFilters: React.FC<PlanFiltersProps> = ({
  value,
  onChange,
  counts,
  total,
  search = '',
  onSearchChange,
  curriculum = 'ALL',
  onCurriculumChange,
  periodId = '',
  onPeriodChange,
}) => {
  const tabs = buildStatusTabs(counts, total);

  return (
    <div className="space-y-4">
      {/* Search and Secondary Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {onSearchChange && (
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ค้นหารหัสนักศึกษา ชื่อ ตำแหน่ง หรือบริษัท..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="ล้างคำค้นหา"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {onCurriculumChange && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={curriculum}
              onChange={(e) => onCurriculumChange(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              <option value="ALL">ทุกหลักสูตร</option>
              <option value="61">หลักสูตร 61</option>
              <option value="66">หลักสูตร 66</option>
            </select>
          </div>
        )}

        {onPeriodChange && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={periodId}
              onChange={(e) => onPeriodChange(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              <option value="">ทุกรอบปีการศึกษา</option>
              <option value="P2568-1">ปีการศึกษา 2568/1</option>
            </select>
          </div>
        )}
      </div>

      {/* Status Segmented Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = value === tab.id;
          const isPendingTab = tab.id === 'SUBMITTED';

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer hover:scale-105 hover:-translate-y-0.5 active:scale-95 active:translate-y-0 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/20'
                  : isPendingTab
                  ? 'bg-blue-50/70 text-blue-900 border border-blue-200/90 hover:bg-blue-100/70 hover:shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:shadow-xs'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : isPendingTab
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : tab.badgeColor
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PlanFilters;
