import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { CoopPlan, CoopPlanStatus } from '../types/coopPlan';

const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: useAuthMock }));

const getCoopPlansMock = vi.fn();
const getCoopPlanMock = vi.fn();
const createCoopPlanMock = vi.fn();
const updateCoopPlanMock = vi.fn();
const submitCoopPlanMock = vi.fn();

vi.mock('../data/coopPlanApi', async () => {
  const actual = await vi.importActual<typeof import('../data/coopPlanApi')>(
    '../data/coopPlanApi',
  );
  return {
    ...actual,
    getCoopPlans: getCoopPlansMock,
    getCoopPlan: getCoopPlanMock,
    createCoopPlan: createCoopPlanMock,
    updateCoopPlan: updateCoopPlanMock,
    submitCoopPlan: submitCoopPlanMock,
  };
});

// The create/edit form loads these when it opens.
const getPeriodTimelineMock = vi.fn();
vi.mock('../data/periodAPI', () => ({ getPeriodTimeline: getPeriodTimelineMock }));

const getPositionsMock = vi.fn();
vi.mock('../data/positionApi', () => ({ getPositions: getPositionsMock }));

// These tests cover coop plans, not attachment API requests.
const listPlanAttachmentsMock = vi.fn().mockResolvedValue({
  attachments: [],
  maxFiles: 1,
  maxBytes: 5 * 1024 * 1024,
});

vi.mock('../data/attachmentApi', async () => {
  const actual = await vi.importActual<typeof import('../data/attachmentApi')>(
    '../data/attachmentApi',
  );

  return {
    ...actual,
    listPlanAttachments: listPlanAttachmentsMock,
  };
});

const { CoopPlanApiError } = await import('../data/coopPlanApi');
const { default: CoopPlans } = await import('./CoopPlans');

const PLAN = {
  plan_id: 1,
  student_id: '6600000001',
  first_name: 'บีบี',
  last_name: 'น้ำทิพย์',
  curriculum: '66',
  period_id: 1,
  period_name: 'ภาคการศึกษาที่ 1/2568',
  position_id: 1,
  position_name: 'Java Developer',
  company_name: 'บริษัท คิวบ์ ซอฟท์เทค จำกัด',
  status: 'PREPARING',
  submitted_at: '2568-05-21',
  reviewer_name: null,
  reviewed_at: null,
  review_comment: null,
};

function signedIn(role: string | null = 'STAFF') {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
    role,
    getIdToken: async () => 'a-token',
  });
}

function signedOut() {
  useAuthMock.mockReturnValue({
    status: 'anonymous',
    getIdToken: async () => null,
  });
}

describe('CoopPlans and the signed-in session', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    getCoopPlansMock.mockReset();
    getCoopPlanMock.mockReset();
    submitCoopPlanMock.mockReset();
  });

  it('loads the plans the signed-in caller may see', async () => {
    signedIn();
    getCoopPlansMock.mockResolvedValue([PLAN]);

    render(<CoopPlans />);

    expect(await screen.findByText('6600000001')).toBeInTheDocument();
  });

  it('reloads when the session changes, so signing out drops the previous caller rows', async () => {
    // The page keeps whatever it fetched in component state. Without the auth
    // status in the effect's dependencies, signing out leaves the previous
    // user's plans on screen until something else happens to re-render — one
    // person's data shown to whoever is at the keyboard next.
    signedIn();
    getCoopPlansMock.mockResolvedValue([PLAN]);

    const { rerender } = render(<CoopPlans />);
    expect(await screen.findByText('6600000001')).toBeInTheDocument();

    signedOut();
    getCoopPlansMock.mockRejectedValue(new Error('Unauthorized'));
    rerender(<CoopPlans />);

    await waitFor(() => {
      expect(getCoopPlansMock).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText('6600000001')).not.toBeInTheDocument();
  });

  it('reloads when a visitor signs in, so the list fills without changing page', async () => {
    // The mirror image: sitting on this page while signing in should produce
    // the caller's plans, not leave the refusal from a moment ago on screen.
    signedOut();
    getCoopPlansMock.mockRejectedValue(new Error('Unauthorized'));

    const { rerender } = render(<CoopPlans />);
    await waitFor(() => {
      expect(getCoopPlansMock).toHaveBeenCalledTimes(1);
    });

    signedIn();
    getCoopPlansMock.mockResolvedValue([PLAN]);
    rerender(<CoopPlans />);

    expect(await screen.findByText('6600000001')).toBeInTheDocument();
  });
});

