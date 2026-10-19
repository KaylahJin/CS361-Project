import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: useAuthMock }));

const createCoopPlanMock = vi.fn();
const updateCoopPlanMock = vi.fn();

vi.mock('../data/coopPlanApi', async () => {
  const actual = await vi.importActual<typeof import('../data/coopPlanApi')>(
    '../data/coopPlanApi',
  );
  return {
    ...actual,
    createCoopPlan: createCoopPlanMock,
    updateCoopPlan: updateCoopPlanMock,
  };
});

const getPeriodTimelineMock = vi.fn();
vi.mock('../data/periodAPI', () => ({ getPeriodTimeline: getPeriodTimelineMock }));

const getPositionsMock = vi.fn();
vi.mock('../data/positionApi', () => ({ getPositions: getPositionsMock }));

const { CoopPlanApiError } = await import('../data/coopPlanApi');
const { default: CoopPlanForm } = await import('./CoopPlanForm');

import type { CoopPlan, CoopPlanStatus } from '../types/coopPlan';

const PERIOD = {
  period_id: 'P2568-1',
  name: 'ภาคการศึกษาที่ 1/2568',
  academic_year: 2568,
  semester: '1',
  is_active: true,
};
const OTHER_PERIOD = { ...PERIOD, period_id: 'P2568-2', name: 'ภาคการศึกษาที่ 2/2568', is_active: false };

const POSITION = {
  position_id: 'POS013',
  company_id: 'C001',
  company_short_name: 'Cube',
  title: 'Java Developer',
  category: 'software_development',
  work_mode: 'hybrid',
  status: 'open',
};
const CLOSED_POSITION = { ...POSITION, position_id: 'POS014', title: 'QA Intern', status: 'closed' };

function plan(overrides: Partial<CoopPlan> = {}): CoopPlan {
  return {
    plan_id: 7,
    student_id: '6600000001',
    period_id: 'P2568-1',
    position_id: null,
    status: 'PREPARING',
    acknowledged_pre_course: false,
    terms_accepted_at: null,
    student_note: null,
    submitted_at: null,
    reviewer_name: null,
    reviewed_at: null,
    review_comment: null,
    created_at: '2026-10-01T09:00:00.000Z',
    updated_at: '2026-10-01T09:00:00.000Z',
    first_name: 'บีบี',
    last_name: 'น้ำทิพย์',
    curriculum: '66',
    position_title: null,
    company_id: null,
    company_name: null,
    company_short_name: null,
    period_name: 'ภาคการศึกษาที่ 1/2568',
    ...overrides,
  };
}

// A plan that has been submitted once and then sent back: the database
// requires the terms and the acknowledgement to stay on it.
const RETURNED = plan({
  status: 'RETURNED',
  acknowledged_pre_course: true,
  terms_accepted_at: '2026-09-20T09:00:00.000Z',
  submitted_at: '2026-09-20T09:00:00.000Z',
  student_note: 'first version',
  reviewer_name: 'อ.ที่ปรึกษา',
  reviewed_at: '2026-09-25T09:00:00.000Z',
  review_comment: 'กรุณาระบุขอบเขตงานให้ชัดเจน',
  position_id: 'POS013',
  position_title: 'Java Developer',
});

function signedIn() {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
    getIdToken: async () => 'a-token',
  });
}

function renderForm(props: Partial<React.ComponentProps<typeof CoopPlanForm>> = {}) {
  const onBack = vi.fn();
  const onSaved = vi.fn();
  render(<CoopPlanForm onBack={onBack} onSaved={onSaved} {...props} />);
  return { onBack, onSaved };
}

const saveButton = () => screen.getByRole('button', { name: /บันทึกร่าง|กำลังบันทึก/ });

