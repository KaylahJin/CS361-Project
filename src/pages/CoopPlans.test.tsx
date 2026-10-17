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
