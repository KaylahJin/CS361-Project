import React, { useState } from 'react';
import { AlertCircle, Award, Loader2, XCircle } from 'lucide-react';
import { CoopPlanApiError } from '../../data/coopPlanApi';
import type { SelectDecision } from '../../types/planReview';

export interface SelectFormProps {
  committeeName: string;
  onSelect: (decision: SelectDecision, comment: string) => Promise<void>;
  onCancel: () => void;
}

function conflictMessage(code?: string): string {
  if (code === 'CAPACITY_REACHED') {
    return 'รอบนี้คัดเลือกครบจำนวนรับแล้ว จึงเลือกเพิ่มไม่ได้ (อาจมีกรรมการอีกท่านเพิ่งเลือกไป) กรุณารีเฟรชหน้า';
  }
  if (code === 'CAPACITY_NOT_SET') {
    return 'รอบนี้ยังไม่ได้กำหนดจำนวนรับ จึงยังคัดเลือกไม่ได้ กรุณาติดต่อเจ้าหน้าที่สหกิจ';
  }
  return 'แผนนี้ได้รับการคัดเลือกไปแล้ว หรือไม่อยู่ในสถานะรอคัดเลือก กรุณารีเฟรชหน้าเพื่อดูสถานะล่าสุด';
}

/**
 * The committee's step (#149), on a plan that passed screening: select it,
 * within the period's capacity, or not, with a reason. The API checks the
 * capacity and the reason again (409 / 400).
 */
export const SelectForm: React.FC<SelectFormProps> = ({ committeeName, onSelect, onCancel }) => {
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState<SelectDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (decision: SelectDecision) => {
    setError(null);
    if (decision === 'NOT_SELECTED' && !comment.trim()) {
      setError('กรุณาระบุเหตุผลที่ไม่คัดเลือก');
      return;
    }

    setPending(decision);
    try {
      await onSelect(decision, comment.trim());
    } catch (err) {
      if (err instanceof CoopPlanApiError && err.status === 409) {
        setError(conflictMessage(err.code));
      } else {
        setError(err instanceof Error ? err.message : 'บันทึกผลการคัดเลือกไม่สำเร็จ');
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <section
      aria-labelledby="select-title"
      className="rounded-2xl border-2 border-violet-100 bg-violet-50/30 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-violet-600" />
          <h3 id="select-title" className="font-bold text-slate-900 text-sm sm:text-base">
            คัดเลือก (สำหรับกรรมการ)
          </h3>
        </div>
        <span className="text-xs text-slate-500">
          กรรมการ: <span className="font-semibold text-slate-700">{committeeName}</span>
        </span>
      </div>
      <p className="text-xs text-slate-600">
        แผนนี้ผ่านการตรวจเอกสารและคุณสมบัติแล้ว คัดเลือกได้ไม่เกินจำนวนรับของรอบ
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
        <label htmlFor="select-comment" className="mb-1.5 block text-xs font-bold text-slate-700">
          เหตุผล / ความเห็น <span className="font-semibold text-rose-500">(จำเป็นเมื่อไม่คัดเลือก)</span>
        </label>
        <textarea
          id="select-comment"
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="เช่น ลำดับคะแนนไม่ถึงจำนวนรับ..."
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
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
          id="btn-not-select"
          type="button"
          disabled={pending !== null}
          onClick={() => submit('NOT_SELECTED')}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-rose-500 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition cursor-pointer"
        >
          {pending === 'NOT_SELECTED' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          ไม่คัดเลือก
        </button>
        <button
          id="btn-select"
          type="button"
          disabled={pending !== null}
          onClick={() => submit('SELECTED')}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-violet-700 disabled:opacity-50 transition cursor-pointer"
        >
          {pending === 'SELECTED' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
          คัดเลือก
        </button>
      </div>
    </section>
  );
};

export default SelectForm;
