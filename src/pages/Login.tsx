import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

interface LoginProps {
  /**
   * Where to go once sign-in succeeds. Without it the form stays on screen
   * behind a signed-in navbar: pages are chosen by a tab held in App state,
   * and nothing moves that tab on its own.
   */
  onSuccess?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      onSuccess?.();
    } catch {
      // One message for every failure. Showing Cognito's own wording ("User
      // does not exist" vs "Incorrect password") would let anyone test which
      // emails have accounts here.
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-20 sm:pb-16">
      <div className="max-w-sm mx-auto p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-white to-slate-50/60 border border-slate-200/90">
        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
          <LogIn className="w-5 h-5" />
        </div>

        <h1 className="text-lg sm:text-xl font-bold text-slate-900">เข้าสู่ระบบ</h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
          เข้าสู่ระบบเพื่อจัดการแผนสหกิจศึกษาของคุณ ข้อมูลประกาศ เกณฑ์ และตำแหน่งงาน ดูได้โดยไม่ต้องเข้าสู่ระบบ
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-medium text-slate-700">
            อีเมล
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-300 focus:outline-none transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs sm:text-sm font-medium text-slate-700">
            รหัสผ่าน
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-300 focus:outline-none transition-colors"
            />
          </label>

          {error && (
            <p role="alert" className="text-xs text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-blue-600 text-white text-sm font-bold py-2.5 hover:bg-blue-700 disabled:opacity-60 disabled:hover:bg-blue-600 transition-colors"
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
};
export default Login;