beforeEach(() => {
  useAuthMock.mockReset();
  createCoopPlanMock.mockReset();
  updateCoopPlanMock.mockReset();
  getPeriodTimelineMock.mockReset();
  getPositionsMock.mockReset();

  signedIn();
  getPeriodTimelineMock.mockResolvedValue({
    period: PERIOD,
    all_periods: [PERIOD, OTHER_PERIOD],
    schedules: [],
  });
  getPositionsMock.mockResolvedValue([POSITION, CLOSED_POSITION]);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

/* ============================================================
   Create
   ============================================================ */

describe('CoopPlanForm: create', () => {
  it('starts on the active period and creates a draft with just that period', async () => {
    createCoopPlanMock.mockResolvedValue(plan());
    const user = userEvent.setup();
    const { onSaved } = renderForm();

    await waitFor(() =>
      expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'),
    );
    await user.click(saveButton());

    await waitFor(() => expect(createCoopPlanMock).toHaveBeenCalledTimes(1));
    expect(createCoopPlanMock).toHaveBeenCalledWith(
      { periodId: 'P2568-1', positionId: null },
      'a-token',
    );
    // Nothing else was typed, so there is no second request.
    expect(updateCoopPlanMock).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ plan_id: 7 }));
  });

  it('never sends who the plan belongs to: the owner comes from the token', async () => {
    createCoopPlanMock.mockResolvedValue(plan());
    const user = userEvent.setup();
    renderForm();

    await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
    await user.click(saveButton());

    await waitFor(() => expect(createCoopPlanMock).toHaveBeenCalled());
    const [input] = createCoopPlanMock.mock.calls[0];
    expect(Object.keys(input).sort()).toEqual(['periodId', 'positionId']);
  });

  it('confirms the save, and says a draft is not a submission', async () => {
    createCoopPlanMock.mockResolvedValue(plan());
    const user = userEvent.setup();
    renderForm();

    await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
    await user.click(saveButton());

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/บันทึกร่างเรียบร้อยแล้ว/);
    expect(status).toHaveTextContent(/ยังไม่ถือเป็นการยื่นแผน/);
  });

  it('never offers a submit button: saving a draft is the only action here', async () => {
    renderForm();

    await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));

    expect(screen.queryByRole('button', { name: /ยื่น/ })).not.toBeInTheDocument();
  });

  it('turns into an edit form for the new plan after the first save', async () => {
    createCoopPlanMock.mockResolvedValue(plan({ plan_id: 42 }));
    const user = userEvent.setup();
    renderForm();

    await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
    await user.click(saveButton());

    expect(await screen.findByRole('heading', { name: 'แก้ไขแผนสหกิจศึกษา' })).toBeInTheDocument();
    expect(screen.getByText(/Plan #42/)).toBeInTheDocument();
    // The period is fixed once the plan exists.
    expect(screen.queryByLabelText(/รอบสหกิจศึกษา/)).not.toBeInTheDocument();
    // Nothing changed since the save, so there is nothing to save.
    expect(saveButton()).toBeDisabled();
  });

  it('loads the positions of the chosen period and creates with the chosen one', async () => {
    createCoopPlanMock.mockResolvedValue(plan({ position_id: 'POS013' }));
    const user = userEvent.setup();
    renderForm();

    await waitFor(() =>
      expect(getPositionsMock).toHaveBeenCalledWith(
        { period_id: 'P2568-1' },
        expect.objectContaining({ signal: expect.anything() }),
      ),
    );
    await screen.findByRole('option', { name: /Java Developer — Cube/ });
    await user.selectOptions(screen.getByLabelText(/ตำแหน่งงาน/), 'POS013');
    await user.click(saveButton());

    await waitFor(() => expect(createCoopPlanMock).toHaveBeenCalled());
    expect(createCoopPlanMock.mock.calls[0][0]).toEqual({
      periodId: 'P2568-1',
      positionId: 'POS013',
    });
  });

  it('labels a closed position instead of hiding it', async () => {
    renderForm();

    expect(await screen.findByRole('option', { name: /QA Intern.*ปิดรับสมัคร/ })).toBeInTheDocument();
  });

  it('clears the chosen position when the period changes, because positions belong to a period', async () => {
    const user = userEvent.setup();
    renderForm();

    await screen.findByRole('option', { name: /Java Developer/ });
    await user.selectOptions(screen.getByLabelText(/ตำแหน่งงาน/), 'POS013');
    expect(screen.getByLabelText(/ตำแหน่งงาน/)).toHaveValue('POS013');

    await user.selectOptions(screen.getByLabelText(/รอบสหกิจศึกษา/), 'P2568-2');

    expect(screen.getByLabelText(/ตำแหน่งงาน/)).toHaveValue('');
    await waitFor(() =>
      expect(getPositionsMock).toHaveBeenLastCalledWith(
        { period_id: 'P2568-2' },
        expect.anything(),
      ),
    );
  });

  it('creates, then saves the note and the two acknowledgements in a follow-up request', async () => {
    // POST /coop-plans accepts only the period and the position.
    createCoopPlanMock.mockResolvedValue(plan({ plan_id: 42 }));
    updateCoopPlanMock.mockResolvedValue(
      plan({
        plan_id: 42,
        student_note: 'ขอทำงานด้านเว็บ',
        acknowledged_pre_course: true,
        terms_accepted_at: '2026-10-02T09:00:00.000Z',
      }),
    );
    const user = userEvent.setup();
    renderForm();

    await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), 'ขอทำงานด้านเว็บ');
    await user.click(screen.getByLabelText(/รับทราบและผ่านเงื่อนไข/));
    await user.click(screen.getByLabelText(/ยอมรับข้อกำหนดและเงื่อนไข/));
    await user.click(saveButton());

    await waitFor(() => expect(updateCoopPlanMock).toHaveBeenCalledTimes(1));
    expect(updateCoopPlanMock).toHaveBeenCalledWith(
      42,
      { studentNote: 'ขอทำงานด้านเว็บ', acknowledgedPreCourse: true, termsAccepted: true },
      'a-token',
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/บันทึกร่างเรียบร้อยแล้ว/);
  });

  it('after the plan is created but the follow-up fails, saving again edits that plan instead of creating a second', async () => {
    // A second POST would meet the active-plan index and answer 409 for the
    // plan this very form had just made.
    createCoopPlanMock.mockResolvedValue(plan({ plan_id: 42 }));
    updateCoopPlanMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(plan({ plan_id: 42, student_note: 'my note' }));
    const user = userEvent.setup();
    const { onSaved } = renderForm();

    await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), 'my note');
    await user.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/สร้างแผนฉบับร่างแล้ว/);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ plan_id: 42 }));
    // What was typed is still there, now as an unsaved change to plan 42.
    expect(screen.getByLabelText(/หมายเหตุจากนักศึกษา/)).toHaveValue('my note');

    await user.click(saveButton());

    await waitFor(() => expect(updateCoopPlanMock).toHaveBeenCalledTimes(2));
    expect(createCoopPlanMock).toHaveBeenCalledTimes(1);
    expect(updateCoopPlanMock).toHaveBeenLastCalledWith(42, { studentNote: 'my note' }, 'a-token');
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('cannot be saved until a period is chosen', async () => {
    getPeriodTimelineMock.mockResolvedValue({
      period: null,
      all_periods: [{ ...PERIOD, is_active: false }],
      schedules: [],
    });
    const user = userEvent.setup();
    renderForm();

    await screen.findByRole('option', { name: PERIOD.name });
    expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('');
    expect(saveButton()).toBeDisabled();

    await user.selectOptions(screen.getByLabelText(/รอบสหกิจศึกษา/), 'P2568-1');
    expect(saveButton()).toBeEnabled();
  });

  it('says so, with a retry, when the periods cannot be loaded', async () => {
    getPeriodTimelineMock.mockRejectedValueOnce(new Error('down'));
    const user = userEvent.setup();
    renderForm();

    expect(await screen.findByText(/โหลดรายการรอบสหกิจไม่สำเร็จ/)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));

    await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
  });

  it('still lets a draft be saved when the positions cannot be loaded', async () => {
    getPositionsMock.mockRejectedValue(new Error('down'));
    renderForm();

    expect(await screen.findByText(/โหลดรายการตำแหน่งไม่สำเร็จ/)).toBeInTheDocument();
    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('disables Save while a request is in flight, so a double click cannot create two plans', async () => {
    let finish: (p: CoopPlan) => void = () => {};
    createCoopPlanMock.mockReturnValue(new Promise<CoopPlan>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderForm();

    await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
    await user.click(saveButton());

    expect(await screen.findByRole('button', { name: /กำลังบันทึก/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /กำลังบันทึก/ }));
    expect(createCoopPlanMock).toHaveBeenCalledTimes(1);

    finish(plan());
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});

/* ============================================================
   Create: refusals, in words
   ============================================================ */

describe('CoopPlanForm: create refusals', () => {
  async function submitCreate() {
    const user = userEvent.setup();
    renderForm();
    await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
    await user.click(saveButton());
    return await screen.findByRole('alert');
  }

  it('409 ACTIVE_PLAN_EXISTS: tells the student to open the plan they already have', async () => {
    createCoopPlanMock.mockRejectedValue(new CoopPlanApiError('conflict', 409, 'ACTIVE_PLAN_EXISTS'));

    expect(await submitCreate()).toHaveTextContent(/มีแผนที่ยังดำเนินการอยู่ในรอบนี้แล้ว/);
    // Still a create form: nothing was made.
    expect(screen.getByRole('heading', { name: 'สร้างแผนสหกิจศึกษาใหม่' })).toBeInTheDocument();
  });

  it('403: says the account may not do this, not that something broke', async () => {
    createCoopPlanMock.mockRejectedValue(new CoopPlanApiError('forbidden', 403, 'FORBIDDEN'));

    expect(await submitCreate()).toHaveTextContent(/ไม่มีสิทธิ์ทำรายการนี้/);
  });

  it('401: asks the student to sign in again and says nothing was saved', async () => {
    createCoopPlanMock.mockRejectedValue(new CoopPlanApiError('unauthorized', 401, 'UNAUTHORIZED'));

    const alert = await submitCreate();
    expect(alert).toHaveTextContent(/เข้าสู่ระบบอีกครั้ง/);
    expect(alert).toHaveTextContent(/ยังไม่ถูกบันทึก/);
  });

  it('404 PERIOD_NOT_FOUND and POSITION_NOT_FOUND each name what is missing', async () => {
    createCoopPlanMock.mockRejectedValueOnce(new CoopPlanApiError('nf', 404, 'PERIOD_NOT_FOUND'));
    expect(await submitCreate()).toHaveTextContent(/ไม่พบรอบสหกิจ/);
  });

  it('a network failure gets the generic message, and the typed values survive it', async () => {
    createCoopPlanMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    renderForm();

    await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), 'do not lose me');
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/บันทึกไม่สำเร็จ/);
    expect(screen.getByLabelText(/หมายเหตุจากนักศึกษา/)).toHaveValue('do not lose me');
    expect(saveButton()).toBeEnabled();
  });

  it("never shows the API's own English wording", async () => {
    createCoopPlanMock.mockRejectedValue(
      new CoopPlanApiError('Failed to create coop plan: Forbidden', 403, 'FORBIDDEN'),
    );

    const alert = await submitCreate();
    expect(alert).not.toHaveTextContent(/Failed to create/);
    expect(alert).not.toHaveTextContent(/Forbidden/);
  });
});

