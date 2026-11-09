import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { PlanDetailModal } from './PlanDetailModal';
import { CoopPlanApiError } from '../../data/coopPlanApi';
import { canEndorsePlans } from '../../auth/roles';
import type { CoopPlan } from '../../types/coopPlan';

vi.mock('../../data/attachmentApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/attachmentApi')>()),
  listPlanAttachments: vi.fn().mockResolvedValue({ attachments: [] }),
}));

const PLAN = {
  plan_id: 10,
  student_id: '6600000001',
  period_id: 'P2568-1',
  status: 'SUBMITTED',
  first_name: 'สมชาย',
  last_name: 'ใจดี',
  curriculum: '66',
  submitted_at: '2026-10-20T10:00:00Z',
  reviewed_at: null,
  review_comment: null,
} as unknown as CoopPlan;

function renderModal(props: Partial<React.ComponentProps<typeof PlanDetailModal>> = {}) {
  const handlers = {
    onEndorse: vi.fn(async ({ decision }) => ({
      ...PLAN,
      status: decision === 'ENDORSED' ? 'ENDORSED' : 'RETURNED',
    }) as CoopPlan),
    onSaved: vi.fn(),
    onOpenChange: vi.fn(),
  };
  render(
    <PlanDetailModal
      plan={PLAN}
      open
      reviewerName="advisor1@example.com"
      getIdToken={async () => 'token'}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

describe('advisor endorse form (#147)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('only ADVISOR gets the endorse form', () => {
    expect(canEndorsePlans('ADVISOR')).toBe(true);
    for (const role of ['STAFF', 'COMMITTEE', 'STUDENT', 'ADMIN', null]) {
      expect(canEndorsePlans(role)).toBe(false);
    }
  });

  it('offers endorse / not endorse and no approve option', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'รับรอง' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ไม่รับรอง' })).toBeInTheDocument();
    expect(screen.queryByText(/อนุมัติ \(Approve\)/)).not.toBeInTheDocument();
  });

  it('endorsing saves the plan as ENDORSED and closes', async () => {
    const { onEndorse, onSaved, onOpenChange } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'รับรอง' }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onEndorse).toHaveBeenCalledWith({ planId: 10, decision: 'ENDORSED', comment: '' });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ status: 'ENDORSED' }));
  });

  it('not endorsing without a reason is stopped before the API', async () => {
    const { onEndorse } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: 'ไม่รับรอง' }));

    expect(screen.getByRole('alert')).toHaveTextContent('กรุณาระบุเหตุผลที่ไม่รับรอง');
    expect(onEndorse).not.toHaveBeenCalled();
  });

  it('not endorsing with a reason returns the plan', async () => {
    const { onEndorse, onSaved } = renderModal();
    await userEvent.type(screen.getByLabelText(/เหตุผล/), 'ขาดใบรับรองความประพฤติ');
    await userEvent.click(screen.getByRole('button', { name: 'ไม่รับรอง' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ status: 'RETURNED' })));
    expect(onEndorse).toHaveBeenCalledWith({
      planId: 10,
      decision: 'NOT_ENDORSED',
      comment: 'ขาดใบรับรองความประพฤติ',
    });
  });

  it('a 409 keeps the form open with a message', async () => {
    const { onSaved, onOpenChange } = renderModal({
      onEndorse: vi.fn().mockRejectedValue(new CoopPlanApiError('Conflict', 409)),
    });
    await userEvent.click(screen.getByRole('button', { name: 'รับรอง' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('ได้รับการพิจารณาไปแล้ว');
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('without onEndorse or onScreen there is no decision form, and never an approve option (#148)', () => {
    renderModal({ onEndorse: undefined });
    expect(screen.queryByRole('button', { name: 'รับรอง' })).not.toBeInTheDocument();
    expect(screen.queryByText(/อนุมัติ \(Approve\)/)).not.toBeInTheDocument();
  });
});
