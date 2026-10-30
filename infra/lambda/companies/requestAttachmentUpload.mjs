// POST /coop-plans/{planId}/attachments/upload-url — asks for permission to
// upload one PDF to a plan.
//
// Order of refusals (same as updateCoopPlan):
//   400 planId is not a positive integer
//   401/403 identity
//   404 no such plan
//   403 not a student, or not the owner
//   409 plan status is not PREPARING / RETURNED
//   400 body is malformed, not a PDF, or over 5 MB
//
// Nothing is written to the database here. The row is recorded by the confirm
// step after the browser has uploaded the file, so a half-finished upload
// leaves no row behind.
//
// The status is checked again at confirm and delete: a plan can be submitted
// between "ask for a URL" and "finish uploading", and only those later checks
// close that gap.

import { randomUUID } from 'node:crypto';
import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { assertCanEditPlan } from './authorize.mjs';
import { isEditableStatus, EDITABLE_PLAN_STATUSES } from './planWorkflow.mjs';
import { SELECT_PLAN_BY_ID, isValidPlanId } from './planQueries.mjs';
import { parseJsonObject, findUnknownField } from './requestBody.mjs';
import { errorResponse, internalError, forbiddenFrom, resolveCaller } from './planHttp.mjs';
import {
  ALLOWED_CONTENT_TYPE,
  MAX_ATTACHMENT_BYTES,
  UPLOAD_URL_TTL_SECONDS,
  validateUploadRequest,
  buildAttachmentKey,
} from './attachmentRules.mjs';
import { presignUpload } from './s3.mjs';

const LABEL = 'requestAttachmentUpload';
const ALLOWED_FIELDS = ['fileName', 'contentType', 'sizeBytes'];

export async function requestAttachmentUpload(event) {
  const rawPlanId = event?.pathParameters?.planId;
  if (!isValidPlanId(rawPlanId)) {
    return errorResponse(400, 'INVALID_PLAN_ID', 'planId must be a positive integer.');
  }
  const planId = Number(rawPlanId.trim());

  const caller = await resolveCaller(event, LABEL);
  if (caller.response) return caller.response;
  const { user } = caller;

  let plan;
  try {
    const found = await getPool().query(SELECT_PLAN_BY_ID, [planId]);
    plan = found.rows[0];
  } catch (err) {
    console.error(`${LABEL} read failed`, err);
    return internalError();
  }
  if (!plan) return errorResponse(404, 'PLAN_NOT_FOUND', 'Coop plan not found.');

  // Same rule as editing the plan: only the owning student attaches files.
  try {
    assertCanEditPlan(user, plan);
  } catch (err) {
    return forbiddenFrom(err, LABEL);
  }

  // Allow-list, not block-list: any status we do not know about (ENDORSED,
  // ELIGIBLE, SELECTED, ...) is refused without this file being edited.
  if (!isEditableStatus(plan.status)) {
    return errorResponse(
      409,
      'PLAN_NOT_EDITABLE',
      `A plan in status ${plan.status} cannot have files attached. Only ${EDITABLE_PLAN_STATUSES.join(' or ')} plans can.`,
    );
  }

  const parsed = parseJsonObject(event);
  if (!parsed.ok) return errorResponse(400, 'INVALID_BODY', parsed.message);

  const unknown = findUnknownField(parsed.value, ALLOWED_FIELDS);
  if (unknown !== null) {
    return errorResponse(
      400,
      'UNKNOWN_FIELD',
      `Field "${unknown}" is not accepted. Allowed fields: ${ALLOWED_FIELDS.join(', ')}.`,
    );
  }

  const checked = validateUploadRequest(parsed.value);
  if (!checked.ok) return errorResponse(400, checked.code, checked.message);

  try {
    const key = buildAttachmentKey(planId, randomUUID());
    const presigned = await presignUpload({
      key,
      contentType: ALLOWED_CONTENT_TYPE,
      maxBytes: MAX_ATTACHMENT_BYTES,
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });

    return jsonResponse(200, {
      url: presigned.url,
      fields: presigned.fields,
      key,
      fileName: checked.value.fileName,
      maxBytes: MAX_ATTACHMENT_BYTES,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });
  } catch (err) {
    console.error(`${LABEL} failed`, err);
    return internalError();
  }
}