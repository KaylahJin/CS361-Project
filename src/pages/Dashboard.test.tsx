import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const useAuthMock = vi.fn();
const getDashboardSummaryMock = vi.fn();

vi.mock('../auth/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('../data/coopPlanApi', async () => {
  const actual = await vi.importActual<typeof import('../data/coopPlanApi')>('../data/coopPlanApi');
  return { ...actual, getDashboardSummary: getDashboardSummaryMock };
});

const { default: Dashboard } = await import('./Dashboard');

const EMPTY_COUNTS = {
  PREPARING: 0, SUBMITTED: 0, RETURNED: 0, ENDORSED: 0, ELIGIBLE: 0,
  NOT_ELIGIBLE: 0, SELECTED: 0, NOT_SELECTED: 0, APPROVED: 0, REJECTED: 0,
};

describe('Dashboard (#266)', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    getDashboardSummaryMock.mockReset();
    useAuthMock.mockReturnValue({ status: 'authenticated', role: 'STAFF', getIdToken: async () => 'tok' });
  });

  it('renders status counts and navigates to plan detail when clicking an overdue plan', async () => {
    getDashboardSummaryMock.mockResolvedValue({
      totalPlans: 4,
      statusCounts: { ...EMPTY_COUNTS, SUBMITTED: 2, PREPARING: 1, APPROVED: 1 },
      overdueCount: 1,
      overduePlans: [
        {
          plan_id: 21,
          student_id: '6609610001',
          period_id: '2569-1',
          status: 'PREPARING',
          submitted_at: null,
          first_name: 'สมชาย',
          last_name: 'ใจดี',
          curriculum: 'CS',
          position_title: 'Developer',
          company_name: 'บ.ตัวอย่าง',
          company_short_name: 'EX',
          period_name: '1/2569',
          submission_deadline: '2026-11-20',
          days_overdue: 6,
        },
      ],
    });
    const onOpenPlan = vi.fn();

    render(<Dashboard onOpenPlan={onOpenPlan} />);

    expect(await screen.findByText('ทั้งหมด 4 แผน')).toBeInTheDocument();
    expect(screen.getAllByText(/6609610001 สมชาย ใจดี/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole('button', { name: /เปิดดูแผน #21/ })[0]);
    expect(onOpenPlan).toHaveBeenCalledWith(21);
  });

  it('shows empty state when there are no overdue plans', async () => {
    getDashboardSummaryMock.mockResolvedValue({
      totalPlans: 1,
      statusCounts: { ...EMPTY_COUNTS, APPROVED: 1 },
      overdueCount: 0,
      overduePlans: [],
    });

    render(<Dashboard onOpenPlan={vi.fn()} />);

    expect(await screen.findByText(/ไม่มีรายการแผนที่เกินกำหนดในขณะนี้/)).toBeInTheDocument();
  });

  it.each(['STUDENT', 'ADVISOR', 'COMMITTEE', null])('blocks %s from viewing Dashboard', (role) => {
    useAuthMock.mockReturnValue({ status: 'authenticated', role, getIdToken: async () => 'tok' });

    render(<Dashboard onOpenPlan={vi.fn()} />);

    expect(screen.getByText(/ไม่มีสิทธิ์เข้าถึงหน้า Dashboard/)).toBeInTheDocument();
    expect(getDashboardSummaryMock).not.toHaveBeenCalled();
  });
});
