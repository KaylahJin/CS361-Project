// #189 (V4-02.1): the advisor's side of the review, end to end on the plan
// page. The API is mocked; what is checked is that the page shows the advisor
// exactly what the API returned, sends a return only with a reason, and offers
// nothing on a plan the API refused. The API's own checks are in
// infra/lambda/companies/advisorReview.test.mjs and reviewAccess.test.mjs.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: useAuthMock }));

const getCoopPlansMock = vi.fn();
const getCoopPlanMock = vi.fn();
const endorseCoopPlanMock = vi.fn();

vi.mock('../data/coopPlanApi', async () => {
  const actual = await vi.importActual<typeof import('../data/coopPlanApi')>(
    '../data/coopPlanApi',
  );
  return {
    ...actual,
    getCoopPlans: getCoopPlansMock,
    getCoopPlan: getCoopPlanMock,
    endorseCoopPlan: endorseCoopPlanMock,
  };
});

vi.mock('../data/attachmentApi', async () => {
  const actual = await vi.importActual<typeof import('../data/attachmentApi')>(
    '../data/attachmentApi',
  );
  return {
    ...actual,
    listPlanAttachments: vi.fn().mockResolvedValue({
      attachments: [],
      maxFiles: 1,
      maxBytes: 5 * 1024 * 1024,
    }),
  };
});

const { CoopPlanApiError } = await import('../data/coopPlanApi');
const { default: CoopPlans } = await import('./CoopPlans');

const BASE = {
  student_id: '6600000001',
  first_name: 'สมใจ',
  last_name: 'รักเรียน',
  curriculum: '66',
  period_id: 'P2568-1',
  period_name: 'ปีการศึกษา 2568/1',
  position_id: 'POS-01',
  position_title: 'Software Engineer Intern',
  company_id: 'COMP-01',
  company_name: 'บริษัทตัวอย่าง จำกัด',
  acknowledged_pre_course: true,
  terms_accepted_at: '2026-10-20T09:00:00Z',
  student_note: null,
  submitted_at: '2026-10-21T10:00:00Z',
  reviewer_name: null,
  reviewed_at: null,
  review_comment: null,
};

// Returned once with a reason, fixed, and sent in again: the second round.
const RESUBMITTED = {
  ...BASE,
  plan_id: 21,
  status: 'SUBMITTED',
  reviewer_name: 'advisor1@example.com',
  reviewed_at: '2026-10-22T09:00:00Z',
  review_comment: 'กรุณาแนบใบรับรองผลการเรียน',
  reviews: [
    {
      review_id: 5,
      decision: 'NOT_ENDORSED',
      comment: 'กรุณาแนบใบรับรองผลการเรียน',
      reviewed_at: '2026-10-22T09:00:00Z',
      reviewer_name: 'advisor1@example.com',
    },
  ],
};

const ENDORSED = { ...BASE, plan_id: 22, student_id: '6600000002', status: 'ENDORSED' };
const RETURNED = { ...BASE, plan_id: 23, student_id: '6600000003', status: 'RETURNED' };

function signedInAsAdvisor() {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
    role: 'ADVISOR',
    user: { email: 'advisor1@example.com' },
    getIdToken: async () => 'a-token',
  });
}

function rowOf(studentId: string) {
  const row = screen.getByText(studentId).closest('tr');
  if (!row) throw new Error(`no table row for ${studentId}`);
  return row;
}

beforeEach(() => {
  useAuthMock.mockReset();
  getCoopPlansMock.mockReset();
  getCoopPlanMock.mockReset();
  endorseCoopPlanMock.mockReset();
  signedInAsAdvisor();
});

describe('#189 the advisor sees the plans assigned to them', () => {
  it('lists the rows the API scoped to this advisor, and offers a decision only on a SUBMITTED plan', async () => {
    getCoopPlansMock.mockResolvedValue([RESUBMITTED, ENDORSED, RETURNED]);

    render(<CoopPlans />);

    expect(await screen.findByText('6600000001')).toBeInTheDocument();
    expect(getCoopPlansMock).toHaveBeenCalledWith({}, 'a-token');

    expect(within(rowOf('6600000001')).getByRole('button', { name: /ตรวจแผน/ })).toBeInTheDocument();
    // Endorsed already, or back with the student: the advisor has nothing to decide.
    for (const id of ['6600000002', '6600000003']) {
      expect(within(rowOf(id)).queryByRole('button', { name: /ตรวจแผน/ })).not.toBeInTheDocument();
      expect(within(rowOf(id)).getByRole('button', { name: /ดูรายละเอียด/ })).toBeInTheDocument();
    }
    expect(screen.getByText(/แผนทั้งหมดในความดูแล/)).toHaveTextContent('3');
  });
});