describe('CoopPlans says why the list is empty', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    getCoopPlansMock.mockReset();
    getCoopPlanMock.mockReset();
  });

  it('asks a signed-out caller to sign in, with no retry button', async () => {
    // Retrying a 401 can only fail again. The answer is to sign in, so that
    // is what the page says, and the button that cannot help is not offered.
    signedOut();
    getCoopPlansMock.mockRejectedValue(new CoopPlanApiError('no token', 401));

    render(<CoopPlans />);

    expect(await screen.findByText(/ลงชื่อเข้าใช้เพื่อดูแผนสหกิจ/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ลองอีกครั้ง/ })).not.toBeInTheDocument();
  });

  it('tells a signed-in caller without permission that the account lacks it', async () => {
    // What an ADMIN sees: the token is fine, the account simply has no plan
    // access. "Failed to fetch" would send them to debug a network problem
    // that does not exist.
    signedIn();
    getCoopPlansMock.mockRejectedValue(new CoopPlanApiError('forbidden', 403));

    render(<CoopPlans />);

    expect(await screen.findByText(/ไม่มีสิทธิ์เข้าถึงแผนสหกิจ/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ลองอีกครั้ง/ })).not.toBeInTheDocument();
  });

  it('offers a retry when the request actually failed', async () => {
    signedIn();
    getCoopPlansMock.mockRejectedValue(new Error('network down'));

    render(<CoopPlans />);

    expect(await screen.findByText(/ไม่สามารถโหลดข้อมูลได้/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ลองอีกครั้ง/ })).toBeInTheDocument();
  });

  it('does not leak the raw API message into the page', async () => {
    signedIn();
    getCoopPlansMock.mockRejectedValue(
      new CoopPlanApiError('Failed to fetch coop plans: Forbidden', 403),
    );

    render(<CoopPlans />);

    await screen.findByText(/ไม่มีสิทธิ์เข้าถึงแผนสหกิจ/);
    expect(screen.queryByText(/Failed to fetch coop plans/)).not.toBeInTheDocument();
  });
});

