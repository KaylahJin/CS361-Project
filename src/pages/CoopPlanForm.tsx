// Create / edit form for a coop plan (V3-04.1).
//
// One form, two modes:
//   - no `plan`  → create. Period is chosen here and cannot change afterwards.
//   - a `plan`   → edit.   Only PREPARING and RETURNED plans may be edited.
//
// Everything on this page is a draft. Saving never submits the plan — that is
// a separate step (V3-04.2) — and the page says so rather than leaving a
// student to wonder whether pressing Save sent it to their advisor.
//
// Nothing here is access control. Which plans a person may create or edit is
// decided by the API from the verified token, and every refusal comes back as
// a status code this form turns into a sentence. Hiding or disabling a control
// is a courtesy; it is never what stops a request.
//
// Why create is two requests: POST /coop-plans takes only the period and the
// position, so a note or an acknowledgement typed into the create form has to
// follow in a PATCH. If the POST succeeds and the PATCH fails, the plan
// already exists, so the form switches to edit mode for it instead of staying
// in create mode — pressing Save again must not POST a second time and meet a
// 409 for the plan it just made.

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  Save,
} from 'lucide-react';

import { useAuth } from '../auth/AuthContext';
import {
  CoopPlanApiError,
  createCoopPlan,
  updateCoopPlan,
} from '../data/coopPlanApi';
import { getPeriodTimeline } from '../data/periodAPI';
import { getPositions } from '../data/positionApi';

import {
  MAX_STUDENT_NOTE,
  isPlanEditable,
  type CoopPlan,
  type UpdateCoopPlanInput,
} from '../types/coopPlan';
import type { Period } from '../types/period';
import { STATUS_LABELS, type Position } from '../types/position';

/* ============================================================
   Form values and the diff against the saved plan
   ============================================================ */

interface FormValues {
  periodId: string;
  positionId: string; // '' = no position chosen yet
  note: string;
  acknowledged: boolean;
  termsAccepted: boolean;
}

const EMPTY_VALUES: FormValues = {
  periodId: '',
  positionId: '',
  note: '',
  acknowledged: false,
  termsAccepted: false,
};

function valuesFromPlan(plan: CoopPlan): FormValues {
  return {
    periodId: plan.period_id,
    positionId: plan.position_id ?? '',
    note: plan.student_note ?? '',
    acknowledged: plan.acknowledged_pre_course,
    termsAccepted: plan.terms_accepted_at !== null,
  };
}

// A note of only whitespace is no note. The API stores it as NULL, so compare
// it as empty too, or an untouched empty note would look edited.
function normalizeNote(note: string): string {
  return note.trim() === '' ? '' : note;
}

/** What differs from the saved plan, in the shape PATCH accepts. */
function diffFromPlan(plan: CoopPlan, values: FormValues): UpdateCoopPlanInput {
  const saved = valuesFromPlan(plan);
  const diff: UpdateCoopPlanInput = {};

  if (values.positionId !== saved.positionId) {
    diff.positionId = values.positionId === '' ? null : values.positionId;
  }

  if (normalizeNote(values.note) !== normalizeNote(saved.note)) {
    diff.studentNote =
      normalizeNote(values.note) === '' ? null : values.note;
  }

  if (values.acknowledged !== saved.acknowledged) {
    diff.acknowledgedPreCourse = values.acknowledged;
  }

  if (values.termsAccepted !== saved.termsAccepted) {
    diff.termsAccepted = values.termsAccepted;
  }

  return diff;
}

/** Anything typed into a create form besides the period. */
function createHasContent(values: FormValues): boolean {
  return (
    values.positionId !== '' ||
    normalizeNote(values.note) !== '' ||
    values.acknowledged ||
    values.termsAccepted
  );
}

/* ============================================================
   Refusals, in words

   The API's own message is English and written for developers, so it is never
   shown. Each answer means something different to the person at the keyboard
   — sign in again, ask for access, open the plan you already have, reload —
   and a generic "save failed" would send them the wrong way.
   ============================================================ */