describe('#189 the plan page shows the status and comments the API returned', () => {
  it('shows a resubmitted plan as waiting, with the earlier reason and who gave it', async () => {
    getCoopPlansMock.mockResolvedValue([RESUBMITTED]);
    getCoopPlanMock.mockResolvedValue(RESUBMITTED);

    render(<CoopPlans />);
    await userEvent.click(await screen.findByText('6600000001'));

    expect(await screen.findByRole('heading', { name: 'รายละเอียดแผนสหกิจ' })).toBeInTheDocument();
    expect(screen.getByText('รอตรวจ')).toBeInTheDocument();
    expect(screen.getByText('ความคิดเห็น').nextElementSibling).toHaveTextContent(
      'กรุณาแนบใบรับรองผลการเรียน',
    );

    const history = screen.getByRole('list', { name: 'ประวัติการพิจารณา' });
    expect(within(history).getAllByRole('listitem')).toHaveLength(1);
    expect(within(history).getByText('อาจารย์ไม่รับรอง')).toBeInTheDocument();
    expect(within(history).getByText('advisor1@example.com')).toBeInTheDocument();
    expect(within(history).getByText('กรุณาแนบใบรับรองผลการเรียน')).toBeInTheDocument();
  });

  it('offers no decision on the page of a plan that is not waiting for the advisor', async () => {
    getCoopPlansMock.mockResolvedValue([ENDORSED]);
    getCoopPlanMock.mockResolvedValue(ENDORSED);

    render(<CoopPlans />);
    await userEvent.click(await screen.findByRole('button', { name: /ดูรายละเอียด/ }));

    expect(await screen.findByRole('heading', { name: 'รายละเอียดแผนสหกิจ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ตรวจพิจารณาแผน' })).not.toBeInTheDocument();
  });
});

describe('#189 returning a plan needs a reason', () => {
  async function openDecisionForm() {
    render(<CoopPlans />);
    await userEvent.click(await screen.findByText('6600000001'));
    await userEvent.click(await screen.findByRole('button', { name: 'ตรวจพิจารณาแผน' }));
    return screen.findByRole('dialog');
  }

  it('a blank or whitespace-only reason is stopped before anything is sent', async () => {
    getCoopPlansMock.mockResolvedValue([RESUBMITTED]);
    getCoopPlanMock.mockResolvedValue(RESUBMITTED);

    const modal = await openDecisionForm();
    await userEvent.click(within(modal).getByRole('button', { name: 'ไม่รับรอง' }));
    await userEvent.type(within(modal).getByRole('textbox'), '   ');
    await userEvent.click(within(modal).getByRole('button', { name: 'ไม่รับรอง' }));

    expect(within(modal).getByRole('alert')).toHaveTextContent('กรุณาระบุเหตุผลที่ไม่รับรอง');
    expect(endorseCoopPlanMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('with a reason, sends it trimmed, then shows the plan as returned with the new reason in the history', async () => {
    const reason = 'ตำแหน่งงานไม่ตรงกับหลักสูตร';
    const returned = {
      ...RESUBMITTED,
      status: 'RETURNED',
      reviewed_at: '2026-10-25T10:00:00Z',
      review_comment: reason,
      reviews: [
        {
          review_id: 6,
          decision: 'NOT_ENDORSED',
          comment: reason,
          reviewed_at: '2026-10-25T10:00:00Z',
          reviewer_name: 'advisor1@example.com',
        },
        ...RESUBMITTED.reviews,
      ],
    };
    getCoopPlansMock.mockResolvedValue([RESUBMITTED]);
    getCoopPlanMock
      .mockResolvedValueOnce(RESUBMITTED) // opening the plan page
      .mockResolvedValueOnce(RESUBMITTED) // opening the decision form
      .mockResolvedValue(returned); // read back after the decision
    endorseCoopPlanMock.mockResolvedValue({ ...returned, reviews: undefined });

    const modal = await openDecisionForm();
    await userEvent.type(within(modal).getByRole('textbox'), `  ${reason}  `);
    await userEvent.click(within(modal).getByRole('button', { name: 'ไม่รับรอง' }));

    await waitFor(() =>
      expect(endorseCoopPlanMock).toHaveBeenCalledWith(21, 'NOT_ENDORSED', reason, 'a-token'),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const history = await screen.findByRole('list', { name: 'ประวัติการพิจารณา' });
    await waitFor(() => expect(within(history).getAllByRole('listitem')).toHaveLength(2));
    expect(within(history).getAllByRole('listitem')[0]).toHaveTextContent(reason);
    // The page header badge, not the history entry.
    expect(screen.getAllByText('ส่งกลับแก้ไข').length).toBeGreaterThan(0);
    expect(screen.queryByText('รอตรวจ')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ตรวจพิจารณาแผน' })).not.toBeInTheDocument();
  });
});

describe('#189 a plan outside the advisor’s assignment', () => {
  it('opened by URL and refused with 403: no plan page, no decision form, back to the list with a notice', async () => {
    getCoopPlansMock.mockResolvedValue([RESUBMITTED]);
    getCoopPlanMock.mockRejectedValue(new CoopPlanApiError('Forbidden', 403));
    const onRoutePlanChange = vi.fn();

    render(<CoopPlans routePlanId={99} onRoutePlanChange={onRoutePlanChange} />);

    await waitFor(() => expect(onRoutePlanChange).toHaveBeenCalledWith(null));
    expect(getCoopPlanMock).toHaveBeenCalledWith(99, 'a-token');
    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่มีสิทธิ์');
    expect(screen.queryByRole('heading', { name: 'รายละเอียดแผนสหกิจ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(endorseCoopPlanMock).not.toHaveBeenCalled();
    // The advisor's own list is still there.
    expect(await screen.findByText('6600000001')).toBeInTheDocument();
  });
});