/* ============================================================
   Edit
   ============================================================ */

describe('CoopPlanForm: edit', () => {
  it('opens with what was saved: note, position, checkboxes, read-only period', async () => {
    const saved = plan({
      student_note: 'my saved note',
      position_id: 'POS013',
      position_title: 'Java Developer',
      acknowledged_pre_course: true,
      terms_accepted_at: '2026-10-01T09:00:00.000Z',
    });
    renderForm({ plan: saved });

    expect(screen.getByRole('heading', { name: 'แก้ไขแผนสหกิจศึกษา' })).toBeInTheDocument();
    expect(screen.getByLabelText(/หมายเหตุจากนักศึกษา/)).toHaveValue('my saved note');
    expect(screen.getByLabelText(/รับทราบและผ่านเงื่อนไข/)).toBeChecked();
    expect(screen.getByLabelText(/ยอมรับข้อกำหนดและเงื่อนไข/)).toBeChecked();
    await waitFor(() => expect(screen.getByLabelText(/ตำแหน่งงาน/)).toHaveValue('POS013'));
    // The period is shown (in the heading line and as a read-only row) but is
    // not a field.
    expect(screen.queryByLabelText(/รอบสหกิจศึกษา/)).not.toBeInTheDocument();
    expect(screen.getByText('รอบสหกิจศึกษา')).toBeInTheDocument();
    expect(screen.getAllByText(/ภาคการศึกษาที่ 1\/2568/)).toHaveLength(2);
    // Editing never needs the period list.
    expect(getPeriodTimelineMock).not.toHaveBeenCalled();
  });

  it('keeps the saved position selectable even when it is no longer in the period list', async () => {
    getPositionsMock.mockResolvedValue([CLOSED_POSITION]);
    renderForm({ plan: plan({ position_id: 'POS999', position_title: 'Retired Role' }) });

    expect(await screen.findByRole('option', { name: 'Retired Role' })).toBeInTheDocument();
    expect(screen.getByLabelText(/ตำแหน่งงาน/)).toHaveValue('POS999');
  });

  it('cannot be saved until something changes', async () => {
    const user = userEvent.setup();
    renderForm({ plan: plan({ student_note: 'saved' }) });

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText('ยังไม่มีการเปลี่ยนแปลง')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), '!');
    expect(saveButton()).toBeEnabled();

    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), '{Backspace}');
    expect(saveButton()).toBeDisabled();
  });

  it('sends only the field that changed, then confirms and resets what counts as changed', async () => {
    updateCoopPlanMock.mockResolvedValue(plan({ student_note: 'saved!' }));
    const user = userEvent.setup();
    const { onSaved } = renderForm({ plan: plan({ student_note: 'saved' }) });

    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), '!');
    await user.click(saveButton());

    await waitFor(() => expect(updateCoopPlanMock).toHaveBeenCalledTimes(1));
    expect(updateCoopPlanMock).toHaveBeenCalledWith(7, { studentNote: 'saved!' }, 'a-token');
    expect(createCoopPlanMock).not.toHaveBeenCalled();

    expect(await screen.findByRole('status')).toHaveTextContent(/บันทึกร่างเรียบร้อยแล้ว/);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ student_note: 'saved!' }));
    expect(saveButton()).toBeDisabled();
  });

  it('shows what the database returned, not what was typed', async () => {
    // The API trims a position id, normalises a blank note, etc. The form
    // reflects the saved row so what is on screen is what is stored.
    updateCoopPlanMock.mockResolvedValue(plan({ student_note: 'server version' }));
    const user = userEvent.setup();
    renderForm({ plan: plan() });

    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), 'typed version');
    await user.click(saveButton());

    await waitFor(() =>
      expect(screen.getByLabelText(/หมายเหตุจากนักศึกษา/)).toHaveValue('server version'),
    );
  });

  it('clearing the note sends null', async () => {
    updateCoopPlanMock.mockResolvedValue(plan({ student_note: null }));
    const user = userEvent.setup();
    renderForm({ plan: plan({ student_note: 'to be removed' }) });

    await user.clear(screen.getByLabelText(/หมายเหตุจากนักศึกษา/));
    await user.click(saveButton());

    await waitFor(() => expect(updateCoopPlanMock).toHaveBeenCalled());
    expect(updateCoopPlanMock.mock.calls[0][1]).toEqual({ studentNote: null });
  });

  it('a note of only spaces counts as no note: nothing to save', async () => {
    const user = userEvent.setup();
    renderForm({ plan: plan({ student_note: null }) });

    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), '   ');

    expect(saveButton()).toBeDisabled();
  });

  it('clearing the position sends null', async () => {
    updateCoopPlanMock.mockResolvedValue(plan({ position_id: null }));
    const user = userEvent.setup();
    renderForm({ plan: plan({ position_id: 'POS013', position_title: 'Java Developer' }) });

    await waitFor(() => expect(screen.getByLabelText(/ตำแหน่งงาน/)).toHaveValue('POS013'));
    await user.selectOptions(screen.getByLabelText(/ตำแหน่งงาน/), '');
    await user.click(saveButton());

    await waitFor(() => expect(updateCoopPlanMock).toHaveBeenCalled());
    expect(updateCoopPlanMock.mock.calls[0][1]).toEqual({ positionId: null });
  });

  it('a draft may withdraw its acknowledgements: unchecking sends false', async () => {
    updateCoopPlanMock.mockResolvedValue(plan());
    const user = userEvent.setup();
    renderForm({
      plan: plan({ acknowledged_pre_course: true, terms_accepted_at: '2026-10-01T09:00:00.000Z' }),
    });

    await user.click(screen.getByLabelText(/รับทราบและผ่านเงื่อนไข/));
    await user.click(screen.getByLabelText(/ยอมรับข้อกำหนดและเงื่อนไข/));
    await user.click(saveButton());

    await waitFor(() => expect(updateCoopPlanMock).toHaveBeenCalled());
    expect(updateCoopPlanMock.mock.calls[0][1]).toEqual({
      acknowledgedPreCourse: false,
      termsAccepted: false,
    });
  });

  it('refuses a note over the limit and does not send it', async () => {
    const user = userEvent.setup();
    renderForm({ plan: plan({ student_note: 'x'.repeat(2000) }) });

    // maxLength stops typing past the limit, so the counter is the guard here.
    expect(screen.getByText('2000/2000 ตัวอักษร')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), 'y');
    expect(screen.getByLabelText(/หมายเหตุจากนักศึกษา/)).toHaveValue('x'.repeat(2000));
    expect(saveButton()).toBeDisabled();
  });
});

