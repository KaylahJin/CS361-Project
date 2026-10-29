// POST /coop-plans/{planId}/attachments — "the browser has uploaded the file to
// S3, record it". Body: { key, fileName }, both from the upload-url answer.
//
// Order of refusals (attachmentGuard.mjs, then this file):
//   400 planId is not a positive integer
//   401/403 identity
//   404 no such plan
//   403 not a student, or not the owner
//   409 plan status is not PREPARING / RETURNED          (under a row lock)
//   400 body is malformed or the key is not one issued for this plan
//   200 the same key was already confirmed — answers with the existing row
//   409 the plan already has the maximum number of files
//   400 S3 has no such object, or it is not a PDF within 5 MB
//
// The limit and the S3 check come AFTER the status check, so a plan that can no
// longer be edited never reveals anything about its files.
//
// The size and type recorded are what S3 reports, not what the client claimed.
// The presigned POST already makes S3 enforce both, so the check here is a
// second lock on the same door, not the first one.
//
// A file uploaded to S3 and never confirmed (the student closed the tab, or the
// limit was hit) leaves an object with no row. It is unreachable: nothing links
// to it and the bucket is private. An S3 lifecycle rule on plans/ can sweep them.

import { withEditablePlan } from './attachmentGuard.mjs';
import { jsonResponse } from './response.mjs';
import { isValidPlanId } from './planQueries.mjs';
import { parseJsonObject, findUnknownField } from './requestBody.mjs';
import { errorResponse } from './planHttp.mjs';
import {
  ALLOWED_CONTENT_TYPE,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_PLAN,
  validateConfirmRequest,
  toAttachment,
} from './attachmentRules.mjs';
import { headObject } from './s3.mjs';

const LABEL = 'confirmAttachment';
const ALLOWED_FIELDS = ['key', 'fileName'];

const SELECT_PLAN_ATTACHMENTS = `SELECT attachment_id, plan_id, s3_key, file_name, content_type, size_bytes, created_at
FROM plan_attachments
WHERE plan_id = $1
ORDER BY attachment_id`;

const INSERT_ATTACHMENT = `INSERT INTO plan_attachments (plan_id, s3_key, file_name, content_type, size_bytes, uploaded_by)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING attachment_id, plan_id, file_name, content_type, size_bytes, created_at`;

const refuse = (response) => ({ response, commit: false });

export async function confirmAttachment(event) {
  const rawPlanId = event?.pathParameters?.planId;
  if (!isValidPlanId(rawPlanId)) {
    return errorResponse(400, 'INVALID_PLAN_ID', 'planId must be a positive integer.');
  }
  const planId = Number(rawPlanId.trim());

  return withEditablePlan({
    event,
    label: LABEL,
    planId,
    work: async ({ client, user }) => {
      const parsed = parseJsonObject(event);
      if (!parsed.ok) return refuse(errorResponse(400, 'INVALID_BODY', parsed.message));

      const unknown = findUnknownField(parsed.value, ALLOWED_FIELDS);
      if (unknown !== null) {
        return refuse(
          errorResponse(
            400,
            'UNKNOWN_FIELD',
            `Field "${unknown}" is not accepted. Allowed fields: ${ALLOWED_FIELDS.join(', ')}.`,
          ),
        );
      }

      const checked = validateConfirmRequest(parsed.value, planId);
      if (!checked.ok) return refuse(errorResponse(400, checked.code, checked.message));
      const { key, fileName } = checked.value;

      // One small indexed read answers both "already confirmed?" and "how many?".
      const existing = (await client.query(SELECT_PLAN_ATTACHMENTS, [planId])).rows;

      // Confirm is safe to repeat (a retry after a dropped response): the same
      // key gives back the row it already made instead of a second one.
      const same = existing.find((row) => row.s3_key === key);
      if (same) return { response: jsonResponse(200, toAttachment(same)), commit: false };

      if (existing.length >= MAX_ATTACHMENTS_PER_PLAN) {
        return refuse(
          errorResponse(
            409,
            'ATTACHMENT_LIMIT_REACHED',
            `A plan can have at most ${MAX_ATTACHMENTS_PER_PLAN} file(s). Delete the current file before adding another.`,
          ),
        );
      }

      const object = await headObject(key);

      if (!object) {
        return refuse(
          errorResponse(
            400,
            'ATTACHMENT_NOT_UPLOADED',
            'No uploaded file was found for this key. Upload the file first; the upload link may have expired.',
          ),
        );
      }
      if (object.contentType !== ALLOWED_CONTENT_TYPE) {
        return refuse(errorResponse(400, 'ATTACHMENT_INVALID_TYPE', 'Only application/pdf is accepted.'));
      }
      if (!Number.isInteger(object.sizeBytes) || object.sizeBytes <= 0) {
        return refuse(errorResponse(400, 'ATTACHMENT_NOT_UPLOADED', 'The uploaded file is empty.'));
      }
      if (object.sizeBytes > MAX_ATTACHMENT_BYTES) {
        return refuse(
          errorResponse(
            400,
            'ATTACHMENT_TOO_LARGE',
            `The file is larger than ${MAX_ATTACHMENT_BYTES} bytes (5 MB).`,
          ),
        );
      }

      const inserted = await client.query(INSERT_ATTACHMENT, [
        planId,
        key,
        fileName,
        ALLOWED_CONTENT_TYPE,
        object.sizeBytes,
        user.sub,
      ]);

      return { response: jsonResponse(201, toAttachment(inserted.rows[0])), commit: true };
    },
  });
}
