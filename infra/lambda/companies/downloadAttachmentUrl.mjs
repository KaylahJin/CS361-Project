// GET /coop-plans/{planId}/attachments/{attachmentId}/download-url — a
// short-lived link to open one file. The bucket is private, so this is the only
// way a file is ever read.
//
// Same permission as listing: whoever may view the plan. Order of refusals:
//   400 planId or attachmentId is not a positive integer
//   401/403 identity
//   404 no such plan
//   403 not allowed to view this plan
//   404 the plan has no such file
//
// The file is looked up by attachmentId AND planId, so a student cannot reach
// another plan's file by pairing their own plan id with someone else's
// attachment id. Signing the link is local arithmetic; S3 is not called.

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { assertCanViewPlan } from './authorize.mjs';
import { isValidPlanId } from './planQueries.mjs';
import { errorResponse, internalError, forbiddenFrom, resolveCaller } from './planHttp.mjs';
import { DOWNLOAD_URL_TTL_SECONDS, isValidAttachmentId } from './attachmentRules.mjs';
import { presignDownload } from './s3.mjs';

const LABEL = 'downloadAttachmentUrl';

const SELECT_PLAN_OWNER = `SELECT plan_id, student_id FROM coop_plans WHERE plan_id = $1`;

const SELECT_ATTACHMENT = `SELECT attachment_id, s3_key, file_name
FROM plan_attachments
WHERE attachment_id = $1 AND plan_id = $2`;

export async function downloadAttachmentUrl(event) {
  const rawPlanId = event?.pathParameters?.planId;
  if (!isValidPlanId(rawPlanId)) {
    return errorResponse(400, 'INVALID_PLAN_ID', 'planId must be a positive integer.');
  }
  const rawAttachmentId = event?.pathParameters?.attachmentId;
  if (!isValidAttachmentId(rawAttachmentId)) {
    return errorResponse(400, 'INVALID_ATTACHMENT_ID', 'attachmentId must be a positive integer.');
  }
  const planId = Number(rawPlanId.trim());
  const attachmentId = Number(rawAttachmentId.trim());

  const caller = await resolveCaller(event, LABEL);
  if (caller.response) return caller.response;
  const { user } = caller;

  try {
    const plan = (await getPool().query(SELECT_PLAN_OWNER, [planId])).rows[0];
    if (!plan) return errorResponse(404, 'PLAN_NOT_FOUND', 'Coop plan not found.');

    try {
      await assertCanViewPlan(user, plan);
    } catch (err) {
      return forbiddenFrom(err, LABEL);
    }

    const attachment = (await getPool().query(SELECT_ATTACHMENT, [attachmentId, planId])).rows[0];
    if (!attachment) {
      return errorResponse(404, 'ATTACHMENT_NOT_FOUND', 'This plan has no such file.');
    }

    const url = await presignDownload({
      key: attachment.s3_key,
      fileName: attachment.file_name,
      expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    });

    return jsonResponse(200, {
      url,
      fileName: attachment.file_name,
      expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    });
  } catch (err) {
    console.error(`${LABEL} failed`, err);
    return internalError();
  }
}
