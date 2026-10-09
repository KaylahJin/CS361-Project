import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Code2,
  Database,
  Cloud,
  CheckSquare,
  Palette,
  BarChart3,
  Wrench,
  Shield,
  TrendingUp,
  Cpu,
  Sparkles,
  Globe,
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
// Keyword highlight helper for search matches
const HighlightMatch: React.FC<{
  text?: string | null;
  query: string;
  className?: string;
}> = ({ text, query, className = '' }) => {
  if (!text) return null;
  const q = query.trim();
  if (!q) return <span className={className}>{text}</span>;

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className="bg-amber-100 text-amber-950 font-bold rounded-xs px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

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

// ============================================================
// Meaningful Category Color Themes & Icons (Ref: F18)
// Conveys intuitive industry meaning for each specialized field
// ============================================================
export interface CategoryTheme {
  bg: string;
  text: string;
  border: string;
  activeBg: string;
  iconColor: string;
  description: string;
}

export const CATEGORY_THEMES: Record<string, CategoryTheme> = {
  // Indigo / Royal: Code, Logic, Engineering, Development
  software_development: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    activeBg: 'bg-indigo-600 text-white',
    iconColor: 'text-indigo-600',
    description: 'Indigo: สื่อถึงตรรกะ การเขียนโค้ด และการพัฒนาซอฟต์แวร์',
  },
  // Purple / Violet: Artificial Intelligence, Deep Tech, Data Science
  data_ai: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    activeBg: 'bg-purple-600 text-white',
    iconColor: 'text-purple-600',
    description: 'Purple: สื่อถึงความฉลาด ปัญญาประดิษฐ์ และการวิเคราะห์ข้อมูล',
  },
  // Sky / Cyan: Cloud Computing, DevOps, Distributed Systems
  cloud_infrastructure_devops: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    activeBg: 'bg-sky-600 text-white',
    iconColor: 'text-sky-600',
    description: 'Sky Blue: สื่อถึงระบบคลาวด์ โครงสร้างพื้นฐาน และระบบเครือข่าย',
  },
  // Emerald / Green: Quality Assurance, Testing, Verified, Zero-Bug
  qa_testing: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    activeBg: 'bg-emerald-600 text-white',
    iconColor: 'text-emerald-600',
    description: 'Emerald: สื่อถึงการทดสอบผ่าน การรับประกันคุณภาพ และความถูกต้อง',
  },
  // Fuchsia / Pink: Creative Arts, Human-Centric Experience, UI/UX
  ux_ui_design: {
    bg: 'bg-fuchsia-50',
    text: 'text-fuchsia-700',
    border: 'border-fuchsia-200',
    activeBg: 'bg-fuchsia-600 text-white',
    iconColor: 'text-fuchsia-600',
    description: 'Fuchsia: สื่อถึงความคิดสร้างสรรค์ การออกแบบ และประสบการณ์ผู้ใช้',
  },
  // Amber / Warm Gold: Business Strategy, Value, System Analysis
  business_enterprise_systems: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    activeBg: 'bg-amber-600 text-white',
    iconColor: 'text-amber-600',
    description: 'Amber: สื่อถึงการวิเคราะห์ธุรกิจ กระบวนการทำงาน และระบบองค์กร',
  },
  // Rose / Crimson: Cybersecurity, Protection, Firewall, Threat Defense
  cybersecurity: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    activeBg: 'bg-rose-600 text-white',
    iconColor: 'text-rose-600',
    description: 'Rose: สื่อถึงความปลอดภัยไซเบอร์ การป้องกันภัยคุกคาม และเกราะคุ้มกัน',
  },
  // Teal: Operations, Reliability, Helpdesk, Troubleshooting
  it_support_operations: {
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    activeBg: 'bg-teal-600 text-white',
    iconColor: 'text-teal-600',
    description: 'Teal: สื่อถึงการดูแลบำรุงรักษา สนับสนุนด้านไอที และความเสถียร',
  },
  // Orange: Commercial, Growth, Deals, Technical Consultation
  technical_sales: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    activeBg: 'bg-orange-600 text-white',
    iconColor: 'text-orange-600',
    description: 'Orange: สื่อถึงการขายเชิงเทคนิค การเจรจา และการเติบโตทางธุรกิจ',
  },
  // Blue: Corporate Solutions, Enterprise Architecture, Integration
  it_solutions: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    activeBg: 'bg-blue-600 text-white',
    iconColor: 'text-blue-600',
    description: 'Blue: สื่อถึงโซลูชันไอทีแบบบูรณาการ และสถาปัตยกรรมองค์กร',
  },
  // Slate: General / Other
  other: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    activeBg: 'bg-slate-700 text-white',
    iconColor: 'text-slate-500',
    description: 'Slate: สายงานอื่นๆ หรือสายงานทั่วไป',
  },
  all: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    activeBg: 'bg-blue-600 text-white',
    iconColor: 'text-blue-600',
    description: 'Blue: ทุกสายงาน',
  },
};

