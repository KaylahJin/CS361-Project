
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  UploadCloud,
} from 'lucide-react';

import {
  AttachmentApiError,
  deletePlanAttachment,
  getAttachmentDownloadUrl,
  listPlanAttachments,
  uploadPlanAttachment,
  type PlanAttachment,
} from '../../data/attachmentApi';

interface Props {
  planId: number;
  status: string;
  getIdToken: () => Promise<string | null>;
}

const MAX_BYTES = 5 * 1024 * 1024;

const formatSize = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const errorText = (error: unknown) => {
  if (error instanceof AttachmentApiError) {
    if (error.code === 'ATTACHMENT_INVALID_TYPE') {
      return 'ไฟล์ไม่ถูกประเภท กรุณาเลือก PDF เท่านั้น';
    }

    if (error.code === 'ATTACHMENT_TOO_LARGE') {
      return 'ไฟล์มีขนาดเกิน 5 MB กรุณาเลือกไฟล์ที่เล็กกว่านี้';
    }

    if (error.status === 401) {
      return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
    }

    if (error.status === 403) {
      return 'คุณไม่มีสิทธิ์ดำเนินการกับไฟล์ของแผนนี้';
    }

    if (error.status === 409) {
      return 'แผนนี้แก้ไขไฟล์แนบไม่ได้แล้ว กรุณาโหลดหน้าใหม่';
    }

    return error.message;
  }

  return 'เกิดข้อผิดพลาดในการจัดการไฟล์ กรุณาลองอีกครั้ง';
};

export default function PlanAttachments({
  planId,
  status,
  getIdToken,
}: Props) {
  const [attachments, setAttachments] = useState<PlanAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const editable =
    status === 'PREPARING' || status === 'RETURNED';

  // โหลดไฟล์จาก Backend ทุกครั้งที่เปิดหน้า
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const result = await listPlanAttachments(planId, token);

      setAttachments(result.attachments);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [getIdToken, planId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onFileSelected = async (file?: File) => {
    if (!file) return;

    setError(null);
    setMessage(null);

    if (!editable) {
      setError('แผนที่ยื่นแล้วไม่สามารถเพิ่มหรือลบไฟล์แนบได้');

      if (inputRef.current) {
        inputRef.current.value = '';
      }

      return;
    }

    if (attachments.length >= 1) {
      setError('แนบได้ครั้งละ 1 ไฟล์ กรุณาลบไฟล์เดิมก่อน');

      if (inputRef.current) {
        inputRef.current.value = '';
      }

      return;
    }

    if (
      file.type !== 'application/pdf' ||
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setError('ไฟล์ไม่ถูกประเภท กรุณาเลือก PDF เท่านั้น');

      if (inputRef.current) {
        inputRef.current.value = '';
      }

      return;
    }

    if (file.size <= 0 || file.size > MAX_BYTES) {
      setError(
        file.size > MAX_BYTES
          ? 'ไฟล์มีขนาดเกิน 5 MB กรุณาเลือกไฟล์ที่เล็กกว่านี้'
          : 'ไฟล์ว่างเปล่า กรุณาเลือกไฟล์อื่น',
      );

      if (inputRef.current) {
        inputRef.current.value = '';
      }

      return;
    }

    setBusy(true);

    try {
      const token = await getIdToken();

      await uploadPlanAttachment(planId, file, token);

      await refresh();

      setMessage(
        'แนบไฟล์เรียบร้อยแล้ว ไฟล์จะยังอยู่เมื่อกลับมาเปิดแผนนี้อีกครั้ง',
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  // ขอ URL สำหรับเปิดไฟล์ ไม่เปิด S3 bucket เป็นสาธารณะ
  const onDownload = async (attachment: PlanAttachment) => {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const token = await getIdToken();

      const result = await getAttachmentDownloadUrl(
        planId,
        attachment.attachmentId,
        token,
      );

      window.open(
        result.url,
        '_blank',
        'noopener,noreferrer',
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (attachment: PlanAttachment) => {
    if (
      !editable ||
      !window.confirm(
        `ยืนยันลบไฟล์ “${attachment.fileName}” หรือไม่?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const token = await getIdToken();

      await deletePlanAttachment(
        planId,
        attachment.attachmentId,
        token,
      );

      await refresh();

      setMessage('ลบไฟล์แนบเรียบร้อยแล้ว');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="plan-attachments-heading"
      className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
          <Paperclip className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h2
            id="plan-attachments-heading"
            className="text-base font-bold text-slate-900"
          >
            เอกสารแนบประกอบแผน
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            รองรับไฟล์ PDF เท่านั้น ขนาดไม่เกิน 5 MB · แนบได้ 1 ไฟล์
          </p>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {message}
        </p>
      )}

      {loading ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          กำลังโหลดไฟล์แนบ...
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {attachments.map((attachment) => (
            <div
              key={attachment.attachmentId}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center"
            >
              <FileText className="h-8 w-8 shrink-0 text-red-500" />

              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold text-slate-800">
                  {attachment.fileName}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {formatSize(attachment.sizeBytes)}
                  {' · แนบเมื่อ '}
                  {new Date(attachment.createdAt).toLocaleString('th-TH')}
                </p>
              </div>

              <div className="flex gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => void onDownload(attachment)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  เปิดไฟล์
                </button>

                {editable && (
                  <button
                    type="button"
                    onClick={() => void onDelete(attachment)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    ลบ
                  </button>
                )}
              </div>
            </div>
          ))}

          {attachments.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              ยังไม่มีไฟล์แนบ
            </p>
          )}
        </div>
      )}

      {editable && attachments.length === 0 && !loading && (
        <div className="mt-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 p-4 text-center sm:p-6">
          <UploadCloud className="mx-auto h-8 w-8 text-blue-600" />

          <p className="mt-2 text-sm font-semibold text-slate-800">
            เลือก PDF เพื่อแนบกับแผนนี้
          </p>

          <p className="mt-1 text-xs text-slate-500">
            ไฟล์จะถูกบันทึกในระบบและแสดงเมื่อเปิดหน้านี้อีกครั้ง
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="เลือกไฟล์ PDF"
            onChange={(event) =>
              void onFileSelected(event.target.files?.[0])
            }
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                กำลังอัปโหลด...
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                เลือกไฟล์ PDF
              </>
            )}
          </button>
        </div>
      )}

      {!editable && (
        <p className="mt-4 text-xs text-slate-500">
          แผนสถานะ {status} เปิดดูไฟล์ได้ แต่เพิ่มหรือลบไฟล์ไม่ได้
        </p>
      )}
    </section>
  );
}
