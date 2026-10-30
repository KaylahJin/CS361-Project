import React, { useEffect, useState } from 'react';
import { AlertCircle, ClipboardCheck, Loader2, RotateCcw, XCircle } from 'lucide-react';
import { CoopPlanApiError, getPlanEligibility } from '../../data/coopPlanApi';
import { submissionFailureLabel } from '../../pages/submissionMessages';
import type { PlanEligibility, ScreenDecision } from '../../types/planReview';

export interface ScreenFormProps {
  planId: number;
  staffName: string;
  getIdToken: () => Promise<string | null>;
  onScreen: (decision: ScreenDecision, comment: string) => Promise<void>;
  onCancel: () => void;
}

type EligibilityState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; result: PlanEligibility };

function criteriaText({ min_gpa, min_group_gpa }: PlanEligibility['criteria']): string | null {
  if (min_gpa == null || min_group_gpa == null) return null;
  return `เกรดเฉลี่ยสะสมมากกว่า ${min_gpa.toFixed(2)} · เกรดเฉลี่ยกลุ่มวิชาบังคับอย่างน้อย ${min_group_gpa.toFixed(2)}`;
}

/**
 * Staff's step (#148), after the advisor endorsed: check the attachments shown
 * above and the period's criteria, then record ELIGIBLE, INCOMPLETE (back to
 * the student) or NOT_ELIGIBLE. The last two need a reason; the API checks
 * that again (400).
 */
export const ScreenForm: React.FC<ScreenFormProps> = ({
  planId,
  staffName,
  getIdToken,
  onScreen,
  onCancel,
}) => {
  const [eligibility, setEligibility] = useState<EligibilityState>({ kind: 'loading' });
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState<ScreenDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => getPlanEligibility(planId, await getIdToken()))().then(
      (result) => !cancelled && setEligibility({ kind: 'ready', result }),
      () => !cancelled && setEligibility({ kind: 'error' })
    );
    return () => {
      cancelled = true;
    };
  }, [planId, getIdToken]);

  const submit = async (decision: ScreenDecision) => {
    setError(null);
    if (decision !== 'ELIGIBLE' && !comment.trim()) {
      setError('กรุณาระบุเหตุผล เช่น เอกสารที่ขาด หรือเกณฑ์ที่ไม่ผ่าน');
      return;
    }

    setPending(decision);
    try {
      await onScreen(decision, comment.trim());
    } catch (err) {
      if (err instanceof CoopPlanApiError && err.status === 409) {
        setError('แผนนี้ได้รับการตรวจไปแล้ว หรือไม่อยู่ในสถานะรอตรวจ กรุณารีเฟรชหน้าเพื่อดูสถานะล่าสุด');
      } else {
        setError(err instanceof Error ? err.message : 'บันทึกผลการตรวจไม่สำเร็จ');
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <section
      aria-labelledby="screen-title"
      className="rounded-2xl border-2 border-teal-100 bg-teal-50/30 p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-teal-600" />
          <h3 id="screen-title" className="font-bold text-slate-900 text-sm sm:text-base">
            ตรวจเอกสารและคุณสมบัติ (สำหรับเจ้าหน้าที่สหกิจ)
          </h3>
        </div>
        <span className="text-xs text-slate-500">
          ผู้ตรวจ: <span className="font-semibold text-slate-700">{staffName}</span>
        </span>
      </div>
      <p className="text-xs text-slate-600">
        ตรวจไฟล์แนบด้านบน เช่น Transcript ถ้าเอกสารไม่ครบให้เลือก "เอกสารไม่ครบ" แผนจะกลับไปให้นักศึกษาแก้ไข
      </p>

      <div
        aria-label="ผลตรวจคุณสมบัติตามเกณฑ์ของรอบ"
        className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-1.5"
      >
        <p className="font-bold text-slate-700">ผลตรวจคุณสมบัติตามเกณฑ์ของรอบ</p>
        {eligibility.kind === 'loading' && (
          <p className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังตรวจ...
          </p>
        )}
        {eligibility.kind === 'error' && (
          <p className="text-rose-600">โหลดผลตรวจคุณสมบัติไม่สำเร็จ กรุณาตรวจจากข้อมูลนักศึกษาด้านบน</p>
        )}
        {eligibility.kind === 'ready' && (
          <>
            {criteriaText(eligibility.result.criteria) && (
              <p className="text-slate-500">เกณฑ์: {criteriaText(eligibility.result.criteria)}</p>
            )}
            {eligibility.result.eligible ? (
              <p className="font-semibold text-teal-700">ผ่านเกณฑ์ของรอบทุกข้อ</p>
            ) : (
              <ul className="list-disc pl-5 text-rose-700">
                {eligibility.result.failures.map((f, i) => (
                  <li key={f.code ?? i}>{submissionFailureLabel(f.code, f.message)}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

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
        <label htmlFor="screen-comment" className="mb-1.5 block text-xs font-bold text-slate-700">
          เหตุผล / ความเห็น{' '}
          <span className="font-semibold text-rose-500">(จำเป็นเมื่อเอกสารไม่ครบหรือไม่ผ่านคุณสมบัติ)</span>
        </label>
        <textarea
          id="screen-comment"
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="เช่น ไม่มีไฟล์ Transcript หรือเกรดเฉลี่ยไม่ถึงเกณฑ์..."
          className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
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
          id="btn-screen-incomplete"
          type="button"
          disabled={pending !== null}
          onClick={() => submit('INCOMPLETE')}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-amber-500 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50 transition cursor-pointer"
        >
          {pending === 'INCOMPLETE' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          เอกสารไม่ครบ
        </button>
        <button
          id="btn-screen-not-eligible"
          type="button"
          disabled={pending !== null}
          onClick={() => submit('NOT_ELIGIBLE')}
          className="inline-flex items-center gap-2 rounded-xl border-2 border-rose-500 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 transition cursor-pointer"
        >
          {pending === 'NOT_ELIGIBLE' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          ไม่ผ่านคุณสมบัติ
        </button>
        <button
          id="btn-screen-eligible"
          type="button"
          disabled={pending !== null}
          onClick={() => submit('ELIGIBLE')}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-teal-700 disabled:opacity-50 transition cursor-pointer"
        >
          {pending === 'ELIGIBLE' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
          ผ่านการตรวจ
        </button>
      </div>
    </section>
  );
};

export default ScreenForm;
