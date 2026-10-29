// DELETE /coop-plans/{planId}/attachments/{attachmentId} — the owner removes a
// file from their own plan.
//
// Order of refusals:
//   400 planId or attachmentId is not a positive integer
//   401/403 identity
//   404 no such plan
//   403 not a student, or not the owner
//   409 plan status is not PREPARING / RETURNED          (under a row lock)
//   404 the plan has no such file
//
// The row is deleted with the plan id in the WHERE, so an attachmentId that
// belongs to another plan answers 404 and nothing is touched.
//
// The database row goes first and the S3 object after the commit. If the S3
// call fails the student has still lost the file, as asked, and what is left is
// an unreachable private object (see confirmAttachment.mjs). The other order
// could leave a row pointing at nothing, which the student would see as a
// broken file.

import { withEditablePlan } from './attachmentGuard.mjs';
import { jsonResponse } from './response.mjs';
import { isValidPlanId } from './planQueries.mjs';
import { errorResponse } from './planHttp.mjs';
import { isValidAttachmentId } from './attachmentRules.mjs';
import { deleteObject } from './s3.mjs';

const LABEL = 'deleteAttachment';

const DELETE_ATTACHMENT = `DELETE FROM plan_attachments
WHERE attachment_id = $1 AND plan_id = $2
RETURNING s3_key`;

export async function deleteAttachment(event) {
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

  return withEditablePlan({
    event,
    label: LABEL,
    planId,
    work: async ({ client }) => {
      const deleted = await client.query(DELETE_ATTACHMENT, [attachmentId, planId]);

      if (deleted.rowCount === 0) {
        return {
          response: errorResponse(404, 'ATTACHMENT_NOT_FOUND', 'This plan has no such file.'),
          commit: false,
        };
      }

      const { s3_key: key } = deleted.rows[0];
      return {
        response: jsonResponse(200, { deleted: true, attachmentId }),
        commit: true,
        afterCommit: () => deleteObject(key),
      };
    },
  });
}
