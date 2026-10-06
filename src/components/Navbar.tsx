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

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <header className="w-full bg-white/90 backdrop-blur-sm sticky top-0 z-50 border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div
          onClick={() => onTabChange('home')}
          className="cursor-pointer select-none"
        >
          <span className="text-2xl font-black tracking-wider text-blue-600">
            CEP
          </span>
        </div>

        <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-50/80 p-1 rounded-full border border-slate-200/80 shadow-xs">
          <button
            onClick={() => onTabChange('home')}
            title="หน้าหลัก"
            className={`flex items-center justify-center w-10 h-8 sm:w-12 sm:h-9 rounded-full transition-all duration-200 ${
              activeTab === 'home'
                ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
            }`}
          >
            <Home className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </button>

          <button
            onClick={() => onTabChange('requirements')}
            title="เกณฑ์สหกิจ"
            className={`flex items-center justify-center w-10 h-8 sm:w-12 sm:h-9 rounded-full transition-all duration-200 ${
              activeTab === 'requirements'
                ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
            }`}
          >
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </button>

          <button
            onClick={() => onTabChange('employers')}
            title="สถานประกอบการ"
            className={`flex items-center justify-center w-10 h-8 sm:w-12 sm:h-9 rounded-full transition-all duration-200 ${
              activeTab === 'employers'
                ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
            }`}
          >
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </button>

          <button
            onClick={() => onTabChange('positions')}
            title="ตำแหน่งงานสหกิจ"
            className={`flex items-center justify-center w-10 h-8 sm:w-12 sm:h-9 rounded-full transition-all duration-200 ${
              activeTab === 'positions'
                ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
            }`}
          >
            <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </button>

          <button
            onClick={() => onTabChange('students')}
            title="ข้อมูลนักศึกษา"
            className={`flex items-center justify-center w-10 h-8 sm:w-12 sm:h-9 rounded-full transition-all duration-200 ${
              activeTab === 'students'
                ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
            }`}
          >
            <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </button>

          {/* Co-op Plans */}
          <button
            onClick={() => onTabChange('coop-plans')}
            title="แผนสหกิจ"
            className={`flex items-center justify-center w-10 h-8 sm:w-12 sm:h-9 rounded-full transition-all duration-200 ${
              activeTab === 'coop-plans'
                ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
            }`}
          >
            <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </button>

          <button
            onClick={() => onTabChange('periods')}
            title="รอบเวลากำหนดการสหกิจ"
            className={`flex items-center justify-center w-10 h-8 sm:w-12 sm:h-9 rounded-full transition-all duration-200 ${
              activeTab === 'periods'
                ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
            }`}
          >
            <RotateCcwClock className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
          </button>
        </nav>

        <div className="w-8 hidden sm:block" />
      </div>
    </header>
  );
};

export default Navbar;