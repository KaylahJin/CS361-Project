
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MAX_BYTES = 5 * 1024 * 1024;

export interface PlanAttachment {
  attachmentId: number;
  planId: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export class AttachmentApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'AttachmentApiError';
    this.status = status;
    this.code = code;
  }
}

async function apiRequest<T>(
  path: string,
  token: string | null | undefined,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (init?.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const code =
      typeof data?.code === 'string' ? data.code : undefined;

    const message =
      typeof data?.message === 'string'
        ? data.message
        : 'ทำรายการไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง';

    throw new AttachmentApiError(
      message,
      response.status,
      code,
    );
  }

  return data as T;
}

export async function listPlanAttachments(
  planId: number,
  token?: string | null,
) {
  return apiRequest<{
    attachments: PlanAttachment[];
    maxFiles: number;
    maxBytes: number;
  }>(
    `/coop-plans/${planId}/attachments`,
    token,
  );
}

export async function uploadPlanAttachment(
  planId: number,
  file: File,
  token?: string | null,
): Promise<PlanAttachment> {
  if (
    file.type !== 'application/pdf' ||
    !file.name.toLowerCase().endsWith('.pdf')
  ) {
    throw new AttachmentApiError(
      'กรุณาเลือกไฟล์ PDF เท่านั้น',
      400,
      'ATTACHMENT_INVALID_TYPE',
    );
  }

  if (file.size <= 0) {
    throw new AttachmentApiError(
      'ไฟล์ว่างเปล่า กรุณาเลือกไฟล์อื่น',
      400,
    );
  }

  if (file.size > MAX_BYTES) {
    throw new AttachmentApiError(
      'ไฟล์มีขนาดเกิน 5 MB กรุณาเลือกไฟล์ที่เล็กกว่านี้',
      400,
      'ATTACHMENT_TOO_LARGE',
    );
  }

  // Step 1: ขอ presigned POST URL จาก Backend
  const signed = await apiRequest<{
    url: string;
    fields: Record<string, string>;
    key: string;
    fileName: string;
  }>(
    `/coop-plans/${planId}/attachments/upload-url`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: 'application/pdf',
        sizeBytes: file.size,
      }),
    },
  );

  // Step 2: ส่ง fields และไฟล์ไป S3 โดยตรง
  const form = new FormData();

  Object.entries(signed.fields).forEach(([key, value]) => {
    form.append(key, value);
  });

  form.append('file', file);

  const s3Response = await fetch(signed.url, {
    method: 'POST',
    body: form,
  });

  if (!s3Response.ok) {
    throw new AttachmentApiError(
      'อัปโหลดไปยังพื้นที่จัดเก็บไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      s3Response.status,
    );
  }

  // Step 3: ให้ Backend ตรวจไฟล์ใน S3 และบันทึก metadata
  return apiRequest<PlanAttachment>(
    `/coop-plans/${planId}/attachments`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        key: signed.key,
        fileName: signed.fileName,
      }),
    },
  );
}

export async function getAttachmentDownloadUrl(
  planId: number,
  attachmentId: number,
  token?: string | null,
) {
  return apiRequest<{
    url: string;
    fileName: string;
    expiresInSeconds: number;
  }>(
    `/coop-plans/${planId}/attachments/${attachmentId}/download-url`,
    token,
  );
}

export async function deletePlanAttachment(
  planId: number,
  attachmentId: number,
  token?: string | null,
) {
  return apiRequest<{
    deleted: boolean;
    attachmentId: number;
  }>(
    `/coop-plans/${planId}/attachments/${attachmentId}`,
    token,
    {
      method: 'DELETE',
    },
  );
}