/* ============================================================
   Edit: a returned plan
   ============================================================ */

describe('CoopPlanForm: a returned plan', () => {
  it('shows the reviewer comment above the fields', () => {
    renderForm({ plan: RETURNED });

    const comment = screen.getByRole('region', { name: 'ความเห็นจากผู้พิจารณา' });
    expect(comment).toHaveTextContent('กรุณาระบุขอบเขตงานให้ชัดเจน');
    expect(comment).toHaveTextContent('อ.ที่ปรึกษา');
  });

  it('can be edited, and says it is still returned and not submitted', async () => {
    updateCoopPlanMock.mockResolvedValue({ ...RETURNED, student_note: 'second version' });
    const user = userEvent.setup();
    renderForm({ plan: RETURNED });

    await user.clear(screen.getByLabelText(/หมายเหตุจากนักศึกษา/));
    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), 'second version');
    await user.click(saveButton());

    await waitFor(() => expect(updateCoopPlanMock).toHaveBeenCalled());
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/แผนยังอยู่ในสถานะส่งกลับแก้ไข/);
    expect(status).toHaveTextContent(/ยังไม่ถูกยื่น/);
  });

  it('sends only the note: the locked acknowledgements are never re-sent', async () => {
    updateCoopPlanMock.mockResolvedValue({ ...RETURNED, student_note: 'second version' });
    const user = userEvent.setup();
    renderForm({ plan: RETURNED });

    await user.clear(screen.getByLabelText(/หมายเหตุจากนักศึกษา/));
    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), 'second version');
    await user.click(saveButton());

    await waitFor(() => expect(updateCoopPlanMock).toHaveBeenCalled());
    expect(updateCoopPlanMock.mock.calls[0][1]).toEqual({ studentNote: 'second version' });
  });

  it('locks both acknowledgements, because a submitted plan cannot withdraw them', () => {
    renderForm({ plan: RETURNED });

    expect(screen.getByLabelText(/รับทราบและผ่านเงื่อนไข/)).toBeDisabled();
    expect(screen.getByLabelText(/รับทราบและผ่านเงื่อนไข/)).toBeChecked();
    expect(screen.getByLabelText(/ยอมรับข้อกำหนดและเงื่อนไข/)).toBeDisabled();
    expect(screen.getByLabelText(/ยอมรับข้อกำหนดและเงื่อนไข/)).toBeChecked();
    expect(screen.getByText(/ถอนไม่ได้/)).toBeInTheDocument();
  });

  it('a draft that was never submitted does not show the reviewer panel or lock anything', () => {
    renderForm({ plan: plan() });

    expect(screen.queryByRole('region', { name: 'ความเห็นจากผู้พิจารณา' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/รับทราบและผ่านเงื่อนไข/)).toBeEnabled();
    expect(screen.getByLabelText(/ยอมรับข้อกำหนดและเงื่อนไข/)).toBeEnabled();
  });
});

