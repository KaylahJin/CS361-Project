import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: useAuthMock }));

const getCoopPlansMock = vi.fn();
const getCoopPlanMock = vi.fn();

vi.mock('../data/coopPlanApi', async () => {
  const actual = await vi.importActual<typeof import('../data/coopPlanApi')>(
    '../data/coopPlanApi',
  );
  return {
    ...actual,
    getCoopPlans: getCoopPlansMock,
    getCoopPlan: getCoopPlanMock,
  };
});

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

function signedIn() {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
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
