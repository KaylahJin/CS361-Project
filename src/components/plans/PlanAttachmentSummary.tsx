import { useEffect, useState } from 'react';
import {
  Paperclip,
  FileText,
  ExternalLink,
  Loader2,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';

import {
  listPlanAttachments,
  getAttachmentDownloadUrl,
  type PlanAttachment,
} from '../../data/attachmentApi';

type Props = {
  planId: number;
  getIdToken: () => Promise<string | null>;
  showEditHint?: boolean;
};

export default function PlanAttachmentSummary({
  planId,
  getIdToken,
  showEditHint = true,
}: Props) {
  const [attachments, setAttachments] = useState<PlanAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAttachments() {
      setLoading(true);
      setError('');

      try {
        const token = await getIdToken();

        if (!token) {
          throw new Error('ไม่พบ token สำหรับยืนยันตัวตน');
        }

        const result = await listPlanAttachments(planId, token);

        if (!cancelled) {
          setAttachments(result.attachments);
        }
      } catch {
        if (!cancelled) {
          setError('ไม่สามารถโหลดรายการเอกสารแนบได้ กรุณาลองใหม่อีกครั้ง');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAttachments();

    return () => {
      cancelled = true;
    };
  }, [planId, getIdToken]);

  async function handleOpenFile(attachment: PlanAttachment) {
    setOpeningId(attachment.attachmentId);
    setError('');

    try {
      const token = await getIdToken();

      if (!token) {
        throw new Error('ไม่พบ token สำหรับยืนยันตัวตน');
      }

      const result = await getAttachmentDownloadUrl(
        planId,
        attachment.attachmentId,
        token,
      );

      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch {
      setError(
        'ไม่สามารถเปิดไฟล์ได้ หรือบัญชีของคุณไม่มีสิทธิ์เข้าถึงไฟล์นี้',
      );
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <section
      className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby="plan-attachment-heading"
    >
      {/* Card heading */}
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-blue-50 p-3">
          <Paperclip className="h-5 w-5 text-blue-600" />
        </div>

        <div>
          <h2
            id="plan-attachment-heading"
            className="font-bold text-slate-800"
          >
            เอกสารแนบ
          </h2>

          <p className="text-xs text-slate-400">
            Plan Documents
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-500"
        >
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          กำลังโหลดรายการเอกสารแนบ...
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />

          <div>
            <p className="text-sm font-semibold text-red-700">
              โหลดเอกสารไม่สำเร็จ
            </p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && attachments.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
            <FolderOpen className="h-6 w-6" />
          </div>

          <p className="text-sm font-semibold text-slate-700">
            ยังไม่ได้แนบไฟล์
          </p>

            {showEditHint && (
            <p className="mt-1 text-xs text-slate-500">
                หากต้องการเพิ่มเอกสาร สามารถไปที่หน้าแก้ไขแผนได้
            </p>
            )}
        </div>
      )}

      {/* Attachment list */}
      {!loading && attachments.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              เอกสารประกอบแผนสหกิจศึกษา
            </p>

            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {attachments.length} ไฟล์
            </span>
          </div>

          <ul className="space-y-3">
            {attachments.map((attachment) => (
              <li
                key={attachment.attachmentId}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <p
                      className="break-words text-sm font-semibold text-slate-800"
                      title={attachment.fileName}
                    >
                      {attachment.fileName}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      เอกสารประกอบแผน
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleOpenFile(attachment)}
                  disabled={openingId !== null}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {openingId === attachment.attachmentId ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังเปิด...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4" />
                      เปิดไฟล์
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}