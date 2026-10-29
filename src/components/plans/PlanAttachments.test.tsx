
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import PlanAttachments, { errorText } from './PlanAttachments';
import { AttachmentApiError } from '../../data/attachmentApi';
import { listPlanAttachments } from '../../data/attachmentApi';

vi.mock('../../data/attachmentApi', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../data/attachmentApi')>();

  return {
    ...actual,
    listPlanAttachments: vi.fn(),
    uploadPlanAttachment: vi.fn(),
    deletePlanAttachment: vi.fn(),
    getAttachmentDownloadUrl: vi.fn(),
  };
});

// สร้าง error instance โดยไม่ต้องผูกกับ constructor ของ API
function makeApiError(status: number, code: string) {
  return Object.assign(
    Object.create(AttachmentApiError.prototype) as AttachmentApiError,
    {
      status,
      code,
      message: 'Backend error message in English',
    },
  );
}

describe('PlanAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('errorText', () => {
    it.each([
      [
        400,
        'ATTACHMENT_INVALID_TYPE',
        'ไฟล์ไม่ถูกประเภท กรุณาเลือก PDF เท่านั้น',
      ],
      [
        413,
        'ATTACHMENT_TOO_LARGE',
        'ไฟล์มีขนาดเกิน 5 MB กรุณาเลือกไฟล์ที่เล็กกว่านี้',
      ],
      [
        400,
        'ATTACHMENT_NOT_UPLOADED',
        'ยังอัปโหลดไฟล์ไม่สำเร็จหรือลิงก์อัปโหลดหมดอายุ กรุณาเลือกไฟล์และอัปโหลดใหม่',
      ],
      [
        404,
        'ATTACHMENT_NOT_FOUND',
        'ไม่พบไฟล์แนบนี้ อาจถูกลบไปแล้ว กรุณาโหลดหน้าใหม่',
      ],
      [
        409,
        'ATTACHMENT_LIMIT_REACHED',
        'แผนนี้มีไฟล์แนบครบจำนวนที่กำหนดแล้ว กรุณาโหลดหน้าใหม่',
      ],
    ])(
      'แสดงข้อความภาษาไทยสำหรับ %s / %s',
      (status, code, expected) => {
        expect(errorText(makeApiError(status, code))).toBe(expected);
      },
    );

    it('ใช้ข้อความเฉพาะ code ก่อน status 409', () => {
      const error = makeApiError(409, 'ATTACHMENT_LIMIT_REACHED');

      expect(errorText(error)).not.toBe(
        'แผนนี้แก้ไขไฟล์แนบไม่ได้แล้ว กรุณาโหลดหน้าใหม่',
      );
    });

    it('ไม่แสดงข้อความภาษาอังกฤษจาก Backend เมื่อไม่รู้จัก code', () => {
      expect(errorText(makeApiError(500, 'UNKNOWN_ERROR'))).toBe(
        'เกิดข้อผิดพลาดในการจัดการไฟล์ กรุณาลองอีกครั้ง',
      );
    });
  });

  it('แผนที่ยื่นแล้วเปิดดูไฟล์ได้ แต่ไม่มีปุ่มเพิ่มหรือลบ', async () => {
    vi.mocked(listPlanAttachments).mockResolvedValue({
    attachments: [
        {
        attachmentId: 1,
        planId: 123,
        fileName: 'transcript.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        createdAt: '2026-10-29T10:00:00.000Z',
        },
    ],
    maxFiles: 1,
    maxBytes: 5 * 1024 * 1024,
    });
    render(
      <PlanAttachments
        planId={123}
        status="SUBMITTED"
        getIdToken={async () => 'test-token'}
      />,
    );

    expect(await screen.findByText('transcript.pdf')).toBeInTheDocument();

    await waitFor(() => {
      expect(listPlanAttachments).toHaveBeenCalledWith(
        123,
        'test-token',
      );
    });

    expect(
      screen.getByRole('button', { name: /เปิดไฟล์/ }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: /^ลบ$/ }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: /เลือกไฟล์ PDF/ }),
    ).not.toBeInTheDocument();
  });
});
