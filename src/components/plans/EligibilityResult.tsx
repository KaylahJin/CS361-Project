import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getPlanEligibility } from '../../data/coopPlanApi';
import { submissionFailureLabel } from '../../pages/submissionMessages';
import type { PlanEligibility } from '../../types/planReview';

type EligibilityState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; result: PlanEligibility };

function criteriaText({ min_gpa, min_group_gpa }: PlanEligibility['criteria']): string | null {
  if (min_gpa == null || min_group_gpa == null) return null;
  return `เกรดเฉลี่ยสะสมมากกว่า ${min_gpa.toFixed(2)} · เกรดเฉลี่ยกลุ่มวิชาบังคับอย่างน้อย ${min_group_gpa.toFixed(2)}`;
}

/**
 * The plan's student against the criteria of the plan's period (#148), for
 * staff screening the plan. Same rules and Thai text as submission. A failed
 * load only says so: staff can still judge from the student's record.
 */
export const EligibilityResult: React.FC<{
  planId: number;
  getIdToken: () => Promise<string | null>;
}> = ({ planId, getIdToken }) => {
  const [eligibility, setEligibility] = useState<EligibilityState>({ kind: 'loading' });

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

  return (
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
  );
};

export default EligibilityResult;