describe('CoopPlans Reviewer Dashboard and Plan Detail Modal (Issue #107)', () => {
  const SUBMITTED_PLAN = {
    plan_id: 10,
    student_id: '6609600001',
    first_name: 'สมใจ',
    last_name: 'รักเรียน',
    curriculum: '66',
    period_id: 'P2568-1',
    period_name: 'ปีการศึกษา 2568/1',
    position_id: 'POS-01',
    position_title: 'Software Engineer Intern',
    company_id: 'COMP-01',
    company_name: 'Agoda Services Co., Ltd.',
    company_short_name: 'Agoda',
    status: 'SUBMITTED',
    gpa: 3.85,
    advisor_name: 'อ.สมชาย ใจดี',
    submitted_at: '2026-05-20T10:00:00Z',
    terms_accepted_at: '2026-05-20T09:30:00Z',
    acknowledged_pre_course: true,
    student_note: 'สนใจด้าน Backend และ Distributed Systems',
    reviewer_name: null,
    reviewed_at: null,
    review_comment: null,
  };

  const APPROVED_PLAN = {
    plan_id: 11,
    student_id: '6109600002',
    first_name: 'วิภา',
    last_name: 'มีสุข',
    curriculum: '61',
    period_id: 'P2568-1',
    period_name: 'ปีการศึกษา 2568/1',
    position_id: 'POS-02',
    position_title: 'Data Analyst Intern',
    company_id: 'COMP-02',
    company_name: 'LINE Company (Thailand)',
    company_short_name: 'LINE',
    status: 'APPROVED',
    gpa: 3.5,
    advisor_name: 'อ.สมชาย ใจดี',
    submitted_at: '2026-05-18T08:00:00Z',
    terms_accepted_at: '2026-05-18T07:45:00Z',
    acknowledged_pre_course: true,
    student_note: null,
    reviewer_name: 'อ.สมชาย ใจดี',
    reviewed_at: '2026-05-19T14:00:00Z',
    review_comment: 'คุณสมบัติและวิชาเรียนครบถ้วน อนุมัติแผน',
  };

  beforeEach(() => {
    useAuthMock.mockReset();
    getCoopPlansMock.mockReset();
    getCoopPlanMock.mockReset();
    signedIn();
  });

  it('renders progress chart, status filter tabs, and counts', async () => {
    getCoopPlansMock.mockResolvedValue([SUBMITTED_PLAN, APPROVED_PLAN]);

    render(<CoopPlans />);

    expect(await screen.findByText('6609600001')).toBeInTheDocument();
    expect(screen.getByText('6109600002')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /แผนสหกิจศึกษาและการพิจารณา/,
    );
    expect(screen.getByRole('button', { name: /รอตรวจ/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /อนุมัติแล้ว/i })).toBeInTheDocument();
  });

  it('filters plans by status tab', async () => {
    getCoopPlansMock.mockResolvedValue([SUBMITTED_PLAN, APPROVED_PLAN]);

    render(<CoopPlans />);

    expect(await screen.findByText('6609600001')).toBeInTheDocument();
    expect(screen.getByText('6109600002')).toBeInTheDocument();

    // Click 'รอตรวจ' tab
    const submittedTab = screen.getByRole('button', { name: /รอตรวจ/i });
    fireEvent.click(submittedTab);

    expect(screen.getByText('6609600001')).toBeInTheDocument();
    expect(screen.queryByText('6109600002')).not.toBeInTheDocument();

    // Click 'อนุมัติแล้ว' tab
    const approvedTab = screen.getByRole('button', { name: /อนุมัติแล้ว/i });
    fireEvent.click(approvedTab);

    expect(screen.queryByText('6609600001')).not.toBeInTheDocument();
    expect(screen.getByText('6109600002')).toBeInTheDocument();
  });

  it('opens and closes plan detail modal when clicking a plan row', async () => {
    getCoopPlansMock.mockResolvedValue([SUBMITTED_PLAN]);
    getCoopPlanMock.mockResolvedValue(SUBMITTED_PLAN);

    render(<CoopPlans />);

    expect(await screen.findByText('6609600001')).toBeInTheDocument();

    // Click row or examine button
    const examineBtn = screen.getByRole('button', { name: /ตรวจแผน/i });
    fireEvent.click(examineBtn);

    // Verify modal is open and shows details
    const modal = await screen.findByRole('dialog');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByText(/ตรวจและพิจารณาแผนสหกิจศึกษา/i)).toBeInTheDocument();
    expect(within(modal).getByText('Software Engineer Intern')).toBeInTheDocument();
    expect(within(modal).getByText(/สนใจด้าน Backend และ Distributed Systems/)).toBeInTheDocument();
    expect(within(modal).getByText(/บันทึกผลการพิจารณา \(สำหรับผู้ตรวจ\)/)).toBeInTheDocument();

    // Close modal via Cancel button
    const cancelBtn = within(modal).getByRole('button', { name: /ยกเลิก/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it.each([['STUDENT'], [null]])('role %s: no review button, no review form (D9)', async (role) => {
    signedIn(role);
    getCoopPlansMock.mockResolvedValue([SUBMITTED_PLAN]);
    getCoopPlanMock.mockResolvedValue(SUBMITTED_PLAN);

    render(<CoopPlans />);

    expect(await screen.findByText('6609600001')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ตรวจแผน/ })).not.toBeInTheDocument();

    // The row still opens, read-only: the plan page offers no review action.
    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียด/ }));
    expect(await screen.findByText('Software Engineer Intern')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ตรวจพิจารณาแผน/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([['ADVISOR'], ['STAFF']])('role %s: sees the review button', async (role) => {
    signedIn(role);
    getCoopPlansMock.mockResolvedValue([SUBMITTED_PLAN]);

    render(<CoopPlans />);

    expect(await screen.findByRole('button', { name: /ตรวจแผน/ })).toBeInTheDocument();
  });

  it('switches view mode between table and cards view', async () => {
    getCoopPlansMock.mockResolvedValue([SUBMITTED_PLAN]);

    render(<CoopPlans />);

    expect(await screen.findByText('6609600001')).toBeInTheDocument();

    // Switch to cards view
    const cardsBtn = screen.getByRole('button', { name: /การ์ด/i });
    fireEvent.click(cardsBtn);

    // Still renders the student in card format
    expect(screen.getByText('6609600001')).toBeInTheDocument();

    // Switch back to table view
    const tableBtn = screen.getByRole('button', { name: /ตาราง/i });
    fireEvent.click(tableBtn);

    expect(screen.getByText('6609600001')).toBeInTheDocument();
  });
});

/* ============================================================
   V3-04.1: create and edit from the list and the detail page
   ============================================================ */

function fullPlan(overrides: Partial<CoopPlan> = {}): CoopPlan {
  return {
    plan_id: 7,
    student_id: '6600000001',
    period_id: 'P2568-1',
    position_id: null,
    status: 'PREPARING',
    acknowledged_pre_course: false,
    terms_accepted_at: null,
    student_note: 'old note',
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

const ACTIVE_PERIOD = {
  period_id: 'P2568-1',
  name: 'ภาคการศึกษาที่ 1/2568',
  academic_year: 2568,
  semester: '1',
  is_active: true,
};

// Lists one plan, serves it as the detail, and opens the detail page.
async function openDetail(plan: CoopPlan) {
  getCoopPlansMock.mockResolvedValue([plan]);
  getCoopPlanMock.mockResolvedValue(plan);
  const user = userEvent.setup();

  render(<CoopPlans />);
  await user.click(await screen.findByText(plan.student_id));
  await screen.findByRole('heading', { name: 'รายละเอียดแผนสหกิจ' });
  return user;
}

describe('CoopPlans: create and edit', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    getCoopPlansMock.mockReset();
    getCoopPlanMock.mockReset();
    createCoopPlanMock.mockReset();
    updateCoopPlanMock.mockReset();
    getPeriodTimelineMock.mockReset();
    getPositionsMock.mockReset();

    signedIn();
    getPeriodTimelineMock.mockResolvedValue({
      period: ACTIVE_PERIOD,
      all_periods: [ACTIVE_PERIOD],
      schedules: [],
    });
    getPositionsMock.mockResolvedValue([]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('the create button', () => {
    it('is offered to a signed-in caller', async () => {
      getCoopPlansMock.mockResolvedValue([]);

      render(<CoopPlans />);

      expect(await screen.findByRole('button', { name: /สร้างแผนใหม่/ })).toBeInTheDocument();
    });

    it('is not offered to a signed-out visitor', async () => {
      signedOut();
      getCoopPlansMock.mockRejectedValue(new CoopPlanApiError('no token', 401));

      render(<CoopPlans />);

      await screen.findByText(/ลงชื่อเข้าใช้เพื่อดูแผนสหกิจ/);
      expect(screen.queryByRole('button', { name: /สร้างแผนใหม่/ })).not.toBeInTheDocument();
    });

    it('is withdrawn when the list is refused with 403: an account with no plan role cannot create either', async () => {
      getCoopPlansMock.mockRejectedValue(new CoopPlanApiError('forbidden', 403));

      render(<CoopPlans />);

      await screen.findByText(/ไม่มีสิทธิ์เข้าถึงแผนสหกิจ/);
      expect(screen.queryByRole('button', { name: /สร้างแผนใหม่/ })).not.toBeInTheDocument();
    });

    it('stays after a plain network failure, which says nothing about permission', async () => {
      getCoopPlansMock.mockRejectedValue(new Error('network down'));

      render(<CoopPlans />);

      await screen.findByText(/ไม่สามารถโหลดข้อมูลได้/);
      expect(screen.getByRole('button', { name: /สร้างแผนใหม่/ })).toBeInTheDocument();
    });
  });

  describe('creating a plan', () => {
    it('opens the form, saves a draft, and shows the new plan on the way back', async () => {
      const created = fullPlan({ student_note: null });
      getCoopPlansMock.mockResolvedValueOnce([]).mockResolvedValue([created]);
      createCoopPlanMock.mockResolvedValue(created);
      const user = userEvent.setup();

      render(<CoopPlans />);
      await user.click(await screen.findByRole('button', { name: /สร้างแผนใหม่/ }));

      expect(await screen.findByRole('heading', { name: 'สร้างแผนสหกิจศึกษาใหม่' })).toBeInTheDocument();
      await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
      await user.click(screen.getByRole('button', { name: /บันทึกร่าง/ }));
      expect(await screen.findByRole('status')).toHaveTextContent(/บันทึกร่างเรียบร้อยแล้ว/);

      // Back from the form lands on the plan that was just saved...
      await user.click(screen.getByRole('button', { name: /กลับรายละเอียดแผน/ }));
      expect(await screen.findByRole('heading', { name: 'รายละเอียดแผนสหกิจ' })).toBeInTheDocument();
      expect(screen.getByText(/Plan #7/)).toBeInTheDocument();

      // ...and the list behind it was reloaded, so it has the new row.
      await user.click(screen.getByRole('button', { name: /กลับรายการคำร้อง/ }));
      expect(await screen.findByText('6600000001')).toBeInTheDocument();
      expect(getCoopPlansMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('goes back to the list, not a detail page, when nothing was saved', async () => {
      getCoopPlansMock.mockResolvedValue([]);
      const user = userEvent.setup();

      render(<CoopPlans />);
      await user.click(await screen.findByRole('button', { name: /สร้างแผนใหม่/ }));
      await waitFor(() => expect(screen.getByLabelText(/รอบสหกิจศึกษา/)).toHaveValue('P2568-1'));
      await user.click(screen.getByRole('button', { name: /กลับรายการคำร้อง/ }));

      expect(await screen.findByRole('heading', { name: /รายการคำร้องแผนสหกิจศึกษา/ })).toBeInTheDocument();
      expect(createCoopPlanMock).not.toHaveBeenCalled();
    });
  });

  describe('editing a plan', () => {
    it.each(['PREPARING', 'RETURNED'] as CoopPlanStatus[])(
      'offers Edit on a %s plan and opens the form with the saved data',
      async (status) => {
        const user = await openDetail(
          fullPlan({
            status,
            student_note: 'saved note',
            ...(status === 'RETURNED'
              ? {
                  acknowledged_pre_course: true,
                  terms_accepted_at: '2026-09-20T09:00:00.000Z',
                  review_comment: 'please fix',
                }
              : {}),
          }),
        );

        await user.click(screen.getByRole('button', { name: 'แก้ไขแผน' }));

        expect(await screen.findByRole('heading', { name: 'แก้ไขแผนสหกิจศึกษา' })).toBeInTheDocument();
        expect(screen.getByLabelText(/หมายเหตุจากนักศึกษา/)).toHaveValue('saved note');
      },
    );

    it.each([
      ['SUBMITTED', /ยื่นแล้วจึงแก้ไขไม่ได้/],
      ['APPROVED', /ได้รับอนุมัติแล้ว แก้ไขไม่ได้/],
      ['REJECTED', /ไม่ได้รับอนุมัติ แก้ไขไม่ได้/],
    ] as [CoopPlanStatus, RegExp][])(
      'offers no Edit on a %s plan, and says why',
      async (status, reason) => {
        await openDetail(
          fullPlan({
            status,
            acknowledged_pre_course: true,
            terms_accepted_at: '2026-09-20T09:00:00.000Z',
            submitted_at: '2026-09-20T09:00:00.000Z',
            ...(status === 'SUBMITTED'
              ? {}
              : { reviewer_name: 'อ.ที่ปรึกษา', reviewed_at: '2026-09-25T09:00:00.000Z', review_comment: 'x' }),
          }),
        );

        expect(screen.queryByRole('button', { name: 'แก้ไขแผน' })).not.toBeInTheDocument();
        expect(screen.getByText(reason)).toBeInTheDocument();
      },
    );

    it('says Edit is for the plan’s owner, since an advisor can read a draft too', async () => {
      await openDetail(fullPlan());

      expect(screen.getByText('แก้ไขได้เฉพาะนักศึกษาเจ้าของแผน')).toBeInTheDocument();
    });

    it('saves, and the detail page then shows what the API returned', async () => {
      const user = await openDetail(fullPlan({ student_note: 'old note' }));
      updateCoopPlanMock.mockResolvedValue(fullPlan({ student_note: 'new note from the database' }));

      await user.click(screen.getByRole('button', { name: 'แก้ไขแผน' }));
      await user.clear(await screen.findByLabelText(/หมายเหตุจากนักศึกษา/));
      await user.type(screen.getByLabelText(/หมายเหตุจากนักศึกษา/), 'whatever was typed');
      await user.click(screen.getByRole('button', { name: /บันทึกร่าง/ }));
      await screen.findByRole('status');

      await user.click(screen.getByRole('button', { name: /กลับรายละเอียดแผน/ }));

      expect(await screen.findByText('new note from the database')).toBeInTheDocument();
      expect(screen.queryByText('whatever was typed')).not.toBeInTheDocument();
      expect(updateCoopPlanMock).toHaveBeenCalledWith(7, { studentNote: 'whatever was typed' }, 'a-token');
    });

    it('leaving the form without saving shows the plan unchanged', async () => {
      const user = await openDetail(fullPlan({ student_note: 'old note' }));

      await user.click(screen.getByRole('button', { name: 'แก้ไขแผน' }));
      await user.type(await screen.findByLabelText(/หมายเหตุจากนักศึกษา/), ' unsaved');
      await user.click(screen.getByRole('button', { name: /กลับรายละเอียดแผน/ }));
      await user.click(screen.getByRole('button', { name: 'ออกโดยไม่บันทึก' }));

      expect(await screen.findByRole('heading', { name: 'รายละเอียดแผนสหกิจ' })).toBeInTheDocument();
      expect(screen.getByText('old note')).toBeInTheDocument();
      expect(updateCoopPlanMock).not.toHaveBeenCalled();
    });

    it('a refused save keeps the form open with the reason', async () => {
      const user = await openDetail(fullPlan());
      updateCoopPlanMock.mockRejectedValue(new CoopPlanApiError('forbidden', 403, 'FORBIDDEN'));

      await user.click(screen.getByRole('button', { name: 'แก้ไขแผน' }));
      await user.type(await screen.findByLabelText(/หมายเหตุจากนักศึกษา/), ' more');
      await user.click(screen.getByRole('button', { name: /บันทึกร่าง/ }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/ไม่มีสิทธิ์ทำรายการนี้/);
      expect(screen.getByRole('heading', { name: 'แก้ไขแผนสหกิจศึกษา' })).toBeInTheDocument();
    });
  });


});

  describe('submitting a plan', () => {
    beforeEach(() => {
      useAuthMock.mockReset();
      getCoopPlansMock.mockReset();
      getCoopPlanMock.mockReset();
      submitCoopPlanMock.mockReset();

      signedIn();

      getPeriodTimelineMock.mockReset();
      getPeriodTimelineMock.mockResolvedValue({
        period: ACTIVE_PERIOD,
        all_periods: [ACTIVE_PERIOD],
        schedules: [],
      });

      getPositionsMock.mockReset();
      getPositionsMock.mockResolvedValue([]);
    });
    it.each([
      ['PREPARING', 'ยื่นแผน'],
      ['RETURNED', 'ยื่นแผนอีกครั้ง'],
    ] as const)(
      'offers the submit action for %s plans',
      async (status, label) => {
        await openDetail(fullPlan({ status }));

        expect(
          screen.getByRole('button', { name: label })
        ).toBeInTheDocument();
      }
    );

    it.each(['SUBMITTED', 'APPROVED', 'REJECTED'] as const)(
      'does not offer submit for %s plans',
      async (status) => {
        await openDetail(fullPlan({ status }));

        expect(
          screen.queryByRole('button', { name: /ยื่นแผน/ })
        ).not.toBeInTheDocument();
      }
    );

    it('confirms before calling the API and shows the submitted status', async () => {
      const submitted = fullPlan({
        status: 'SUBMITTED',
        submitted_at: '2026-10-19T09:00:00.000Z',
      });

      submitCoopPlanMock.mockResolvedValue(submitted);

      const user = await openDetail(fullPlan({ status: 'PREPARING' }));

      await user.click(screen.getByRole('button', { name: 'ยื่นแผน' }));

      expect(submitCoopPlanMock).not.toHaveBeenCalled();

      await user.click(
        screen.getByRole('button', { name: 'ยืนยันยื่นแผน' })
      );

      await waitFor(() => {
        expect(submitCoopPlanMock).toHaveBeenCalledWith(7, 'a-token');
      });

      expect(await screen.findByRole('status')).toHaveTextContent(
        /ยื่นแผนสำเร็จแล้ว/
      );

      expect(screen.getByText('รอตรวจ')).toBeInTheDocument();
    });

    it('shows the server validation reason and does not claim success', async () => {
      submitCoopPlanMock.mockRejectedValue(
        new CoopPlanApiError(
          'validation failed',
          400,
          'SUBMISSION_REQUIREMENTS_NOT_MET',
          [
            { code: 'POSITION_REQUIRED' },
            { code: 'SUBMISSION_WINDOW_CLOSED' },
          ]
        )
      );

      const user = await openDetail(fullPlan({ status: 'PREPARING' }));

      await user.click(screen.getByRole('button', { name: 'ยื่นแผน' }));

      await user.click(
        screen.getByRole('button', { name: 'ยืนยันยื่นแผน' })
      );

      const alert = await screen.findByRole('alert');

      expect(alert).toHaveTextContent(
        /กรุณาเลือกตำแหน่งงานก่อนยื่นแผน/
      );

      expect(alert).toHaveTextContent(
        /ยังไม่อยู่ในช่วงเวลาที่เปิดรับยื่นแผน/
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('explains duplicate submission errors', async () => {
      submitCoopPlanMock.mockRejectedValue(
        new CoopPlanApiError(
          'already submitted',
          409,
          'ALREADY_SUBMITTED'
        )
      );

      const user = await openDetail(fullPlan({ status: 'PREPARING' }));

      await user.click(screen.getByRole('button', { name: 'ยื่นแผน' }));

      await user.click(
        screen.getByRole('button', { name: 'ยืนยันยื่นแผน' })
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        /ไม่สามารถยื่นซ้ำได้/
      );
    });
  });
