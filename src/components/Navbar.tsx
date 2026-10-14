
import React from 'react';

import {
  Home,
  FileText,
  Building2,
  Briefcase,
  GraduationCap,
  RotateCcwClock,
  ClipboardList,
} from 'lucide-react';

export type TabType =
  | 'home'
  | 'requirements'
  | 'employers'
  | 'positions'
  | 'students'
  | 'coop-plans'
  | 'periods';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const navItems = [
  { id: 'home', label: 'หน้าแรก', icon: Home },
  { id: 'requirements', label: 'เกณฑ์สหกิจ', icon: FileText },
  { id: 'employers', label: 'สถานประกอบการ', icon: Building2 },
  { id: 'positions', label: 'ตำแหน่งงาน', icon: Briefcase },
  { id: 'students', label: 'นักศึกษา', icon: GraduationCap },
  { id: 'coop-plans', label: 'แผนสหกิจ', icon: ClipboardList },
  { id: 'periods', label: 'รอบเวลา', icon: RotateCcwClock },
] as const;

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-2 py-2 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onTabChange('home')}
          aria-label="กลับหน้าหลัก"
          className="self-center select-none sm:self-auto"
        >
          <span className="text-2xl font-black tracking-wider text-blue-600">
            CEP
          </span>
        </button>

        <nav
          aria-label="เมนูหลัก"
          className="grid w-full grid-cols-7 gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1 shadow-xs sm:flex sm:w-auto sm:items-center sm:gap-1 sm:rounded-full sm:p-1"
        >
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-2 transition-colors duration-200 sm:flex-row sm:gap-1.5 sm:rounded-full sm:px-2 sm:py-2 ${
                  isActive
                    ? 'border border-blue-200 bg-blue-50 text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 stroke-[2.2] sm:h-4 sm:w-4"
                />
                <span className="w-full text-center text-[9px] leading-tight break-words sm:w-auto sm:whitespace-nowrap sm:text-xs">
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="hidden w-8 sm:block" />
      </div>
    </header>
  );
};

export default Navbar;
