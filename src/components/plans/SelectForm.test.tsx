import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { PlanDetailModal } from './PlanDetailModal';
import { CoopPlanApiError } from '../../data/coopPlanApi';
import { canSelectPlans, reviewableStatusFor } from '../../auth/roles';
import type { CoopPlan } from '../../types/coopPlan';

vi.mock('../../data/attachmentApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/attachmentApi')>()),
  listPlanAttachments: vi.fn().mockResolvedValue({ attachments: [] }),
}));

const PLAN = {
  plan_id: 10,
  student_id: '6600000001',
  period_id: 'P2568-1',
  status: 'ELIGIBLE',
  first_name: 'สมชาย',
  last_name: 'ใจดี',
  curriculum: '66',
  submitted_at: '2026-10-20T10:00:00Z',
  reviewed_at: null,
  review_comment: null,
} as unknown as CoopPlan;

function renderModal(props: Partial<React.ComponentProps<typeof PlanDetailModal>> = {}) {
  const handlers = {
    onSelect: vi.fn(async ({ decision }) => ({ ...PLAN, status: decision }) as CoopPlan),
    onSaved: vi.fn(),
    onOpenChange: vi.fn(),
  };
  render(
    <PlanDetailModal
      plan={PLAN}
      open
      reviewerName="committee1@example.com"
      getIdToken={async () => 'token'}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

describe('committee selection form (#149)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('only COMMITTEE gets the selection form, and it acts on ELIGIBLE plans', () => {
    expect(canSelectPlans('COMMITTEE')).toBe(true);
    expect(reviewableStatusFor('COMMITTEE')).toBe('ELIGIBLE');
    for (const role of ['ADVISOR', 'STAFF', 'STUDENT', 'ADMIN', null]) {
      expect(canSelectPlans(role)).toBe(false);
    }
  });

  it('คัดเลือก saves the plan as SELECTED and closes', async () => {
    const { onSelect, onSaved, onOpenChange } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'คัดเลือก' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSelect).toHaveBeenCalledWith({ planId: 10, decision: 'SELECTED', comment: '' });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ status: 'SELECTED' }));
  });

  it('ไม่คัดเลือก without a reason is stopped before the API', async () => {
    const { onSelect } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'ไม่คัดเลือก' }));

    expect(screen.getByRole('alert')).toHaveTextContent('กรุณาระบุเหตุผลที่ไม่คัดเลือก');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ไม่คัดเลือก with a reason saves NOT_SELECTED', async () => {
    const { onSelect } = renderModal();
    await userEvent.type(screen.getByLabelText(/เหตุผล/), 'ลำดับคะแนนไม่ถึงจำนวนรับ');
    await userEvent.click(screen.getByRole('button', { name: 'ไม่คัดเลือก' }));

    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith({
        planId: 10,
        decision: 'NOT_SELECTED',
        comment: 'ลำดับคะแนนไม่ถึงจำนวนรับ',
      })
    );
  });

  it.each([
    ['CAPACITY_REACHED', 'คัดเลือกครบจำนวนรับแล้ว'],
    ['CAPACITY_NOT_SET', 'ยังไม่ได้กำหนดจำนวนรับ'],
    ['PLAN_NOT_SELECTABLE', 'ได้รับการคัดเลือกไปแล้ว'],
  ])('a 409 %s keeps the form open and says why', async (code, text) => {
    const { onSaved, onOpenChange } = renderModal({
      onSelect: vi.fn().mockRejectedValue(new CoopPlanApiError('Conflict', 409, code)),
    });
    await userEvent.click(screen.getByRole('button', { name: 'คัดเลือก' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
