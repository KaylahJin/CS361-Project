import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { EligibilityResult } from './EligibilityResult';
import type { PlanEligibility } from '../../types/planReview';

const { getPlanEligibilityMock } = vi.hoisted(() => ({ getPlanEligibilityMock: vi.fn() }));
vi.mock('../../data/coopPlanApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../data/coopPlanApi')>()),
  getPlanEligibility: getPlanEligibilityMock,
}));

const ELIGIBLE: PlanEligibility = {
  plan_id: 10,
  period_id: 'P2568-1',
  criteria: { min_gpa: 2, min_group_gpa: 2.5 },
  eligible: true,
  failures: [],
};

const box = () => screen.getByLabelText('ผลตรวจคุณสมบัติตามเกณฑ์ของรอบ');
const renderBox = () => render(<EligibilityResult planId={10} getIdToken={async () => 'token'} />);

describe('EligibilityResult (#148)', () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the period's criteria and that the student meets them", async () => {
    getPlanEligibilityMock.mockResolvedValue(ELIGIBLE);
    renderBox();

    expect(await screen.findByText('ผ่านเกณฑ์ของรอบทุกข้อ')).toBeInTheDocument();
    expect(box()).toHaveTextContent('มากกว่า 2.00');
    expect(box()).toHaveTextContent('อย่างน้อย 2.50');
    expect(getPlanEligibilityMock).toHaveBeenCalledWith(10, 'token');
  });

  it('lists failed criteria in Thai', async () => {
    getPlanEligibilityMock.mockResolvedValue({
      ...ELIGIBLE,
      eligible: false,
      failures: [{ code: 'GPA_BELOW_MINIMUM', message: 'Overall GPA must be greater than 2.00.' }],
    });
    renderBox();

    expect(await screen.findByText('เกรดเฉลี่ยยังไม่ผ่านเกณฑ์ที่กำหนด')).toBeInTheDocument();
  });

  it('says so when the check cannot load', async () => {
    getPlanEligibilityMock.mockRejectedValue(new Error('network'));
    renderBox();

    expect(await screen.findByText(/โหลดผลตรวจคุณสมบัติไม่สำเร็จ/)).toBeInTheDocument();
  });
});
