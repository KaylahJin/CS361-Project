import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ReviewHistory, PlanActivityTimeline } from './ReviewHistory';
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

  it('renders step labels for multi-step review decisions (ENDORSEMENT, SCREENING, SELECTION)', () => {
    const steppedReviews: PlanReviewHistoryItem[] = [
      {
        review_id: 3,
        step: 'SELECTION',
        decision: 'SELECTED',
        comment: 'ผ่านการคัดเลือก',
        reviewed_at: '2026-10-27T11:00:00Z',
        reviewer_name: 'committee1@example.com',
      },
      {
        review_id: 2,
        step: 'SCREENING',
        decision: 'ELIGIBLE',
        comment: null,
        reviewed_at: '2026-10-26T10:00:00Z',
        reviewer_name: 'staff1@example.com',
      },
      {
        review_id: 1,
        step: 'ENDORSEMENT',
        decision: 'ENDORSED',
        comment: 'เห็นชอบให้ยื่นสหกิจ',
        reviewed_at: '2026-10-25T09:00:00Z',
        reviewer_name: 'advisor1@example.com',
      },
    ];

    render(<ReviewHistory reviews={steppedReviews} />);
    expect(screen.getByText('ได้รับคัดเลือก')).toBeInTheDocument();
    expect(screen.getByText('ขั้นคัดเลือกโดยกรรมการ')).toBeInTheDocument();
    expect(screen.getByText('ผ่านคุณสมบัติ')).toBeInTheDocument();
    expect(screen.getByText('ขั้นตรวจคุณสมบัติโดยเจ้าหน้าที่')).toBeInTheDocument();
    expect(screen.getByText('รับรองความประพฤติ')).toBeInTheDocument();
    expect(screen.getByText('ขั้นรับรองโดยอาจารย์ที่ปรึกษา')).toBeInTheDocument();
  });
});

describe('PlanActivityTimeline', () => {
  it('builds chronological activity timeline from verified DB timestamps and discloses data limitation', () => {
    render(
      <PlanActivityTimeline
        plan={{
          plan_id: 1,
          student_id: '6600000001',
          period_id: 'P2568-1',
          position_id: 1,
          status: 'APPROVED',
          acknowledged_pre_course: true,
          terms_accepted_at: '2026-10-21T09:00:00Z',
          student_note: null,
          submitted_at: '2026-10-22T10:00:00Z',
          reviewer_name: 'staff1@example.com',
          reviewed_at: '2026-10-25T10:00:00Z',
          review_comment: null,
          created_at: '2026-10-20T08:00:00Z',
          updated_at: '2026-10-25T10:00:00Z',
          first_name: 'บีบี',
          last_name: 'น้ำทิพย์',
          curriculum: 'วิทยาการคอมพิวเตอร์',
          position_title: 'Software Engineer',
          company_id: 'C33',
          company_name: 'SCB TechX',
          company_short_name: 'SCB TechX',
          period_name: '1/2568',
          reviews: history,
        }}
      />,
    );

    expect(screen.getByText(/ข้อจำกัดข้อมูล \(Limited Activity History\)/)).toBeInTheDocument();
    expect(screen.getByText(/แสดงเฉพาะเหตุการณ์ที่มีบันทึกเวลาจริงจากฐานข้อมูล/)).toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'ประวัติกิจกรรมของแผน' })).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent('การพิจารณาแผน: อนุมัติ');
    expect(items[1]).toHaveTextContent('การพิจารณาแผน: ส่งกลับให้แก้ไข');
    expect(items[2]).toHaveTextContent('ยื่นแผนสหกิจศึกษา (การยื่นล่าสุด)');
    expect(items[3]).toHaveTextContent('ยอมรับเงื่อนไขก่อนปฏิบัติสหกิจศึกษา');
    expect(items[4]).toHaveTextContent('สร้างแผนสหกิจศึกษา (ฉบับร่าง)');
  });
});
