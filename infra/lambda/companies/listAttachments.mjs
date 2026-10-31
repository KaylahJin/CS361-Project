// GET /coop-plans/{planId}/attachments — the files attached to a plan.
//
// Kept apart from GET /coop-plans/{planId} on purpose: that query joins four
// tables and is the most-called one, so it is not made heavier for a list the
// page needs only on the edit screen. This one is a single read of a small
// indexed table and signs nothing: the S3 key stays on the server and a link
// is made only when someone opens a file (downloadAttachmentUrl.mjs), so a list
// the person never clicks costs no more than the query.
//
// Whoever may view the plan may list its files (authorize.mjs assertCanViewPlan:
// the owner, an assigned advisor, staff). Order of refusals:
//   400 planId is not a positive integer
//   401/403 identity
//   404 no such plan
//   403 not allowed to view this plan

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { assertCanViewPlan } from './authorize.mjs';
import { isValidPlanId } from './planQueries.mjs';
import { errorResponse, internalError, forbiddenFrom, resolveCaller } from './planHttp.mjs';
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_PLAN, toAttachment } from './attachmentRules.mjs';

const LABEL = 'listAttachments';

// Only what authorization needs, not the four-table plan projection.
// status: the committee may only see plans that passed screening (assertCanViewPlan).
const SELECT_PLAN_OWNER = `SELECT plan_id, student_id, status FROM coop_plans WHERE plan_id = $1`;

const SELECT_ATTACHMENTS = `SELECT attachment_id, plan_id, file_name, content_type, size_bytes, created_at
FROM plan_attachments
WHERE plan_id = $1
ORDER BY attachment_id`;

export async function listAttachments(event) {
  const rawPlanId = event?.pathParameters?.planId;
  if (!isValidPlanId(rawPlanId)) {
    return errorResponse(400, 'INVALID_PLAN_ID', 'planId must be a positive integer.');
  }
  const planId = Number(rawPlanId.trim());

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

    const rows = (await getPool().query(SELECT_ATTACHMENTS, [planId])).rows;
    return jsonResponse(200, {
      attachments: rows.map(toAttachment),
      maxFiles: MAX_ATTACHMENTS_PER_PLAN,
      maxBytes: MAX_ATTACHMENT_BYTES,
    });
  } catch (err) {
    console.error(`${LABEL} failed`, err);
    return internalError();
  }
}
