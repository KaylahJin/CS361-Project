import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanDetailModal } from './PlanDetailModal';
import type { CoopPlan } from '../../types/coopPlan';

const plan = {
  plan_id: 7,
  student_id: '6600000001',
  period_id: 'COOP-2569-01',
  position_id: 'POS021',
  status: 'SUBMITTED',
  acknowledged_pre_course: true,
  terms_accepted_at: '2026-10-20T08:00:00Z',
  student_note: null,
  submitted_at: '2026-10-21T08:00:00Z',
  reviewer_name: 'advisor1@example.com',
  reviewed_at: '2026-10-22T09:00:00Z',
  review_comment: 'กรุณาแนบ Transcript',
  created_at: '2026-10-19T08:00:00Z',
  updated_at: '2026-10-22T09:00:00Z',
  first_name: 'บีบี',
  last_name: 'น้ำทิพย์',
  curriculum: '66',
  position_title: 'Java Developer',
  company_id: 'C70',
  company_name: 'Cube SoftTech',
  reviews: [
    {
      review_id: 1,
      decision: 'RETURNED',
      comment: 'กรุณาแนบ Transcript',
      reviewed_at: '2026-10-22T09:00:00Z',
      reviewer_name: 'advisor1@example.com',
    },
  ],
} as unknown as CoopPlan;

function renderModal(p: CoopPlan) {
  return render(
    <PlanDetailModal plan={p} open onOpenChange={vi.fn()} reviewerName="staff1@example.com" />,
  );
}

describe('PlanDetailModal review form', () => {
  it('starts the comment box empty even though the last round left a comment (F12)', () => {
    renderModal(plan);

    const box = screen.getByRole('textbox');
    expect(box).toHaveValue('');
  });

  it('still shows the earlier comment, in the history', () => {
    renderModal(plan);

    expect(screen.getByRole('list', { name: 'ประวัติการพิจารณา' })).toHaveTextContent('กรุณาแนบ Transcript');
    expect(screen.getByText('ส่งกลับให้แก้ไข')).toBeInTheDocument();
  });
});
