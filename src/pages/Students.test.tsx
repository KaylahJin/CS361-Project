import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: useAuthMock }));

const getStudentsMock = vi.fn();
const getStudentMock = vi.fn();

vi.mock('../data/studentApi', async () => {
  const actual = await vi.importActual<typeof import('../data/studentApi')>(
    '../data/studentApi',
  );
  return {
    ...actual,
    getStudents: getStudentsMock,
    getStudent: getStudentMock,
  };
});

const { StudentApiError } = await import('../data/studentApi');
const { default: Students } = await import('./Students');

// An id that used to exist in the bundled studentsData.json. Asserting it is
// absent is what proves the page has no copy of the data to fall back on.
const BUNDLED_ID = '6100000001';

const STUDENT = {
  student_id: '6600000001',
  first_name: 'บีบี',
  last_name: 'น้ำทิพย์',
  curriculum: '66',
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

function restoringSession() {
  useAuthMock.mockReturnValue({
    status: 'loading',
    getIdToken: async () => null,
  });
}

describe('Students when the API refuses or fails', () => {
  beforeEach(() => {
    getStudentsMock.mockReset();
    getStudentMock.mockReset();
    useAuthMock.mockReset();
    signedIn();
  });

  it('shows an error instead of student rows when the API is unreachable', async () => {
    getStudentsMock.mockRejectedValue(new Error('network down'));

    render(<Students />);

    expect(
      await screen.findByText(/ไม่สามารถโหลดข้อมูลนักศึกษาได้/),
    ).toBeInTheDocument();
    expect(screen.queryByText(BUNDLED_ID)).not.toBeInTheDocument();
  });

  it('asks the caller to sign in when the API answers 401', async () => {
    getStudentsMock.mockRejectedValue(new StudentApiError('no token', 401));

    render(<Students />);

    expect(
      await screen.findByText(/ลงชื่อเข้าใช้เพื่อดูข้อมูลนักศึกษา/),
    ).toBeInTheDocument();
    expect(screen.queryByText(BUNDLED_ID)).not.toBeInTheDocument();
  });

  it('says the account has no permission when the API answers 403', async () => {
    getStudentsMock.mockRejectedValue(new StudentApiError('forbidden', 403));

    render(<Students />);

    expect(
      await screen.findByText(/ไม่มีสิทธิ์เข้าถึงข้อมูลนักศึกษา/),
    ).toBeInTheDocument();
    expect(screen.queryByText(BUNDLED_ID)).not.toBeInTheDocument();
  });

  it('renders the rows the API returns', async () => {
    getStudentsMock.mockResolvedValue([STUDENT]);

    render(<Students />);

    expect(await screen.findByText('6600000001')).toBeInTheDocument();
  });
});

describe('Students and the signed-in session', () => {
  beforeEach(() => {
    getStudentsMock.mockReset();
    getStudentMock.mockReset();
    useAuthMock.mockReset();
    signedIn();
  });

  it('sends the ID token with the request', async () => {
    getStudentsMock.mockResolvedValue([STUDENT]);

    render(<Students />);

    await screen.findByText('6600000001');
    expect(getStudentsMock).toHaveBeenCalledWith(expect.anything(), 'a-token');
  });

  it('waits for a restoring session instead of firing a request with no token', async () => {
    restoringSession();
    getStudentsMock.mockResolvedValue([STUDENT]);

    render(<Students />);

    expect(getStudentsMock).not.toHaveBeenCalled();
  });

  it('drops the rows on screen when the session ends', async () => {
    // The same bug class as the coop-plan page: without the auth status in the
    // dependency list, one person's rows stay on screen for whoever signs in
    // or out next.
    getStudentsMock.mockResolvedValue([STUDENT]);

    const { rerender } = render(<Students />);
    await screen.findByText('6600000001');

    signedOut();
    getStudentsMock.mockRejectedValue(new StudentApiError('no token', 401));
    rerender(<Students />);

    expect(
      await screen.findByText(/ลงชื่อเข้าใช้เพื่อดูข้อมูลนักศึกษา/),
    ).toBeInTheDocument();
    expect(screen.queryByText('6600000001')).not.toBeInTheDocument();
  });

  it('renders a row whose optional fields the role does not include', async () => {
    // An ADMIN response carries identity columns only. Reading .toFixed() off
    // a missing gpa would throw and take the whole page with it.
    getStudentsMock.mockResolvedValue([
      { student_id: '6600000002', first_name: 'ซีซี', last_name: 'ใจดี', curriculum: '66' },
    ]);

    render(<Students />);

    expect(await screen.findByText('6600000002')).toBeInTheDocument();
  });

  it('renders the detail panel for a row with no courses or contact fields', async () => {
    getStudentsMock.mockResolvedValue([
      { student_id: '6600000002', first_name: 'ซีซี', last_name: 'ใจดี', curriculum: '66' },
    ]);
    getStudentMock.mockResolvedValue({
      student_id: '6600000002',
      first_name: 'ซีซี',
      last_name: 'ใจดี',
      curriculum: '66',
    });

    render(<Students />);

    const row = await screen.findByText('6600000002');
    row.click();

    expect(await screen.findByText(/ซีซี/)).toBeInTheDocument();
  });
});
