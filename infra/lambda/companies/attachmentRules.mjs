// Rules for plan attachments, shared by every attachment handler.
// Pure functions, so every rule is testable without S3 or a database.

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // D8: 5 MB
export const ALLOWED_CONTENT_TYPE = 'application/pdf';
export const MAX_FILE_NAME_LENGTH = 200;

// V3-02 accepts one file per plan. The photo / transcript / resume split comes
// in a later version; raising this number is the only change the server needs
// for the limit itself.
export const MAX_ATTACHMENTS_PER_PLAN = 1;

// Seconds a presigned upload / download link stays valid.
export const UPLOAD_URL_TTL_SECONDS = 300;
export const DOWNLOAD_URL_TTL_SECONDS = 300;

const MAX_INT4 = 2147483647;

// plans/{planId}/{uuid}.pdf — the shape buildAttachmentKey produces.
const KEY_PATTERN =
  /^plans\/(\d+)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

/**
 * Keeps only a display-safe file name. The name is shown to people and stored
 * in the database, but it is NEVER used in the S3 key, so this is about
 * cleanliness, not path safety.
 */
export function cleanFileName(name) {
  return String(name)
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
}

/**
 * The file-name rules, shared by "ask for an upload URL" and "confirm upload".
 *
 * @returns {{ok: true, value: string}
 *         | {ok: false, code: string, message: string}}
 */
export function validateFileName(fileName) {
  if (typeof fileName !== 'string' || cleanFileName(fileName) === '') {
    return { ok: false, code: 'INVALID_FIELD', message: 'fileName is required.' };
  }
  const name = cleanFileName(fileName);
  if (name.length > MAX_FILE_NAME_LENGTH) {
    return {
      ok: false,
      code: 'INVALID_FIELD',
      message: `fileName must be at most ${MAX_FILE_NAME_LENGTH} characters.`,
    };
  }
  if (!/\.pdf$/i.test(name)) {
    return {
      ok: false,
      code: 'ATTACHMENT_INVALID_TYPE',
      message: 'Only PDF files (.pdf) are accepted.',
    };
  }
  return { ok: true, value: name };
}

/**
 * @returns {{ok: true, value: {fileName: string, sizeBytes: number}}
 *         | {ok: false, code: string, message: string}}
 */
export function validateUploadRequest(body) {
  const { fileName, contentType, sizeBytes } = body;

  const named = validateFileName(fileName);
  if (!named.ok) return named;

  if (contentType !== ALLOWED_CONTENT_TYPE) {
    return {
      ok: false,
      code: 'ATTACHMENT_INVALID_TYPE',
      message: 'Only application/pdf is accepted.',
    };
  }

  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    return {
      ok: false,
      code: 'INVALID_FIELD',
      message: 'sizeBytes must be a positive integer.',
    };
  }
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      code: 'ATTACHMENT_TOO_LARGE',
      message: `The file is larger than ${MAX_ATTACHMENT_BYTES} bytes (5 MB).`,
    };
  }

  return { ok: true, value: { fileName: named.value, sizeBytes } };
}

/** The key is built from the plan id and a random id only. */
export function buildAttachmentKey(planId, uuid) {
  return `plans/${planId}/${uuid}.pdf`;
}

/**
 * True only for a key this server could have issued for THIS plan. Confirm
 * takes the key from the client, so without this a student could register a
 * file that belongs to someone else's plan, or any other object in the bucket.
 */
export function isAttachmentKeyForPlan(planId, key) {
  if (typeof key !== 'string') return false;
  const match = KEY_PATTERN.exec(key);
  return match !== null && match[1] === String(planId);
}

/**
 * Body of "confirm upload": the key the browser just uploaded to, and the file
 * name to show.
 *
 * @returns {{ok: true, value: {key: string, fileName: string}}
 *         | {ok: false, code: string, message: string}}
 */
export function validateConfirmRequest(body, planId) {
  if (typeof body.key !== 'string' || body.key.trim() === '') {
    return { ok: false, code: 'INVALID_FIELD', message: 'key is required.' };
  }
  if (!isAttachmentKeyForPlan(planId, body.key)) {
    return {
      ok: false,
      code: 'INVALID_ATTACHMENT_KEY',
      message: 'key is not an upload key issued for this plan.',
    };
  }

  const named = validateFileName(body.fileName);
  if (!named.ok) return named;

  return { ok: true, value: { key: body.key, fileName: named.value } };
}

/** attachment_id is an INTEGER column, so a non-numeric id is refused before pg sees it. */
export function isValidAttachmentId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return false;
  const n = Number(value.trim());
  return n >= 1 && n <= MAX_INT4;
}

/** Row -> API shape. s3_key and uploaded_by stay on the server. */
export function toAttachment(row) {
  return {
    attachmentId: row.attachment_id,
    planId: row.plan_id,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

/**
 * Content-Disposition for the download link: opens the PDF in the browser and
 * keeps the original name. The quoted form is an ASCII fallback; filename*
 * (RFC 5987) carries the real name, Thai included.
 */
export function buildContentDisposition(fileName) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