/* ============================================================
   Edit: statuses that cannot be edited
   ============================================================ */

describe('CoopPlanForm: a plan that cannot be edited', () => {
  it.each(['SUBMITTED', 'APPROVED', 'REJECTED'] as CoopPlanStatus[])(
    'shows a %s plan as locked: no fields and no save button',
    (status) => {
      renderForm({ plan: plan({ status }) });

      expect(screen.getByRole('alert')).toHaveTextContent(/แก้ไขไม่ได้/);
      expect(screen.queryByRole('button', { name: /บันทึกร่าง/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/หมายเหตุจากนักศึกษา/)).not.toBeInTheDocument();
    },
  );
});

/* ============================================================
   Edit: refusals, in words
   ============================================================ */

describe('CoopPlanForm: edit refusals', () => {
  async function submitEdit(error: unknown) {
    updateCoopPlanMock.mockRejectedValue(error);
    const user = userEvent.setup();
    renderForm({ plan: plan({ student_note: 'saved' }) });

    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), ' more');
    await user.click(saveButton());
    return await screen.findByRole('alert');
  }

  it('409 PLAN_NOT_EDITABLE: the status changed under the student, nothing was saved', async () => {
    const alert = await submitEdit(new CoopPlanApiError('c', 409, 'PLAN_NOT_EDITABLE'));

    expect(alert).toHaveTextContent(/แก้ไขไม่ได้/);
    expect(alert).toHaveTextContent(/ไม่มีการบันทึก/);
  });

  it('403: someone else’s plan', async () => {
    const alert = await submitEdit(new CoopPlanApiError('f', 403, 'FORBIDDEN'));

    expect(alert).toHaveTextContent(/ไม่มีสิทธิ์ทำรายการนี้/);
    expect(alert).toHaveTextContent(/เจ้าของแผน/);
  });

  it('404: the plan is gone', async () => {
    const alert = await submitEdit(new CoopPlanApiError('n', 404, 'PLAN_NOT_FOUND'));

    expect(alert).toHaveTextContent(/ไม่พบแผนนี้/);
  });

  it('404 POSITION_NOT_FOUND: the chosen position no longer exists', async () => {
    const alert = await submitEdit(new CoopPlanApiError('n', 404, 'POSITION_NOT_FOUND'));

    expect(alert).toHaveTextContent(/ไม่พบตำแหน่งที่เลือก/);
  });

  it('400 SUBMISSION_FIELDS_LOCKED is explained', async () => {
    const alert = await submitEdit(new CoopPlanApiError('b', 400, 'SUBMISSION_FIELDS_LOCKED'));

    expect(alert).toHaveTextContent(/ไม่สามารถถอนการยอมรับเงื่อนไขได้/);
  });

  it('keeps what the student typed after any refusal, so they can copy it out', async () => {
    await submitEdit(new CoopPlanApiError('c', 409, 'PLAN_NOT_EDITABLE'));

    expect(screen.getByLabelText(/หมายเหตุจากนักศึกษา/)).toHaveValue('saved more');
  });

  it('a network failure gets the generic message', async () => {
    const alert = await submitEdit(new TypeError('Failed to fetch'));

    expect(alert).toHaveTextContent(/บันทึกไม่สำเร็จ/);
  });

  it('the success message goes away as soon as the student edits again', async () => {
    updateCoopPlanMock.mockResolvedValue(plan({ student_note: 'saved more' }));
    const user = userEvent.setup();
    renderForm({ plan: plan({ student_note: 'saved' }) });

    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), ' more');
    await user.click(saveButton());
    expect(await screen.findByRole('status')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), '!');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

