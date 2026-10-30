import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { PlanDetailModal } from './PlanDetailModal';
import { CoopPlanApiError } from '../../data/coopPlanApi';
import { canScreenPlans } from '../../auth/roles';
import type { CoopPlan } from '../../types/coopPlan';
import type { PlanEligibility } from '../../types/planReview';

const { getPlanEligibilityMock } = vi.hoisted(() => ({ getPlanEligibilityMock: vi.fn() }));
vi.mock('../../data/coopPlanApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/coopPlanApi')>()),
  getPlanEligibility: getPlanEligibilityMock,
}));

vi.mock('../../data/attachmentApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/attachmentApi')>()),
  listPlanAttachments: vi.fn().mockResolvedValue({ attachments: [] }),
}));

const PLAN = {
  plan_id: 10,
  student_id: '6600000001',
  period_id: 'P2568-1',
  status: 'ENDORSED',
  first_name: 'สมชาย',
  last_name: 'ใจดี',
  curriculum: '66',
  submitted_at: '2026-10-20T10:00:00Z',
  reviewed_at: null,
  review_comment: null,
} as unknown as CoopPlan;

const ELIGIBLE: PlanEligibility = {
  plan_id: 10,
  period_id: 'P2568-1',
  criteria: { min_gpa: 2, min_group_gpa: 2.5 },
  eligible: true,
  failures: [],
};

const STATUS_FOR = { ELIGIBLE: 'ELIGIBLE', INCOMPLETE: 'RETURNED', NOT_ELIGIBLE: 'NOT_ELIGIBLE' } as const;

function renderModal(props: Partial<React.ComponentProps<typeof PlanDetailModal>> = {}) {
  const handlers = {
    onScreen: vi.fn(async ({ decision }) => ({ ...PLAN, status: STATUS_FOR[decision as keyof typeof STATUS_FOR] }) as CoopPlan),
    onSaved: vi.fn(),
    onOpenChange: vi.fn(),
  };
  render(
    <PlanDetailModal
      plan={PLAN}
      open
      reviewerName="staff1@example.com"
      getIdToken={async () => 'token'}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

const eligibilityBox = () => screen.getByLabelText('ผลตรวจคุณสมบัติตามเกณฑ์ของรอบ');

describe('staff screening form (#148)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlanEligibilityMock.mockResolvedValue(ELIGIBLE);
  });

  it('only STAFF gets the screening form', () => {
    expect(canScreenPlans('STAFF')).toBe(true);
    for (const role of ['ADVISOR', 'COMMITTEE', 'STUDENT', 'ADMIN', null]) {
      expect(canScreenPlans(role)).toBe(false);
    }
  });

  it("shows the period's criteria and that the student meets them, with no approve option", async () => {
    renderModal();

    expect(await within(eligibilityBox()).findByText('ผ่านเกณฑ์ของรอบทุกข้อ')).toBeInTheDocument();
    expect(eligibilityBox()).toHaveTextContent('มากกว่า 2.00');
    expect(eligibilityBox()).toHaveTextContent('อย่างน้อย 2.50');
    expect(getPlanEligibilityMock).toHaveBeenCalledWith(10, 'token');
    expect(screen.queryByText(/อนุมัติ \(Approve\)/)).not.toBeInTheDocument();
  });

  it('lists failed criteria in Thai', async () => {
    getPlanEligibilityMock.mockResolvedValue({
      ...ELIGIBLE,
      eligible: false,
      failures: [{ code: 'GPA_BELOW_MINIMUM', message: 'Overall GPA must be greater than 2.00.' }],
    });
    renderModal();

    expect(await within(eligibilityBox()).findByText('เกรดเฉลี่ยยังไม่ผ่านเกณฑ์ที่กำหนด')).toBeInTheDocument();
  });

  it('still lets staff decide when the eligibility check cannot load', async () => {
    getPlanEligibilityMock.mockRejectedValue(new Error('network'));
    renderModal();

    expect(await within(eligibilityBox()).findByText(/โหลดผลตรวจคุณสมบัติไม่สำเร็จ/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ผ่านการตรวจ' })).toBeEnabled();
  });

  it('S01: ผ่านการตรวจ saves the plan as ELIGIBLE and closes', async () => {
    const { onScreen, onSaved, onOpenChange } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'ผ่านการตรวจ' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onScreen).toHaveBeenCalledWith({ planId: 10, decision: 'ELIGIBLE', comment: '' });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ status: 'ELIGIBLE' }));
  });

  it.each(['เอกสารไม่ครบ', 'ไม่ผ่านคุณสมบัติ'])('%s without a reason is stopped before the API', async (name) => {
    const { onScreen } = renderModal();
    await userEvent.click(screen.getByRole('button', { name }));

    expect(screen.getByRole('alert')).toHaveTextContent('กรุณาระบุเหตุผล');
    expect(onScreen).not.toHaveBeenCalled();
  });

  it('S02: เอกสารไม่ครบ with a reason returns the plan to the student', async () => {
    const { onScreen, onSaved } = renderModal();
    await userEvent.type(screen.getByLabelText(/เหตุผล/), 'ไม่มีไฟล์ Transcript');
    await userEvent.click(screen.getByRole('button', { name: 'เอกสารไม่ครบ' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ status: 'RETURNED' })));
    expect(onScreen).toHaveBeenCalledWith({ planId: 10, decision: 'INCOMPLETE', comment: 'ไม่มีไฟล์ Transcript' });
  });

  it('a 409 keeps the form open with a message', async () => {
    const { onSaved, onOpenChange } = renderModal({
      onScreen: vi.fn().mockRejectedValue(new CoopPlanApiError('Conflict', 409)),
    });
    await userEvent.click(screen.getByRole('button', { name: 'ผ่านการตรวจ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('ได้รับการตรวจไปแล้ว');
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
