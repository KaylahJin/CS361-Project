import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Briefcase,
  Building2,
  MapPin,
  Calendar,
  ExternalLink,
  AlertCircle,
  RotateCw,
  X,
  Filter,
  Layers,
  GraduationCap,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Info,
} from 'lucide-react';
import { getPositions } from '../data/positionApi';
import {
  type Position,
  type PositionCategory,
  type WorkMode,
  type PositionStatus,
  CATEGORY_LABELS,
  WORK_MODE_LABELS,
  STATUS_LABELS,
} from '../types/position';

// Company logo item with fallback avatar
const CompanyLogo: React.FC<{
  logo?: string | null;
  name?: string | null;
  shortName?: string | null;
}> = ({ logo, name, shortName }) => {
  const [hasError, setHasError] = useState(false);

  if (!hasError && logo) {
    return (
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200/80 p-2 flex items-center justify-center shrink-0 shadow-2xs group-hover:border-blue-200 transition-colors">
        <img
          src={`/images/logos/${logo}`}
          alt={name || 'Company Logo'}
          onError={() => setHasError(true)}
          className="max-h-full max-w-full object-contain filter group-hover:scale-105 transition-transform duration-200"
        />
      </div>
    );
  }

  const initial = (shortName || name || 'CO').trim().slice(0, 3).toUpperCase();
  return (
    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs text-blue-700 font-bold text-xs sm:text-sm select-none">
      {initial}
    </div>
  );
};

// Work mode badge with styling
const WorkModeBadge: React.FC<{ mode: WorkMode }> = ({ mode }) => {
  const label = WORK_MODE_LABELS[mode] || mode;
  switch (mode) {
    case 'onsite':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
          <Building2 className="w-3 h-3" />
          {label}
        </span>
      );
    case 'hybrid':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
          <Layers className="w-3 h-3" />
          {label}
        </span>
      );
    case 'remote':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {label}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/80">
          {label}
        </span>
      );
  }
};

// Status badge with styling
const StatusBadge: React.FC<{ status: PositionStatus }> = ({ status }) => {
  const label = STATUS_LABELS[status] || status;
  switch (status) {
    case 'open':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {label}
        </span>
      );
    case 'closed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {label}
        </span>
      );
    case 'expired':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          {label}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          {label}
        </span>
      );
  }
};

