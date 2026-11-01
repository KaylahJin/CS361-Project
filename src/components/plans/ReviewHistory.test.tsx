import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ReviewHistory } from './ReviewHistory';
import type { PlanReviewHistoryItem } from '../../types/planReview';

const history: PlanReviewHistoryItem[] = [
  {
    review_id: 2,
    decision: 'APPROVED',
    comment: null,
    reviewed_at: '2026-10-25T10:00:00Z',
    reviewer_name: 'staff1@example.com',
  },
  {
    review_id: 1,
    decision: 'RETURNED',
    comment: 'กรุณาแนบ Transcript',
    reviewed_at: '2026-10-24T09:00:00Z',
    reviewer_name: 'advisor1@example.com',
  },
];

describe('ReviewHistory', () => {
  it('lists every decision, in the order given, with who made it and why', () => {
    render(<ReviewHistory reviews={history} />);

    const items = within(screen.getByRole('list', { name: 'ประวัติการพิจารณา' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('อนุมัติ');
    expect(items[0]).toHaveTextContent('staff1@example.com');
    expect(items[1]).toHaveTextContent('ส่งกลับให้แก้ไข');
    expect(items[1]).toHaveTextContent('advisor1@example.com');
    expect(items[1]).toHaveTextContent('กรุณาแนบ Transcript');
  });

  it('keeps the earlier reason readable after a later decision', () => {
    render(<ReviewHistory reviews={history} />);

    expect(screen.getByText('กรุณาแนบ Transcript')).toBeInTheDocument();
  });

  it.each([[undefined], [[]]])('says there is no history yet when given %j', (reviews) => {
    render(<ReviewHistory reviews={reviews as PlanReviewHistoryItem[] | undefined} />);

    expect(screen.getByText('ยังไม่มีประวัติการพิจารณา')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
