import { describe, it, expect } from 'vitest';
import {
  MAX_ATTACHMENTS_PER_PLAN,
  validateFileName,
  validateUploadRequest,
  validateConfirmRequest,
  isAttachmentKeyForPlan,
  buildAttachmentKey,
  isValidAttachmentId,
  toAttachment,
  buildContentDisposition,
} from './attachmentRules.mjs';

const UUID = '123e4567-e89b-42d3-a456-426614174000';

describe('attachment limit', () => {
  it('is one file per plan in V3-02', () => {
    expect(MAX_ATTACHMENTS_PER_PLAN).toBe(1);
  });
});

describe('validateFileName', () => {
  it('accepts a PDF name, including Thai, and cleans it', () => {
    expect(validateFileName('ใบรับรอง.PDF')).toEqual({ ok: true, value: 'ใบรับรอง.PDF' });
    expect(validateFileName(' a/b\\c.pdf ')).toEqual({ ok: true, value: 'a_b_c.pdf' });
  });

  it.each([undefined, null, 42, '', '   ', '\u0000'])('INVALID_FIELD for %j', (v) => {
    expect(validateFileName(v)).toMatchObject({ ok: false, code: 'INVALID_FIELD' });
  });

  it.each(['resume.docx', 'photo.png', 'noextension', 'evil.pdf.exe'])('ATTACHMENT_INVALID_TYPE for %s', (v) => {
    expect(validateFileName(v)).toMatchObject({ ok: false, code: 'ATTACHMENT_INVALID_TYPE' });
  });

  it('INVALID_FIELD over 200 characters; 200 is fine', () => {
    expect(validateFileName(`${'a'.repeat(196)}.pdf`).ok).toBe(true);
    expect(validateFileName(`${'a'.repeat(197)}.pdf`)).toMatchObject({ ok: false, code: 'INVALID_FIELD' });
  });
});

describe('validateUploadRequest (behaviour kept after sharing validateFileName)', () => {
  const ok = { fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 5 * 1024 * 1024 };

  it('accepts exactly 5 MB', () => {
    expect(validateUploadRequest(ok)).toEqual({ ok: true, value: { fileName: 'a.pdf', sizeBytes: 5 * 1024 * 1024 } });
  });

  it('checks name, then type, then size, in that order', () => {
    expect(validateUploadRequest({ ...ok, fileName: 'a.txt', contentType: 'x', sizeBytes: 0 }).code).toBe('ATTACHMENT_INVALID_TYPE');
    expect(validateUploadRequest({ ...ok, contentType: 'image/png', sizeBytes: 0 }).code).toBe('ATTACHMENT_INVALID_TYPE');
    expect(validateUploadRequest({ ...ok, sizeBytes: 0 }).code).toBe('INVALID_FIELD');
    expect(validateUploadRequest({ ...ok, sizeBytes: 5 * 1024 * 1024 + 1 }).code).toBe('ATTACHMENT_TOO_LARGE');
  });
});

describe('isAttachmentKeyForPlan', () => {
  it('accepts exactly the key buildAttachmentKey makes for that plan', () => {
    expect(isAttachmentKeyForPlan(7, buildAttachmentKey(7, UUID))).toBe(true);
  });

  it.each([
    ['another plan', `plans/8/${UUID}.pdf`],
    ['leading zeros', `plans/007/${UUID}.pdf`],
    ['a prefix of the id', `plans/70/${UUID}.pdf`],
    ['path traversal', `plans/7/../8/${UUID}.pdf`],
    ['an extra folder', `plans/7/x/${UUID}.pdf`],
    ['upper-case uuid', `plans/7/${UUID.toUpperCase()}.pdf`],
    ['wrong extension', `plans/7/${UUID}.exe`],
    ['a trailing newline', `plans/7/${UUID}.pdf\n`],
    ['a file-name based key', 'plans/7/evil.pdf'],
    ['empty', ''],
  ])('refuses %s', (_name, key) => {
    expect(isAttachmentKeyForPlan(7, key)).toBe(false);
  });

  it.each([null, undefined, 42, {}, []])('refuses a non-string %j', (key) => {
    expect(isAttachmentKeyForPlan(7, key)).toBe(false);
  });
});

describe('validateConfirmRequest', () => {
  it('accepts a key for this plan and a PDF name', () => {
    const key = buildAttachmentKey(7, UUID);
    expect(validateConfirmRequest({ key, fileName: 'a.pdf' }, 7)).toEqual({
      ok: true,
      value: { key, fileName: 'a.pdf' },
    });
  });

  it('INVALID_FIELD without a key, INVALID_ATTACHMENT_KEY for a key of another plan', () => {
    expect(validateConfirmRequest({ fileName: 'a.pdf' }, 7).code).toBe('INVALID_FIELD');
    expect(validateConfirmRequest({ key: `plans/8/${UUID}.pdf`, fileName: 'a.pdf' }, 7).code).toBe('INVALID_ATTACHMENT_KEY');
  });

  it('applies the file-name rules', () => {
    expect(validateConfirmRequest({ key: buildAttachmentKey(7, UUID), fileName: 'a.docx' }, 7).code).toBe('ATTACHMENT_INVALID_TYPE');
  });
});

describe('isValidAttachmentId', () => {
  it.each(['1', '42', ' 7 ', '2147483647'])('accepts %j', (v) => expect(isValidAttachmentId(v)).toBe(true));
  it.each(['0', '-1', '1.5', 'abc', '', ' ', '2147483648', null, undefined, 1])('refuses %j', (v) =>
    expect(isValidAttachmentId(v)).toBe(false),
  );
});

describe('toAttachment', () => {
  it('exposes the public fields only', () => {
    const shape = toAttachment({
      attachment_id: 3,
      plan_id: 7,
      s3_key: 'plans/7/x.pdf',
      file_name: 'a.pdf',
      content_type: 'application/pdf',
      size_bytes: 10,
      uploaded_by: 'sub-1',
      created_at: 'T',
    });
    expect(shape).toEqual({
      attachmentId: 3,
      planId: 7,
      fileName: 'a.pdf',
      contentType: 'application/pdf',
      sizeBytes: 10,
      createdAt: 'T',
    });
  });
});

describe('buildContentDisposition', () => {
  it('opens inline with an ASCII fallback and the real name encoded', () => {
    const header = buildContentDisposition('ใบรับรอง.pdf');
    expect(header).toMatch(/^inline; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
    expect(header).toContain(encodeURIComponent('ใบรับรอง.pdf'));
  });

  it('cannot break out of the quoted name or inject a header', () => {
    const header = buildContentDisposition('a"; x=y\r\nSet-Cookie: z.pdf');
    expect(header).not.toMatch(/[\r\n]/);
    const quoted = header.match(/filename="([^"]*)"/);
    expect(quoted).not.toBeNull();
  });

  it("percent-encodes the characters encodeURIComponent leaves alone: ' ( ) *", () => {
    expect(buildContentDisposition("a'(b)*.pdf")).toContain("filename*=UTF-8''a%27%28b%29%2A.pdf");
  });
});