function describeSaveError(err: unknown): string {
  if (err instanceof CoopPlanApiError) {
    if (err.status === 401) {
      return 'เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง ข้อมูลที่กรอกยังไม่ถูกบันทึก';
    }

    if (err.status === 403) {
      return 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้ การสร้างและแก้ไขแผนทำได้เฉพาะนักศึกษาที่เป็นเจ้าของแผน';
    }

    if (err.status === 404) {
      if (err.code === 'PERIOD_NOT_FOUND') {
        return 'ไม่พบรอบสหกิจที่เลือก กรุณาเลือกรอบใหม่';
      }
      if (err.code === 'POSITION_NOT_FOUND') {
        return 'ไม่พบตำแหน่งที่เลือก กรุณาเลือกตำแหน่งใหม่';
      }
      return 'ไม่พบแผนนี้ในระบบ';
    }

    if (err.status === 409) {
      if (err.code === 'ACTIVE_PLAN_EXISTS') {
        return 'คุณมีแผนที่ยังดำเนินการอยู่ในรอบนี้แล้ว (กำลังเตรียม ยื่นแล้ว หรือส่งกลับแก้ไข) กรุณาเปิดแผนเดิมจากรายการแทนการสร้างใหม่';
      }
      return 'แผนนี้อยู่ในสถานะที่แก้ไขไม่ได้ หรือสถานะเพิ่งเปลี่ยนระหว่างที่คุณแก้ไข จึงไม่มีการบันทึก กรุณากลับไปโหลดข้อมูลใหม่';
    }

    if (err.status === 400) {
      if (err.code === 'SUBMISSION_FIELDS_LOCKED') {
        return 'ไม่สามารถถอนการยอมรับเงื่อนไขได้ เพราะแผนนี้เคยถูกยื่นแล้ว';
      }
      return 'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง';
    }
  }

  return 'บันทึกไม่สำเร็จ เกิดข้อผิดพลาดระหว่างเชื่อมต่อกับระบบ กรุณาลองอีกครั้ง';
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';

  return new Date(value).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ============================================================
   Small pieces
   ============================================================ */

const FIELD_CLASS =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-bold text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function positionLabel(position: Position): string {
  const company = position.company_short_name || position.company_name;
  const base = company ? `${position.title} — ${company}` : position.title;

  // A closed position can still be chosen (the student may have applied before
  // it closed); the label just says so rather than hiding it.
  return position.status === 'open'
    ? base
    : `${base} (${STATUS_LABELS[position.status]})`;
}

/* ============================================================
   The form
   ============================================================ */

interface CoopPlanFormProps {
  /** Omit to create a new plan; pass a plan to edit it. */
  plan?: CoopPlan;
  /** Leave the form. Called only after the person confirms discarding unsaved edits. */
  onBack: () => void;
  /** Called with the plan exactly as the API returned it after each save. */
  onSaved?: (plan: CoopPlan) => void;
}

export default function CoopPlanForm({
  plan: initialPlan,
  onBack,
  onSaved,
}: CoopPlanFormProps) {
  const { getIdToken } = useAuth();

  // The plan this form is working on. Undefined until the first save when
  // creating; set to the saved plan afterwards, which turns the form into an
  // edit form for it.
  const [current, setCurrent] = useState<CoopPlan | undefined>(initialPlan);
  const [values, setValues] = useState<FormValues>(
    initialPlan ? valuesFromPlan(initialPlan) : EMPTY_VALUES,
  );

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  // setState after an awaited save must not run on an unmounted form.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ---------- periods (create only) ---------- */

  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodsState, setPeriodsState] = useState<
    'loading' | 'ready' | 'error'
  >(initialPlan ? 'ready' : 'loading');
  const [periodsAttempt, setPeriodsAttempt] = useState(0);

  const isCreate = current === undefined;

  useEffect(() => {
    if (!isCreate) return;

    let cancelled = false;

    getPeriodTimeline()
      .then((data) => {
        if (cancelled) return;

        setPeriods(data.all_periods ?? []);
        setPeriodsState('ready');

        // Start on the active period so the common case is one click fewer;
        // never overwrite a choice the person already made.
        const active =
          data.period ?? (data.all_periods ?? []).find((p) => p.is_active);
        if (active) {
          setValues((v) =>
            v.periodId ? v : { ...v, periodId: active.period_id },
          );
        }
      })
      .catch(() => {
        if (!cancelled) setPeriodsState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [isCreate, periodsAttempt]);

  /* ---------- positions for the chosen period ---------- */

  const positionPeriodId = current ? current.period_id : values.periodId;

  // What was fetched, and for which period. Loading and error are worked out
  // from this rather than stored, so a result for the previous period is never
  // shown against the current one while the new request is still out.
  const [fetched, setFetched] = useState<{
    periodId: string;
    items: Position[];
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    if (!positionPeriodId) return;

    const controller = new AbortController();

    getPositions({ period_id: positionPeriodId }, { signal: controller.signal })
      .then((items) => {
        setFetched({ periodId: positionPeriodId, items, failed: false });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setFetched({ periodId: positionPeriodId, items: [], failed: true });
      });

    return () => controller.abort();
  }, [positionPeriodId]);

  const forThisPeriod =
    fetched && fetched.periodId === positionPeriodId ? fetched : null;
  const positionsState: 'idle' | 'loading' | 'ready' | 'error' =
    !positionPeriodId
      ? 'idle'
      : !forThisPeriod
        ? 'loading'
        : forThisPeriod.failed
          ? 'error'
          : 'ready';

  // The saved position may not be in the list any more (closed, or no longer
  // offered this period). Keep it selectable so opening a plan never silently
  // blanks the position the student already chose.
  const positionOptions = useMemo(() => {
    const options = (forThisPeriod?.items ?? []).map((p) => ({
      value: p.position_id,
      label: positionLabel(p),
    }));

    if (
      current?.position_id &&
      !options.some((o) => o.value === current.position_id)
    ) {
      options.unshift({
        value: current.position_id,
        label: current.position_title ?? current.position_id,
      });
    }

    return options;
  }, [forThisPeriod, current]);

  /* ---------- derived state ---------- */

  const diff = current ? diffFromPlan(current, values) : {};
  const dirty = current
    ? Object.keys(diff).length > 0
    : createHasContent(values);

  const editable = current ? isPlanEditable(current.status) : true;

  // chk_coop_plans_submitted: once a plan has been submitted, the terms and the
  // acknowledgement have to stay on it. The API refuses to clear them, so the
  // boxes are locked rather than offered and then refused.
  const submissionLocked = current?.status === 'RETURNED';
  const acknowledgedLocked =
    submissionLocked && current !== undefined && current.acknowledged_pre_course;
  const termsLocked =
    submissionLocked && current !== undefined && current.terms_accepted_at !== null;

  const noteTooLong = values.note.length > MAX_STUDENT_NOTE;

  const canSave =
    editable &&
    !saving &&
    !noteTooLong &&
    (isCreate ? values.periodId !== '' : dirty);

  /* ---------- handlers ---------- */

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setNotice(null);
    setConfirmingLeave(false);
    setValues((v) => ({ ...v, [key]: value }));
  };

  const handlePeriodChange = (periodId: string) => {
    setNotice(null);
    // Positions belong to a period, so a position chosen for the old one is
    // not a valid choice for the new one.
    setValues((v) => ({ ...v, periodId, positionId: '' }));
  };

  const handleBack = () => {
    if (dirty && !confirmingLeave) {
      setConfirmingLeave(true);
      return;
    }
    onBack();
  };

  const finishSave = (saved: CoopPlan) => {
    if (!mountedRef.current) return;

    setCurrent(saved);
    setValues(valuesFromPlan(saved));
    onSaved?.(saved);

    setNotice({
      kind: 'success',
      text:
        saved.status === 'RETURNED'
          ? `บันทึกการแก้ไขเรียบร้อยแล้ว เมื่อ ${formatDateTime(saved.updated_at)} แผนยังอยู่ในสถานะส่งกลับแก้ไข และยังไม่ถูกยื่น`
          : `บันทึกร่างเรียบร้อยแล้ว เมื่อ ${formatDateTime(saved.updated_at)} ร่างนี้ยังไม่ถือเป็นการยื่นแผน`,
    });
  };

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    setNotice(null);
    setConfirmingLeave(false);

    // Created by this click, so a failed follow-up can still switch to it.
    let created: CoopPlan | undefined;

    try {
      if (current) {
        // Only what changed. Re-sending an untouched checkbox would be a
        // pointless write, and on a returned plan an untouched `true` is
        // exactly the value the API insists stays.
        finishSave(await updateCoopPlan(current.plan_id, diff, await getIdToken()));
        return;
      }

      created = await createCoopPlan(
        {
          periodId: values.periodId,
          positionId: values.positionId === '' ? null : values.positionId,
        },
        await getIdToken(),
      );

      const extras: UpdateCoopPlanInput = {};
      if (normalizeNote(values.note) !== '') extras.studentNote = values.note;
      if (values.acknowledged) extras.acknowledgedPreCourse = true;
      if (values.termsAccepted) extras.termsAccepted = true;

      if (Object.keys(extras).length === 0) {
        finishSave(created);
        return;
      }

      finishSave(await updateCoopPlan(created.plan_id, extras, await getIdToken()));
    } catch (err) {
      if (!mountedRef.current) return;

      if (created) {
        // The plan exists; only the second step failed. Work on it from here.
        // `values` keeps what the person typed, so it shows up as unsaved
        // changes against the new plan and the next Save sends just those.
        setCurrent(created);
        onSaved?.(created);
        setNotice({
          kind: 'error',
          text: `สร้างแผนฉบับร่างแล้ว แต่ข้อมูลบางส่วนยังไม่ถูกบันทึก — ${describeSaveError(err)}`,
        });
      } else {
        setNotice({ kind: 'error', text: describeSaveError(err) });
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  /* ---------- render ---------- */

  const title = isCreate ? 'สร้างแผนสหกิจศึกษาใหม่' : 'แก้ไขแผนสหกิจศึกษา';

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={handleBack}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-blue-600"
      >
        <ArrowLeft className="h-4 w-4" />
        {isCreate ? 'กลับรายการคำร้อง' : 'กลับรายละเอียดแผน'}
      </button>

      {confirmingLeave && (
        <div
          role="alertdialog"
          aria-label="ยืนยันการออกโดยไม่บันทึก"
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm font-medium text-amber-800">
            มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการออกโดยไม่บันทึกหรือไม่
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingLeave(false)}
              className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-800 transition hover:bg-amber-100"
            >
              กลับไปแก้ไขต่อ
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700"
            >
              ออกโดยไม่บันทึก
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          {title}
        </h1>
        {current && (
          <p className="mt-2 text-sm text-slate-500">
            Plan #{current.plan_id} · {current.period_name || current.period_id}
          </p>
        )}
      </div>

      {/* A returned plan: say what the reviewer asked for, above the fields
          that have to change. */}
      {current?.status === 'RETURNED' && (
        <section
          aria-label="ความเห็นจากผู้พิจารณา"
          className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"
        >
          <h2 className="text-sm font-bold text-amber-800">
            แผนนี้ถูกส่งกลับให้แก้ไข
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm text-amber-900">
            {current.review_comment || 'ไม่มีความเห็นแนบมา'}
          </p>
          <p className="mt-2 text-xs text-amber-700">
            {current.reviewer_name ? `โดย ${current.reviewer_name} · ` : ''}
            {formatDateTime(current.reviewed_at)}
          </p>
        </section>
      )}

      {!editable && current && (
        <div
          role="alert"
          className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        >
          แผนที่อยู่ในสถานะ “{current.status}” แก้ไขไม่ได้
          แก้ไขได้เฉพาะแผนที่กำลังเตรียมหรือถูกส่งกลับให้แก้ไขเท่านั้น
        </div>
      )}

      {editable && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          noValidate
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              การบันทึกนี้เป็นเพียงร่าง{' '}
              <strong>ยังไม่ถือเป็นการยื่นแผน</strong>{' '}
              คุณกลับมาเปิดแก้ไขได้ภายหลัง
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {/* Period */}
            {isCreate ? (
              <Field
                id="plan-period"
                label="รอบสหกิจศึกษา *"
                hint="เลือกแล้วเปลี่ยนภายหลังไม่ได้"
              >
                <select
                  id="plan-period"
                  value={values.periodId}
                  onChange={(e) => handlePeriodChange(e.target.value)}
                  disabled={saving || periodsState === 'loading'}
                  className={FIELD_CLASS}
                >
                  <option value="">
                    {periodsState === 'loading'
                      ? 'กำลังโหลดรอบสหกิจ...'
                      : 'เลือกรอบสหกิจ'}
                  </option>
                  {periods.map((p) => (
                    <option key={p.period_id} value={p.period_id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {periodsState === 'error' && (
                  <p role="alert" className="text-xs text-red-500">
                    โหลดรายการรอบสหกิจไม่สำเร็จ{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setPeriodsState('loading');
                        setPeriodsAttempt((n) => n + 1);
                      }}
                      className="font-bold underline"
                    >
                      ลองอีกครั้ง
                    </button>
                  </p>
                )}
              </Field>
            ) : (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700">
                  รอบสหกิจศึกษา
                </span>
                <span className="text-sm text-slate-600">
                  {current.period_name || current.period_id}
                </span>
              </div>
            )}

            {/* Position */}
            <Field
              id="plan-position"
              label="ตำแหน่งงาน"
              hint="ยังไม่เลือกก็ได้ เลือกภายหลังได้ แต่ต้องเลือกก่อนยื่นแผน"
            >
              <select
                id="plan-position"
                value={values.positionId}
                onChange={(e) => set('positionId', e.target.value)}
                disabled={saving || !positionPeriodId}
                className={FIELD_CLASS}
              >
                <option value="">
                  {!positionPeriodId
                    ? 'เลือกรอบสหกิจก่อน'
                    : positionsState === 'loading'
                      ? 'กำลังโหลดตำแหน่ง...'
                      : 'ยังไม่เลือกตำแหน่ง'}
                </option>
                {positionOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              {positionsState === 'error' && (
                <p role="alert" className="text-xs text-red-500">
                  โหลดรายการตำแหน่งไม่สำเร็จ คุณยังบันทึกร่างโดยไม่เลือกตำแหน่งได้
                </p>
              )}
            </Field>

            {/* Note */}
            <Field
              id="plan-note"
              label="หมายเหตุจากนักศึกษา"
              hint={`${values.note.length}/${MAX_STUDENT_NOTE} ตัวอักษร`}
            >
              <textarea
                id="plan-note"
                value={values.note}
                onChange={(e) => set('note', e.target.value)}
                disabled={saving}
                rows={5}
                maxLength={MAX_STUDENT_NOTE}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
              />
            </Field>

            {/* Conditions */}
            <fieldset className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
              <legend className="px-1 text-sm font-bold text-slate-700">
                เงื่อนไขก่อนเริ่มสหกิจ
              </legend>

              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={values.acknowledged}
                  onChange={(e) => set('acknowledged', e.target.checked)}
                  disabled={saving || acknowledgedLocked}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>รับทราบและผ่านเงื่อนไขรายวิชาก่อนเริ่มสหกิจศึกษา</span>
              </label>

              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={values.termsAccepted}
                  onChange={(e) => set('termsAccepted', e.target.checked)}
                  disabled={saving || termsLocked}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  ยอมรับข้อกำหนดและเงื่อนไขของการปฏิบัติสหกิจศึกษา
                  {current?.terms_accepted_at && (
                    <span className="block text-xs text-slate-400">
                      ยอมรับเมื่อ {formatDateTime(current.terms_accepted_at)}
                    </span>
                  )}
                </span>
              </label>

              {(acknowledgedLocked || termsLocked) && (
                <p className="text-xs text-slate-500">
                  เงื่อนไขที่ยอมรับไว้ตอนยื่นแผนครั้งก่อนถอนไม่ได้
                </p>
              )}
            </fieldset>
          </div>

          {notice && (
            <div
              role={notice.kind === 'error' ? 'alert' : 'status'}
              className={`mt-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${
                notice.kind === 'error'
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {notice.kind === 'error' ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <p>{notice.text}</p>
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              {isCreate
                ? values.periodId === ''
                  ? 'เลือกรอบสหกิจเพื่อบันทึกร่าง'
                  : ''
                : dirty
                  ? 'มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก'
                  : 'ยังไม่มีการเปลี่ยนแปลง'}
            </p>

            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-blue-600"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'กำลังบันทึก...' : 'บันทึกร่าง'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}