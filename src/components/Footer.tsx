import React from 'react';
import type { TabType } from './Navbar';

interface FooterProps {
  onTabChange?: (tab: TabType) => void;
}

export const Footer: React.FC<FooterProps> = ({ onTabChange }) => {
  /*
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setEmail('');
      }, 3000);
    }
  };
  */

  return (
    <footer className="w-full bg-[#f8f9fc] border-t border-slate-200/70 pt-12 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 pb-12 items-start justify-between">
          {/* Column 1: Brand & Main Navigation */}
          <div className="flex flex-col space-y-3">
            <span className="text-2xl font-black tracking-wider text-blue-600 mb-2 select-none">
              CEP
            </span>
            <button
              onClick={() => onTabChange?.('home')}
              className="text-left text-sm text-slate-700 hover:text-blue-600 transition-colors font-medium cursor-pointer"
            >
              หน้าหลัก
            </button>
            <button
              onClick={() => onTabChange?.('requirements')}
              className="text-left text-sm text-slate-700 hover:text-blue-600 transition-colors font-medium cursor-pointer"
            >
              เกณฑ์สหกิจ
            </button>
            <button
              onClick={() => onTabChange?.('employers')}
              className="text-left text-sm text-slate-700 hover:text-blue-600 transition-colors font-medium cursor-pointer"
            >
              สถานประกอบการ
            </button>
          </div>

          {/* Column 2: Schedule & Criteria (Hidden temporarily) */}
          {/*
          <div className="flex flex-col space-y-3">
            <span className="text-sm font-semibold text-slate-900 mb-1">
              กำหนดการณสหกิจ
            </span>
            <a href="#criteria" className="text-sm text-slate-700 hover:text-blue-600 transition-colors">
              คุณสมบัติและเกณฑ์
            </a>
            <a href="#positions" className="text-sm text-slate-700 hover:text-blue-600 transition-colors">
              ตำแหน่งที่เปิดรับ
            </a>
            <a href="#previous-years" className="text-sm text-slate-700 hover:text-blue-600 transition-colors">
              ข้อมูลปีก่อนหน้า
            </a>
          </div>
          */}

          {/* Column 3: Resources & Contact (Hidden temporarily) */}
          {/*
          <div className="flex flex-col space-y-3">
            <span className="text-sm font-semibold text-slate-900 mb-1">
              แหล่งข้อมูล
            </span>
            <a href="#faq" className="text-sm text-slate-700 hover:text-blue-600 transition-colors">
              คำถามที่พบบ่อย
            </a>
            <a href="#contact" className="text-sm text-slate-700 hover:text-blue-600 transition-colors">
              ติดต่อผู้ประสานงานสหกิจ
            </a>
            <a href="#report" className="text-sm text-slate-700 hover:text-blue-600 transition-colors">
              แจ้งข้อมูลไม่ถูกต้อง
            </a>
          </div>
          */}

          {/* Column 4: Notice & Newsletter Form (Hidden temporarily) */}
          {/*
          <div className="flex flex-col space-y-4 max-w-sm md:ml-auto w-full">
            <p className="text-xs text-blue-600 leading-relaxed font-medium">
              ข้อมูลในระบบใช้เพื่อความสะดวกในการค้นหา โปรดตรวจสอบประกาศอย่างเป็นทางการก่อนการดำเนินการ
            </p>

            <form onSubmit={handleSubmit} className="flex items-stretch shadow-xs rounded-lg overflow-hidden border border-slate-300/80 bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ระบุอีเมลของคุณ"
                className="w-full px-3 py-2 text-xs md:text-sm text-slate-800 placeholder-slate-400 bg-transparent outline-none"
                required
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 flex items-center justify-center transition-colors cursor-pointer"
              >
                {submitted ? (
                  <span className="text-xs font-semibold">✓</span>
                ) : (
                  <Mail className="w-4 h-4 stroke-[2.2]" />
                )}
              </button>
            </form>
          </div>
          */}
        </div>

        {/* Bottom Copyright */}
        <div className="border-t border-slate-200/80 pt-6 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Copyright © 2026 Cooperative Education Planning
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
