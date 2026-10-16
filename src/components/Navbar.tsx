import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Home,
  FileText,
  Building2,
  Briefcase,
  GraduationCap,
  CalendarClock,
  ClipboardList,
  Menu,
  X,
  LogIn,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export type TabType =
  | 'home'
  | 'requirements'
  | 'employers'
  | 'positions'
  | 'students'
  | 'coop-plans'
  | 'periods'
  | 'login'
  | 'account';

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
  { id: 'periods', label: 'รอบเวลา', icon: CalendarClock },
] as const;

// 'login' and 'account' are left out of navItems on purpose: they are auth
// actions, not pages, and render in their own control below.

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const { status, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => setIsOpen(false), []);

  const handleSelect = (tab: TabType) => {
    onTabChange(tab);
    closeDrawer();
  };

  // Signing out has to move the user off a page that was only theirs while
  // signed in. Pages are chosen by a tab held in App state, not by the URL, so
  // nothing moves on its own: without this the account page is swapped for a
  // login form underneath an otherwise unchanged screen, and the coop-plan
  // page just sits there. Public pages are left alone — someone reading the
  // announcements should stay on the announcements.
  const SIGNED_IN_ONLY: TabType[] = ['account', 'coop-plans'];

  const handleLogout = () => {
    logout();
    if (SIGNED_IN_ONLY.includes(activeTab)) onTabChange('home');
    closeDrawer();
  };

  // ปิดด้วยปุ่ม Esc + ล็อกการเลื่อนหน้าจอด้านหลังขณะเปิด drawer
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  // ถ้าขยายหน้าจอจนเป็น desktop ให้ปิด drawer อัตโนมัติ
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <>
    <header className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6 lg:px-8">
        {/* Hamburger (mobile / tablet) */}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="เปิดเมนู"
          aria-expanded={isOpen}
          aria-controls="mobile-drawer"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:hidden"
        >
          <Menu aria-hidden="true" className="h-6 w-6" />
        </button>

        {/* Logo */}
        <button
          type="button"
          onClick={() => handleSelect('home')}
          aria-label="กลับหน้าหลัก"
          className="select-none rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 max-lg:absolute max-lg:left-1/2 max-lg:-translate-x-1/2"
        >
          <span className="text-2xl font-black tracking-wider text-blue-600">
            CEP
          </span>
        </button>

        {/* Desktop nav */}
        <nav
          aria-label="เมนูหลัก"
          className="hidden items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50/80 p-1 shadow-xs lg:flex"
        >
          {navItems.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;

            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs whitespace-nowrap transition-colors duration-200 ${
                  isActive
                    ? 'border border-blue-200 bg-blue-50 text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0 stroke-[2.2]" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/*
          Auth control. Stays w-10 on mobile, matching the hamburger on the
          left, so the centred logo stays centred. Below lg the auth entries
          move into the drawer instead.
        */}
        <div className="flex w-10 shrink-0 items-center justify-end lg:w-auto">
          {status === 'authenticated' ? (
            <div className="hidden items-center gap-1 lg:flex">
              <button
                type="button"
                onClick={() => onTabChange('account')}
                aria-current={activeTab === 'account' ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs whitespace-nowrap transition-colors duration-200 ${
                  activeTab === 'account'
                    ? 'border border-blue-200 bg-blue-50 text-blue-600 shadow-xs'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <User aria-hidden="true" className="h-4 w-4 shrink-0 stroke-[2.2]" />
                <span>บัญชีของฉัน</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs whitespace-nowrap text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-800"
              >
                <LogOut aria-hidden="true" className="h-4 w-4 shrink-0 stroke-[2.2]" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onTabChange('login')}
              aria-current={activeTab === 'login' ? 'page' : undefined}
              className="hidden items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium whitespace-nowrap text-blue-600 transition-colors duration-200 hover:border-blue-300 lg:flex"
            >
              <LogIn aria-hidden="true" className="h-4 w-4 shrink-0 stroke-[2.2]" />
              <span>เข้าสู่ระบบ</span>
            </button>
          )}
        </div>
      </div>
    </header>

      {/*
        Overlay และ Drawer ต้องอยู่นอก <header> เพราะ header มี backdrop-blur
        ซึ่งทำให้ element แบบ fixed ที่อยู่ข้างในอ้างอิงขนาดจาก header (สูงแค่ 56px)
        แทนที่จะอ้างอิงจากหน้าจอ
      */}

      {/* Overlay */}
      <div
        onClick={closeDrawer}
        aria-hidden="true"
        className={`fixed inset-0 z-[60] bg-slate-900/40 transition-opacity duration-300 motion-reduce:transition-none lg:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Drawer */}
      <aside
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="เมนูนำทาง"
        aria-hidden={!isOpen}
        className={`fixed inset-y-0 left-0 z-[70] flex w-72 max-w-[85vw] flex-col bg-white shadow-xl transition-[transform,visibility] duration-300 ease-out motion-reduce:transition-none lg:hidden ${
          isOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4">
          <span className="text-2xl font-black tracking-wider text-blue-600">
            CEP
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label="ปิดเมนู"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <X aria-hidden="true" className="h-6 w-6" />
          </button>
        </div>

        <nav
          aria-label="เมนูหลัก"
          className="flex-1 overflow-y-auto overscroll-contain p-3"
        >
          <ul className="flex flex-col gap-1">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;

              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      isActive
                        ? 'bg-blue-50 font-medium text-blue-600'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 stroke-[2.2]"
                    />
                    <span>{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Auth entries — the mobile counterpart of the header control,
              which is hidden below lg to keep the logo centred. */}
          <ul className="mt-2 flex flex-col gap-1 border-t border-slate-200 pt-2">
            {status === 'authenticated' ? (
              <>
                <li>
                  <button
                    type="button"
                    onClick={() => handleSelect('account')}
                    aria-current={activeTab === 'account' ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      activeTab === 'account'
                        ? 'bg-blue-50 font-medium text-blue-600'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <User aria-hidden="true" className="h-5 w-5 shrink-0 stroke-[2.2]" />
                    <span>บัญชีของฉัน</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <LogOut aria-hidden="true" className="h-5 w-5 shrink-0 stroke-[2.2]" />
                    <span>ออกจากระบบ</span>
                  </button>
                </li>
              </>
            ) : (
              <li>
                <button
                  type="button"
                  onClick={() => handleSelect('login')}
                  aria-current={activeTab === 'login' ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-base transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    activeTab === 'login'
                      ? 'bg-blue-50 font-medium text-blue-600'
                      : 'text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <LogIn aria-hidden="true" className="h-5 w-5 shrink-0 stroke-[2.2]" />
                  <span>เข้าสู่ระบบ</span>
                </button>
              </li>
            )}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Navbar;