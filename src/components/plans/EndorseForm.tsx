import React, { useState } from 'react';
import { AlertCircle, Loader2, RotateCcw, UserCheck } from 'lucide-react';
import { CoopPlanApiError } from '../../data/coopPlanApi';
import type { EndorseDecision } from '../../types/planReview';

export interface EndorseFormProps {
  advisorName: string;
  onEndorse: (decision: EndorseDecision, comment: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * The advisor's step (#147): endorse a submitted plan, or decline with a
 * reason, which sends it back to the student. Endorsing is not approving, so
 * there is no approve or reject here. The API checks the reason again (400).
 */
export const EndorseForm: React.FC<EndorseFormProps> = ({
  advisorName,
  onEndorse,
  onCancel,
}) => {
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState<EndorseDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (decision: EndorseDecision) => {
    setError(null);
    if (decision === 'NOT_ENDORSED' && !comment.trim()) {
      setError('กรุณาระบุเหตุผลที่ไม่รับรอง เพื่อให้นักศึกษานำไปแก้ไข');
      return;
    }

    setPending(decision);
    try {
      await onEndorse(decision, comment.trim());
    } catch (err) {
      if (err instanceof CoopPlanApiError && err.status === 409) {
        setError('แผนนี้ได้รับการพิจารณาไปแล้ว หรือไม่อยู่ในสถานะรอตรวจ กรุณารีเฟรชหน้าเพื่อดูสถานะล่าสุด');
      } else {
        setError(err instanceof Error ? err.message : 'บันทึกผลการรับรองไม่สำเร็จ');
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <section
      aria-labelledby="endorse-title"
      className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-indigo-600" />
          <h3 id="endorse-title" className="font-bold text-slate-900 text-sm sm:text-base">
            รับรองความประพฤติ (สำหรับอาจารย์ที่ปรึกษา)
          </h3>
        </div>
        <span className="text-xs text-slate-500">
          อาจารย์: <span className="font-semibold text-slate-700">{advisorName}</span>
        </span>
      </div>
      <p className="text-xs text-slate-600">
        การรับรองไม่ใช่การอนุมัติ แผนที่รับรองแล้วจะไปให้เจ้าหน้าที่สหกิจตรวจเอกสารและคุณสมบัติต่อ
      </p>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label htmlFor="endorse-comment" className="mb-1.5 block text-xs font-bold text-slate-700">
          เหตุผล / ความเห็น <span className="font-semibold text-rose-500">(จำเป็นเมื่อไม่รับรอง)</span>
        </label>
        <textarea
          id="endorse-comment"
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="เช่น ขาดเอกสารรับรองความประพฤติ หรือข้อมูลที่ต้องแก้ไข..."
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          ยกเลิก
        </button>
        <button
          id="btn-not-endorse"
          type="button"
          disabled={pending !== null}
          onClick={() => submit('NOT_ENDORSED')}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-amber-500 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50 transition cursor-pointer"
        >
          {pending === 'NOT_ENDORSED' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          ไม่รับรอง
        </button>
        <button
          id="btn-endorse"
          type="button"
          disabled={pending !== null}
          onClick={() => submit('ENDORSED')}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
        >
          {pending === 'ENDORSED' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
          รับรอง
        </button>
      </div>
    </section>
  );
};

export default EndorseForm;
