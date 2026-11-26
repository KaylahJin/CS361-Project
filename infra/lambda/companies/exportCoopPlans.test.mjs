import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const getAuthenticatedUserMock = vi.fn();

vi.mock('./db.mjs', () => ({
  getPool: () => ({ query: queryMock }),
}));
vi.mock('./auth.mjs', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));

const { exportCoopPlans, buildCsv, CSV_HEADERS } = await import('./exportCoopPlans.mjs');

function signedInAs(role, sub = 'staff-1') {
  getAuthenticatedUserMock.mockResolvedValue({
    user: { sub, role, studentId: null },
    denied: null,
  });
}

describe('exportCoopPlans', () => {
  beforeEach(() => {
    queryMock.mockReset();
    getAuthenticatedUserMock.mockReset();
  });

  it.each(['STAFF', 'ADMIN'])('allows %s and writes export audit', async (role) => {
    signedInAs(role);
    queryMock
      .mockResolvedValueOnce({ rows: [{ student_id: '65001', first_name: 'ทดสอบ', last_name: 'ระบบ', curriculum: '66', status: 'APPROVED' }] })
      .mockResolvedValueOnce({ rows: [{ export_id: 1 }] });

    const result = await exportCoopPlans({
      queryStringParameters: { status: 'APPROVED', curriculum: '66' },
    });

    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('text/csv; charset=utf-8');
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toMatch(/INSERT INTO export_audit/);
    expect(queryMock.mock.calls[1][1]).toEqual([
      'staff-1',
      role,
      JSON.stringify({ status: 'APPROVED', curriculum: '66' }),
    ]);
  });

  it.each(['STUDENT', 'ADVISOR', 'COMMITTEE'])('returns 403 for %s without querying', async (role) => {
    signedInAs(role);
    const result = await exportCoopPlans({ queryStringParameters: null });
    expect(result.statusCode).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns 401 when identity is missing and never creates an audit', async () => {
    getAuthenticatedUserMock.mockResolvedValue({
      user: null,
      denied: { status: 401, error: 'Unauthorized' },
    });
    const result = await exportCoopPlans({ queryStringParameters: null });
    expect(result.statusCode).toBe(401);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('records only allowlisted, provided filters in the audit', async () => {
    signedInAs('STAFF');
    queryMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    await exportCoopPlans({
      queryStringParameters: {
        status: '  APPROVED ',
        curriculum: '66',
        unknownParam: 'must-not-be-recorded',
      },
    });
    expect(queryMock.mock.calls[1][1]).toEqual([
      'staff-1',
      'STAFF',
      JSON.stringify({ status: 'APPROVED', curriculum: '66' }),
    ]);
  });

  it('uses only the allowlisted CSV headers and removes formula interpretation', () => {
    const csv = buildCsv([{
      student_id: '=SUM(A1)',
      first_name: '+ทดสอบ',
      last_name: '-นักศึกษา',
      curriculum: '66',
      status: 'APPROVED',
      company_name: '@บริษัท',
      position_title: 'ตำแหน่ง',
      period_name: 'ภาคเรียน',
      submitted_at: '2026-11-01T00:00:00Z',
      reviewed_at: '2026-11-02T00:00:00Z',
      submission_deadline: null,
    }]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(CSV_HEADERS).toEqual([
      'รหัสนักศึกษา', 'ชื่อ-นามสกุล', 'หลักสูตร', 'สถานะแผน',
      'สถานประกอบการ', 'ตำแหน่ง', 'รอบเวลา', 'วันที่ส่งแผน',
      'วันที่พิจารณาล่าสุด', 'สถานะ deadline',
    ]);
    expect(csv).not.toMatch(/อีเมล|เบอร์โทร|วันเกิด|GPA|ผลการเรียน|ความคิดเห็น|ไฟล์แนบ/i);
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain("'+ทดสอบ");
    expect(csv).toContain("'@บริษัท");
  });

  it('uses the same filters and parameterized SQL as the plan list', async () => {
    signedInAs('STAFF');
    queryMock.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
    await exportCoopPlans({
      queryStringParameters: {
        status: 'SUBMITTED',
        search: 'ใจดี',
        curriculum: '66',
        periodId: 'P2568-1',
        companyId: 'C47',
      },
    });
    const [sql, values] = queryMock.mock.calls[0];
    expect(sql).toMatch(/p\.status\s*=\s*\$1/);
    expect(sql).toMatch(/s\.first_name ILIKE/);
    expect(sql).toMatch(/p\.period_id\s*=\s*\$4/);
    expect(sql).toMatch(/pos\.company_id\s*=\s*\$5/);
    expect(values).toEqual(['SUBMITTED', '%ใจดี%', '66', 'P2568-1', 'C47']);
  });
});