/* ============================================================
   Leaving
   ============================================================ */

describe('CoopPlanForm: leaving with unsaved edits', () => {
  it('goes straight back when nothing changed', async () => {
    const user = userEvent.setup();
    const { onBack } = renderForm({ plan: plan() });

    await user.click(screen.getByRole('button', { name: /กลับรายละเอียดแผน/ }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('asks first when there are unsaved edits, and stays if told to', async () => {
    const user = userEvent.setup();
    const { onBack } = renderForm({ plan: plan() });

    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), 'draft');
    await user.click(screen.getByRole('button', { name: /กลับรายละเอียดแผน/ }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'กลับไปแก้ไขต่อ' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/หมายเหตุจากนักศึกษา/)).toHaveValue('draft');
  });

  it('leaves without saving when the student confirms', async () => {
    const user = userEvent.setup();
    const { onBack } = renderForm({ plan: plan() });

    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), 'draft');
    await user.click(screen.getByRole('button', { name: /กลับรายละเอียดแผน/ }));
    await user.click(screen.getByRole('button', { name: 'ออกโดยไม่บันทึก' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(updateCoopPlanMock).not.toHaveBeenCalled();
  });

  it('in create mode, an untouched form leaves immediately', async () => {
    const user = userEvent.setup();
    const { onBack } = renderForm();

    await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
    await user.click(screen.getByRole('button', { name: /กลับรายการคำร้อง/ }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('in create mode, typing something makes leaving ask first', async () => {
    const user = userEvent.setup();
    const { onBack } = renderForm();

    await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
    await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), 'x');
    await user.click(screen.getByRole('button', { name: /กลับรายการคำร้อง/ }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });
});