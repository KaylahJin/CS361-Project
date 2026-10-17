import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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

describe('Students when the API refuses or fails', () => {
  beforeEach(() => {
    getStudentsMock.mockReset();
    getStudentMock.mockReset();
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