export const getCategoryTheme = (category: string): CategoryTheme => {
  return (
    CATEGORY_THEMES[category] || {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-200',
      activeBg: 'bg-slate-700 text-white',
      iconColor: 'text-slate-500',
      description: 'Default',
    }
  );
};

// Category icon helper (Ref: F18)
export const getCategoryIcon = (category: PositionCategory | string, className: string = 'w-3.5 h-3.5') => {
  switch (category) {
    case 'software_development':
      return <Code2 className={className} />;
    case 'data_ai':
      return <Database className={className} />;
    case 'cloud_infrastructure_devops':
      return <Cloud className={className} />;
    case 'qa_testing':
      return <CheckSquare className={className} />;
    case 'ux_ui_design':
      return <Palette className={className} />;
    case 'business_enterprise_systems':
      return <BarChart3 className={className} />;
    case 'it_support_operations':
      return <Wrench className={className} />;
    case 'cybersecurity':
      return <Shield className={className} />;
    case 'technical_sales':
      return <TrendingUp className={className} />;
    case 'it_solutions':
      return <Cpu className={className} />;
    case 'all':
      return <Sparkles className={className} />;
    default:
      return <Briefcase className={className} />;
  }
};

// Category badge with tailored semantic color and icon (Ref: F18)
export const CategoryBadge: React.FC<{ category: PositionCategory | string; className?: string }> = ({
  category,
  className = '',
}) => {
  const label = CATEGORY_LABELS[category as PositionCategory] || category;
  const theme = getCategoryTheme(category);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${theme.bg} ${theme.text} border ${theme.border} ${className}`}
    >
      {getCategoryIcon(category, `w-3.5 h-3.5 ${theme.iconColor} shrink-0`)}
      <span>{label}</span>
    </span>
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

// CTA Button Helper for Dynamic Status Action (Ref: Issue #84 / F11)
interface PositionCtaConfig {
  label: string;
  url: string | null;
  style: 'primary' | 'secondary' | 'info' | 'disabled';
  iconType: 'apply' | 'globe' | 'source' | 'none';
}

const getPositionCtaConfig = (pos: Position): PositionCtaConfig => {
  // Case 1: Direct application URL exists (highest priority)
  if (pos.application_url) {
    if (pos.status === 'open') {
      return {
        label: 'ไปช่องทางรับสมัคร',
        url: pos.application_url,
        style: 'primary',
        iconType: 'apply',
      };
    }
    if (pos.status === 'closed' || pos.status === 'expired') {
      return {
        label: 'ดูช่องทางรับสมัครย้อนหลัง',
        url: pos.application_url,
        style: 'secondary',
        iconType: 'apply',
      };
    }
    return {
      label: 'ไปช่องทางรับสมัคร',
      url: pos.application_url,
      style: 'primary',
      iconType: 'apply',
    };
  }

  // Case 2: No direct application URL, but official company website exists
  if (pos.company_url) {
    const companyDisplayName = pos.company_short_name || pos.company_name || 'บริษัท';
    return {
      label: `ไปยังเว็บไซต์ ${companyDisplayName}`,
      url: pos.company_url,
      style: pos.status === 'open' ? 'primary' : 'secondary',
      iconType: 'globe',
    };
  }

  // Case 3: Fallback to department CSTU announcement
  if (pos.source_url) {
    return {
      label: 'ดูประกาศในระบบ CSTU',
      url: pos.source_url,
      style: 'info',
      iconType: 'source',
    };
  }

  return {
    label: 'ไม่มีลิงก์ภายนอก',
    url: null,
    style: 'disabled',
    iconType: 'none',
  };
};

// Dynamic CTA Button Component (Ref: F11)
const PositionCtaButton: React.FC<{
  pos: Position;
  size?: 'sm' | 'md';
  className?: string;
}> = ({ pos, size = 'md', className = '' }) => {
  const config = getPositionCtaConfig(pos);
  const sizeClasses =
    size === 'sm'
      ? 'px-3.5 py-1.5 text-xs'
      : 'px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm';

  if (!config.url || config.style === 'disabled') {
    return (
      <span
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-medium bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed select-none ${sizeClasses} ${className}`}
        title="ไม่มีลิงก์ภายนอกสำหรับตำแหน่งนี้"
      >
        <span>{config.label}</span>
      </span>
    );
  }

  let styleClasses = '';
  switch (config.style) {
    case 'primary':
      styleClasses =
        'bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-2xs hover:shadow-xs focus:ring-2 focus:ring-blue-500/40';
      break;
    case 'secondary':
      styleClasses =
        'bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200 hover:border-slate-300 focus:ring-2 focus:ring-slate-400/40';
      break;
    case 'info':
      styleClasses =
        'bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold border border-blue-200 hover:border-blue-300 focus:ring-2 focus:ring-blue-400/40';
      break;
  }

  return (
    <a
      href={config.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl transition-all duration-150 cursor-pointer ${styleClasses} ${sizeClasses} ${className}`}
    >
      <span>{config.label}</span>
      {config.iconType === 'globe' ? (
        <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      )}
    </a>
  );
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

  // Modal detail view state & Accessibility refs (Ref: Issue #84 / F10)
  const [activeModalPosition, setActiveModalPosition] = useState<Position | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  // Modal open & close handlers with focus restoration
  const handleOpenModal = useCallback((pos: Position) => {
    lastFocusedElementRef.current = document.activeElement as HTMLElement;
    setActiveModalPosition(pos);
  }, []);

  const handleCloseModal = useCallback(() => {
    setActiveModalPosition(null);
  }, []);

  // Keyboard navigation & Focus trap for Modal (Ref: F10)
  useEffect(() => {
    if (!activeModalPosition) {
      if (lastFocusedElementRef.current) {
        lastFocusedElementRef.current.focus();
        lastFocusedElementRef.current = null;
      }
      return;
    }

    // Set initial focus to close button after render
    const timer = setTimeout(() => {
      initialFocusRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseModal();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [activeModalPosition, handleCloseModal]);

  // Fetch positions from API
  const fetchPositions = useCallback(async () => {
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
  }, [search, selectedCategory, selectedWorkMode, selectedStatus]);

  // Debounced search / trigger on filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPositions();
    }, 250);

    return () => clearTimeout(timer);
  }, [fetchPositions]);

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
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="ล้างข้อความค้นหา"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
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
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>

          {/* Active Search Keyword Banner */}
          {search.trim() && (
            <div className="flex items-center justify-between text-xs sm:text-sm text-blue-800 bg-blue-50/80 border border-blue-200/80 rounded-xl px-3.5 py-2">
              <span className="flex items-center gap-2 font-medium">
                <Search className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  ผลการค้นหาด้วยคำสำคัญ: <strong className="font-bold underline decoration-blue-400">"{search}"</strong>
                  {!loading && (
                    <span className="ml-1 text-blue-900 font-bold">
                      (พบ {positions.length} รายการ)
                    </span>
                  )}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-white/80 hover:bg-white border border-blue-200 px-2.5 py-1 rounded-lg transition-colors"
                title="ล้างคำค้นหา"
              >
                <X className="w-3.5 h-3.5" /> ล้างคำค้นหา
              </button>
            </div>
          )}

          {/* Quick Category Filter Pills with Semantic Theme Colors (Ref: F18) */}
          <div className="pt-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none text-xs">
              <span className="text-slate-400 font-semibold shrink-0 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" /> หมวดหมู่ด่วน:
              </span>
              {[
                { key: 'all', label: 'ทุกสายงาน', icon: Sparkles },
                { key: 'software_development', label: 'Software & Web', icon: Code2 },
                { key: 'data_ai', label: 'Data & AI', icon: Database },
                { key: 'cloud_infrastructure_devops', label: 'Cloud & DevOps', icon: Cloud },
                { key: 'qa_testing', label: 'QA & Testing', icon: CheckSquare },
                { key: 'ux_ui_design', label: 'UX/UI Design', icon: Palette },
                { key: 'business_enterprise_systems', label: 'Business & Systems', icon: BarChart3 },
              ].map((c) => {
                const isSelected = selectedCategory === c.key;
                const theme = getCategoryTheme(c.key);
                const Icon = c.icon;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setSelectedCategory(isSelected && c.key !== 'all' ? 'all' : c.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? `${theme.activeBg} shadow-2xs`
                        : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : theme.iconColor}`} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter dropdowns & pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            {/* Category Filter */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filter-category" className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" /> สายงานทั้งหมด (Category)
              </label>
              <select
                id="filter-category"
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
              <label htmlFor="filter-workmode" className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" /> รูปแบบการทำงาน (Work Mode)
              </label>
              <select
                id="filter-workmode"
                value={selectedWorkMode}
                onChange={(e) => setSelectedWorkMode(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="all">ทุกรูปแบบการทำงาน</option>
                <option value="onsite">On-site (ทำงานที่สถานประกอบการ)</option>
                <option value="hybrid">Hybrid (ผสมผสาน Office/WFH)</option>
                <option value="remote">Remote / WFH (ทำงานออนไลน์ 100%)</option>
                <option value="unknown">ไม่ระบุ</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="filter-status" className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-slate-400" /> สถานะรับสมัคร (Status)
              </label>
              <select
                id="filter-status"
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

          {/* Active Filter Tags Bar (Chips with Individual Cancel / Clear) */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-blue-600" /> ตัวกรองที่เปิดใช้:
              </span>

              {selectedCategory !== 'all' && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getCategoryTheme(selectedCategory).bg} ${getCategoryTheme(selectedCategory).text} border ${getCategoryTheme(selectedCategory).border}`}>
                  {getCategoryIcon(selectedCategory, `w-3 h-3 ${getCategoryTheme(selectedCategory).iconColor}`)}
                  <span>สายงาน: {CATEGORY_LABELS[selectedCategory as PositionCategory] || selectedCategory}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className="hover:opacity-80 p-0.5 cursor-pointer rounded-full hover:bg-black/10 ml-0.5"
                    title="ยกเลิกตัวกรองสายงานนี้"
                    aria-label="ยกเลิกตัวกรองสายงาน"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedWorkMode !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                  รูปแบบ: {WORK_MODE_LABELS[selectedWorkMode as WorkMode] || selectedWorkMode}
                  <button
                    type="button"
                    onClick={() => setSelectedWorkMode('all')}
                    className="hover:text-purple-950 p-0.5 cursor-pointer rounded-full hover:bg-purple-200/50"
                    title="ยกเลิกตัวกรองรูปแบบการทำงานนี้"
                    aria-label="ยกเลิกตัวกรองรูปแบบการทำงาน"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedStatus !== 'all' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  สถานะ: {STATUS_LABELS[selectedStatus as PositionStatus] || selectedStatus}
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('all')}
                    className="hover:text-emerald-950 p-0.5 cursor-pointer rounded-full hover:bg-emerald-200/50"
                    title="ยกเลิกตัวกรองสถานะนี้"
                    aria-label="ยกเลิกตัวกรองสถานะ"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {search.trim() && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                  คำค้นหา: "{search.trim()}"
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="hover:text-amber-950 p-0.5 cursor-pointer rounded-full hover:bg-amber-200/50"
                    title="ล้างคำค้นหานี้"
                    aria-label="ล้างคำค้นหา"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold ml-auto cursor-pointer hover:underline"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            </div>
          )}
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
              type="button"
              onClick={fetchPositions}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : positions.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center max-w-xl mx-auto my-8 shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {search.trim()
                ? `ไม่พบตำแหน่งงานสำหรับคำค้นหา "${search.trim()}"`
                : 'ไม่พบตำแหน่งงานที่ตรงกับเงื่อนไข'}
            </h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              {search.trim()
                ? `ขออภัย ไม่พบรายการตำแหน่งงานที่ตรงกับคำสำคัญ "${search.trim()}" โปรดตรวจสอบคำสะกด หรือลองค้นหาด้วยคำทั่วไป เช่น Developer, Data, AI, Tester หรือกดปุ่มด้านล่างเพื่อล้างคำค้นหา`
                : 'ขออภัย ไม่พบรายการตำแหน่งหรือโครงการสหกิจศึกษาตามตัวกรองที่คุณเลือก โปรดลองปรับหรือล้างตัวกรองเพื่อดูรายการทั้งหมด'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  ล้างคำค้นหา
                </button>
              )}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-xs transition-colors cursor-pointer ${
                    search.trim()
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <X className="w-4 h-4" />
                  ล้างตัวกรองทั้งหมด
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Position Cards Grid / List (Ref: F10, F11, F18) */
          <div className="space-y-4">
            {positions.map((pos) => {
              return (
                <div
                  key={pos.position_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleOpenModal(pos)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenModal(pos);
                    }
                  }}
                  aria-label={`ดูรายละเอียดตำแหน่ง ${pos.title} ของ ${pos.company_name || 'สถานประกอบการ'}`}
                  className="group bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 hover:border-blue-400/80 p-5 sm:p-6 shadow-2xs hover:shadow-md hover:bg-slate-50/40 transition-all duration-200 relative overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/60"
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
                            <HighlightMatch
                              text={pos.company_name || 'ไม่ระบุชื่อสถานประกอบการ'}
                              query={search}
                            />
                          </span>
                          {pos.company_short_name && pos.company_short_name !== pos.company_name && (
                            <span className="px-1.5 py-0.2 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">
                              <HighlightMatch text={pos.company_short_name} query={search} />
                            </span>
                          )}
                          {pos.company_province && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <HighlightMatch text={pos.company_province} query={search} />
                            </span>
                          )}
                        </div>

                        {/* Position Title: Interactive Heading */}
                        <h2 className="font-bold text-base sm:text-lg text-slate-900 group-hover:text-blue-600 transition-colors leading-snug flex items-center gap-1.5">
                          <HighlightMatch text={pos.title} query={search} />
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-blue-600 shrink-0" aria-hidden="true" />
                        </h2>

                        {/* Badges Row (Ref: F18) */}
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          {/* Category Badge with Color Theme & Icon */}
                          <CategoryBadge category={pos.category} />

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
                            <p className="line-clamp-2">
                              <HighlightMatch text={pos.description} query={search} />
                            </p>
                          </div>
                        )}

                        {/* Qualifications Prompt (Concise Scan-friendly link, full details in modal) */}
                        {pos.qualification && (
                          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                            <GraduationCap className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                            <span className="font-medium text-slate-700">มีกำหนดคุณสมบัติ</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-blue-600 font-medium group-hover:underline inline-flex items-center gap-0.5">
                              ตรวจสอบรายละเอียดเพิ่มเติม
                              <ChevronRight className="w-3 h-3 text-blue-500" aria-hidden="true" />
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions (Ref: F10, F11) */}
                    <div className="flex flex-col sm:items-end justify-between sm:justify-start gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(pos);
                          }}
                          aria-haspopup="dialog"
                          aria-label={`ดูรายละเอียดตำแหน่ง ${pos.title}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <Info className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                          <span>ดูรายละเอียด</span>
                        </button>
                        <PositionCtaButton pos={pos} size="md" />
                      </div>

                      {pos.source_url && (
                        <a
                          href={pos.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[11px] text-slate-400 hover:text-blue-600 underline transition-colors self-end sm:self-auto"
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

      {/* Position Detail Modal (Ref: F10 Accessibility, F11 Dynamic CTA, F18 Key-Value Grid) */}
      {activeModalPosition && (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-position-title"
            aria-describedby="modal-position-description"
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden relative my-auto animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 p-6 sm:p-7 border-b border-slate-100 bg-gradient-to-b from-slate-50/50 to-white shrink-0">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <CompanyLogo
                  logo={activeModalPosition.company_logo}
                  name={activeModalPosition.company_name}
                  shortName={activeModalPosition.company_short_name}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold text-slate-500">
                      {activeModalPosition.company_name || 'สถานประกอบการ'}
                    </span>
                    {activeModalPosition.company_province && (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {activeModalPosition.company_province}
                      </span>
                    )}
                  </div>
                  <h3
                    id="modal-position-title"
                    className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug"
                  >
                    {activeModalPosition.title}
                  </h3>
                </div>
              </div>

              {/* Close Button (X) with accessible name (Ref: F10) */}
              <button
                ref={initialFocusRef}
                type="button"
                onClick={handleCloseModal}
                aria-label="ปิดหน้ารายละเอียด"
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Scrollable Body (Ref: F18 Key-Value Grid & Visual Hierarchy) */}
            <div
              id="modal-position-description"
              className="p-6 sm:p-7 overflow-y-auto space-y-6 text-sm text-slate-700"
            >
              {/* Badges Strip (Ref: F18) */}
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <CategoryBadge category={activeModalPosition.category} />
                <WorkModeBadge mode={activeModalPosition.work_mode} />
                <StatusBadge status={activeModalPosition.status} />
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-slate-100 text-slate-500">
                  #{activeModalPosition.position_id}
                </span>
              </div>

              {/* Status Alert Notice (For closed / expired positions) */}
              {(activeModalPosition.status === 'closed' || activeModalPosition.status === 'expired') && (
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs sm:text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <strong className="font-bold">หมายเหตุสถานะประกาศ:</strong> ตำแหน่งนี้
                    {activeModalPosition.status === 'closed' ? ' ปิดรับสมัครแล้ว' : ' หมดเขตรับสมัครแล้ว'}
                    {' '}ข้อมูลที่แสดงในระบบเป็นประวัติเพื่อใช้อ้างอิงการจัดทำแผนสหกิจศึกษา คุณสามารถกด 'ดูประกาศต้นทางย้อนหลัง' ด้านล่างเพื่อตรวจสอบรายละเอียดเพิ่มเติม
                  </div>
                </div>
              )}

              {/* Structured Key-Value Grid (Ref: F18) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Grid Item 1: Company */}
                <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Building2 className="w-4 h-4 text-blue-600" aria-hidden="true" />
                    <span>สถานประกอบการ</span>
                  </div>
                  <div className="font-bold text-sm text-slate-900">
                    {activeModalPosition.company_name || 'ไม่ระบุชื่อสถานประกอบการ'}
                  </div>
                  {activeModalPosition.company_short_name && activeModalPosition.company_short_name !== activeModalPosition.company_name && (
                    <div className="text-xs text-slate-500">
                      ชื่อย่อ: {activeModalPosition.company_short_name}
                    </div>
                  )}
                  {activeModalPosition.company_province && (
                    <div className="text-xs text-slate-500 flex items-center gap-1 pt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400" aria-hidden="true" />
                      <span>จังหวัด{activeModalPosition.company_province}</span>
                    </div>
                  )}
                  {activeModalPosition.company_url && (
                    <div className="pt-1.5">
                      <a
                        href={activeModalPosition.company_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium"
                      >
                        <Globe className="w-3 h-3 text-blue-500" aria-hidden="true" />
                        <span>เว็บไซต์ทางการสถานประกอบการ</span>
                        <ExternalLink className="w-2.5 h-2.5 text-blue-400" aria-hidden="true" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Grid Item 2: Work Mode & Location */}
                <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Layers className="w-4 h-4 text-purple-600" aria-hidden="true" />
                    <span>รูปแบบและสถานที่ปฏิบัติงาน</span>
                  </div>
                  <div className="pt-0.5">
                    <WorkModeBadge mode={activeModalPosition.work_mode} />
                  </div>
                  <div className="text-xs text-slate-600 pt-1">
                    {activeModalPosition.location || 'ปฏิบัติงานตามที่สถานประกอบการกำหนด'}
                  </div>
                </div>

                {/* Grid Item 3: Category & Reference ID */}
                <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Briefcase className="w-4 h-4 text-slate-500" aria-hidden="true" />
                    <span>สายงานและรหัสตำแหน่ง</span>
                  </div>
                  <div className="pt-1">
                    <CategoryBadge category={activeModalPosition.category} className="text-xs sm:text-sm py-1 px-3" />
                  </div>
                  <div className="text-xs font-mono text-slate-400 pt-1">
                    Position Code: #{activeModalPosition.position_id}
                  </div>
                </div>

                {/* Grid Item 4: Application Deadline & Status */}
                <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-4 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Calendar className="w-4 h-4 text-amber-600" aria-hidden="true" />
                    <span>กำหนดการรับสมัคร</span>
                  </div>
                  <div className="font-bold text-sm text-slate-900">
                    {activeModalPosition.application_deadline
                      ? activeModalPosition.application_deadline
                      : 'เปิดรับสมัครต่อเนื่อง / จนกว่าจะเต็ม'}
                  </div>
                  <div className="pt-0.5">
                    <StatusBadge status={activeModalPosition.status} />
                  </div>
                </div>
              </div>

              {/* Details Section: Description & Allowance */}
              {activeModalPosition.description && (
                <div className="bg-slate-50/60 rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                      <Banknote className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <span>รายละเอียดงาน เบี้ยเลี้ยง และสวัสดิการ</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line pl-0 sm:pl-8">
                    {activeModalPosition.description}
                  </p>
                </div>
              )}

              {/* Details Section: Qualifications */}
              {activeModalPosition.qualification && (
                <div className="bg-blue-50/30 rounded-2xl border border-blue-100 p-4 sm:p-5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
                    <div className="p-1.5 rounded-lg bg-blue-100/80 text-blue-700">
                      <GraduationCap className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <span>คุณสมบัติและความสามารถที่ต้องการ</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line pl-0 sm:pl-8">
                    {activeModalPosition.qualification}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer / Actions (Ref: F10, F11) */}
            <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center flex-wrap gap-3">
                {activeModalPosition.source_url && (
                  <a
                    href={activeModalPosition.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 underline font-medium"
                    title="เปิดหน้าประกาศเดิมใน Google Sites ของภาควิชา CSTU"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>ประกาศต้นทางในระบบ CSTU Co-op</span>
                  </a>
                )}
                {activeModalPosition.company_url && activeModalPosition.application_url && (
                  <a
                    href={activeModalPosition.company_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 underline font-medium"
                  >
                    <Globe className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span>เว็บไซต์บริษัท</span>
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  aria-label="ปิดหน้ารายละเอียด"
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200/80 bg-slate-100 border border-slate-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  ปิดหน้ารายละเอียด
                </button>
                <PositionCtaButton
                  pos={activeModalPosition}
                  size="md"
                  className="flex-1 sm:flex-initial"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Positions;