export const Positions: React.FC = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedWorkMode, setSelectedWorkMode] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal detail view
  const [activeModalPosition, setActiveModalPosition] = useState<Position | null>(null);

  // Fetch positions from API
  const fetchPositions = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof getPositions>[0] = {};
      if (search.trim()) params.search = search.trim();
      if (selectedCategory !== 'all') params.category = selectedCategory as PositionCategory;
      if (selectedWorkMode !== 'all') params.work_mode = selectedWorkMode as WorkMode;
      if (selectedStatus !== 'all') params.status = selectedStatus as PositionStatus;

      const data = await getPositions(params);
      setPositions(data);
    } catch (err) {
      console.error('Failed to fetch positions from API:', err);
      setError(err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อกับ Position API ได้');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search / trigger on filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPositions();
    }, 250);

    return () => clearTimeout(timer);
  }, [search, selectedCategory, selectedWorkMode, selectedStatus]);

  // Reset all filters
  const handleClearFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setSelectedWorkMode('all');
    setSelectedStatus('all');
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    selectedCategory !== 'all' ||
    selectedWorkMode !== 'all' ||
    selectedStatus !== 'all';

  // Available categories list
  const categoryOptions = useMemo(() => {
    return Object.entries(CATEGORY_LABELS) as [PositionCategory, string][];
  }, []);

  return (
    <main className="w-full min-h-screen bg-[#fafbfc]">
      {/* Hero Header */}
      <section className="pt-16 pb-8 sm:pt-20 sm:pb-12 text-center px-4 bg-gradient-to-b from-white to-[#fafbfc] border-b border-slate-100">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-100/80 text-blue-700 text-xs sm:text-sm font-semibold mb-4">
            <Briefcase className="w-3.5 h-3.5" />
            <span>Co-op Opportunities Catalog</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
            <span className="text-blue-600">Co-op </span>
            <span className="text-slate-950">Positions</span>
          </h1>

          <p className="mt-3 text-xl sm:text-2xl font-bold text-slate-900">
            ตำแหน่งงานและโครงการ<span className="text-blue-600">สหกิจศึกษา</span>
          </p>

          <p className="mt-3 text-xs sm:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
            ค้นหาและตรวจสอบรายละเอียดตำแหน่งงานโครงการสหกิจศึกษา พร้อมข้อมูลสถานประกอบการและช่องทางการสมัคร
          </p>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filter Toolbar */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-2xs mb-8 space-y-4">
          {/* Top row: Search input + Results Count */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อตำแหน่ง, บริษัท, หรือสถานที่ปฏิบัติงาน..."
                className="w-full pl-10 pr-9 py-2.5 text-sm text-slate-900 placeholder-slate-400 bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Results Count & Clear Button */}
            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs sm:text-sm">
              <span className="font-semibold text-slate-600">
                {!loading && `${positions.length} ตำแหน่งงาน`}
              </span>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>

          {/* Filter dropdowns & pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            {/* Category Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" /> สายงาน (Category)
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="all">ทุกสายงาน ({categoryOptions.length})</option>
                {categoryOptions.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Work Mode Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" /> รูปแบบการทำงาน
              </label>
              <select
                value={selectedWorkMode}
                onChange={(e) => setSelectedWorkMode(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="all">ทุกรูปแบบการทำงาน</option>
                <option value="onsite">On-site</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote / WFH</option>
                <option value="unknown">ไม่ระบุ</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-slate-400" /> สถานะรับสมัคร
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="open">เปิดรับสมัคร (Open)</option>
                <option value="expired">หมดเขตรับสมัคร (Expired)</option>
                <option value="closed">ปิดรับสมัคร (Closed)</option>
                <option value="unknown">ไม่ระบุสถานะ</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Section: Loading / Error / Empty / List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="w-1/3 h-5 bg-slate-200 rounded" />
                    <div className="w-1/4 h-3 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="w-2/3 h-4 bg-slate-100 rounded" />
                <div className="flex gap-2">
                  <div className="w-20 h-6 bg-slate-100 rounded-full" />
                  <div className="w-24 h-6 bg-slate-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center max-w-xl mx-auto my-12">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              เกิดข้อผิดพลาดในการโหลดข้อมูล
            </h3>
            <p className="text-sm text-slate-600 mb-6">{error}</p>
            <button
              onClick={fetchPositions}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : positions.length === 0 ? (
          /* Empty State (Acceptance Criteria #4) */
          <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center max-w-xl mx-auto my-8 shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              ไม่พบตำแหน่งงานที่ตรงกับเงื่อนไข
            </h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              ขออภัย ไม่พบรายการตำแหน่งหรือโครงการสหกิจศึกษาตามคำค้นหาหรือตัวกรองที่คุณเลือก
              โปรดลองปรับคำค้นหา หรือล้างตัวกรองเพื่อดูรายการทั้งหมด
            </p>
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        ) : (
          /* Position Cards Grid / List (Acceptance Criteria #1, #2, #3) */
          <div className="space-y-4">
            {positions.map((pos) => {
              const categoryLabel = CATEGORY_LABELS[pos.category] || pos.category;

              return (
                <div
                  key={pos.position_id}
                  className="group bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all duration-200 relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6 justify-between">
                    {/* Left: Logo & Core Info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <CompanyLogo
                        logo={pos.company_logo}
                        name={pos.company_name}
                        shortName={pos.company_short_name}
                      />

                      <div className="flex-1 min-w-0">
                        {/* Company Name & Province */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                          <span className="font-semibold text-xs sm:text-sm text-slate-800 truncate">
                            {pos.company_name || 'ไม่ระบุชื่อสถานประกอบการ'}
                          </span>
                          {pos.company_short_name && pos.company_short_name !== pos.company_name && (
                            <span className="px-1.5 py-0.2 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">
                              {pos.company_short_name}
                            </span>
                          )}
                          {pos.company_province && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {pos.company_province}
                            </span>
                          )}
                        </div>

                        {/* Position Title */}
                        <h2
                          onClick={() => setActiveModalPosition(pos)}
                          className="font-extrabold text-base sm:text-lg text-slate-900 group-hover:text-blue-600 transition-colors leading-snug cursor-pointer flex items-center gap-1.5"
                        >
                          {pos.title}
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-blue-600" />
                        </h2>

                        {/* Badges Row */}
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          {/* Category Badge */}
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                            {categoryLabel}
                          </span>

                          {/* Work Mode */}
                          <WorkModeBadge mode={pos.work_mode} />

                          {/* Status */}
                          <StatusBadge status={pos.status} />

                          {/* Position ID */}
                          <span className="text-[11px] font-mono text-slate-400 ml-auto hidden sm:inline">
                            #{pos.position_id}
                          </span>
                        </div>

                        {/* Description / Allowance / Details */}
                        {pos.description && (
                          <div className="mt-3 text-xs sm:text-sm text-slate-600 bg-slate-50/80 rounded-xl p-3 border border-slate-100/90 leading-relaxed">
                            <p className="line-clamp-2">{pos.description}</p>
                          </div>
                        )}

                        {/* Qualifications Snippet */}
                        {pos.qualification && (
                          <div className="mt-2.5 flex items-start gap-1.5 text-xs text-slate-500">
                            <GraduationCap className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                            <p className="line-clamp-1 italic">
                              คุณสมบัติ: {pos.qualification}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                      {pos.application_url ? (
                        <a
                          href={pos.application_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-2xs hover:shadow transition-all duration-150"
                        >
                          สมัครงาน
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <button
                          onClick={() => setActiveModalPosition(pos)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                        >
                          ดูรายละเอียด
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {pos.source_url && (
                        <a
                          href={pos.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-slate-400 hover:text-blue-600 underline transition-colors"
                        >
                          แหล่งที่มาประกาศ
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Position Detail Modal */}
      {activeModalPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <CompanyLogo
                  logo={activeModalPosition.company_logo}
                  name={activeModalPosition.company_name}
                  shortName={activeModalPosition.company_short_name}
                />
                <div>
                  <span className="text-xs font-semibold text-slate-500">
                    {activeModalPosition.company_name}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug">
                    {activeModalPosition.title}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setActiveModalPosition(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                {CATEGORY_LABELS[activeModalPosition.category] || activeModalPosition.category}
              </span>
              <WorkModeBadge mode={activeModalPosition.work_mode} />
              <StatusBadge status={activeModalPosition.status} />
              <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-slate-100 text-slate-500">
                #{activeModalPosition.position_id}
              </span>
            </div>

            {/* Details Grid */}
            <div className="space-y-4 text-sm text-slate-700">
              {activeModalPosition.location && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900 block text-xs">
                      สถานที่ปฏิบัติงาน:
                    </span>
                    <span>{activeModalPosition.location}</span>
                  </div>
                </div>
              )}

              {activeModalPosition.description && (
                <div className="flex items-start gap-2.5">
                  <Banknote className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900 block text-xs">
                      รายละเอียดและเบี้ยเลี้ยง:
                    </span>
                    <span className="leading-relaxed">{activeModalPosition.description}</span>
                  </div>
                </div>
              )}

              {activeModalPosition.qualification && (
                <div className="flex items-start gap-2.5">
                  <GraduationCap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900 block text-xs">
                      คุณสมบัติผู้สมัคร:
                    </span>
                    <span className="leading-relaxed">{activeModalPosition.qualification}</span>
                  </div>
                </div>
              )}

              {activeModalPosition.application_deadline && (
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900 block text-xs">
                      กำหนดปิดรับสมัคร:
                    </span>
                    <span>{activeModalPosition.application_deadline}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              {activeModalPosition.source_url ? (
                <a
                  href={activeModalPosition.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  ตรวจสอบประกาศทางการ
                </a>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setActiveModalPosition(null)}
                  className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  ปิดหน้าต่าง
                </button>
                {activeModalPosition.application_url && (
                  <a
                    href={activeModalPosition.application_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
                  >
                    เปิดหน้าสมัครงาน
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Positions;
