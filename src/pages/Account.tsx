// Minimal on purpose: for now its job is to be a real page behind
// ProtectedRoute. The student, advisor and staff dashboards come later.

import { User } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export const Account: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-20 sm:pb-16">
      <div className="max-w-sm p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-white to-slate-50/60 border border-slate-200/90">
        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
          <User className="w-5 h-5" />
        </div>

        <h1 className="text-lg sm:text-xl font-bold text-slate-900">บัญชีของฉัน</h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
          เข้าสู่ระบบด้วยอีเมล
        </p>
        <p className="mt-1 text-sm font-medium text-slate-900">{user?.email}</p>

        <p className="mt-4 text-xs text-slate-400 font-medium">
          บทบาทและสิทธิ์การใช้งานกำหนดจากฐานข้อมูลของระบบ ไม่ใช่จากบัญชีผู้ใช้
        </p>

        <button
          type="button"
          onClick={logout}
          className="mt-6 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300"
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
};
export default Account;
