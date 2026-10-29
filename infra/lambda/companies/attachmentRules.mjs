// Rules for plan attachments, shared by every attachment handler.
// Pure functions, so every rule is testable without S3 or a database.

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // D8: 5 MB
export const ALLOWED_CONTENT_TYPE = 'application/pdf';
export const MAX_FILE_NAME_LENGTH = 200;

// Seconds a presigned upload stays valid.
export const UPLOAD_URL_TTL_SECONDS = 300;

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
 * @returns {{ok: true, value: {fileName: string, sizeBytes: number}}
 *         | {ok: false, code: string, message: string}}
 */
export function validateUploadRequest(body) {
  const { fileName, contentType, sizeBytes } = body;

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

  return { ok: true, value: { fileName: name, sizeBytes } };
}

/** The key is built from the plan id and a random id only. */
export function buildAttachmentKey(planId, uuid) {
  return `plans/${planId}/${uuid}.pdf`;
}