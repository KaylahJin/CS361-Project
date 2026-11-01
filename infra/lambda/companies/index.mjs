// ============================================================
// CS361 V2 — Companies Lambda entry point / router
// ============================================================
// Issue: #26 — ทำการเรียกข้อมูลสถานประกอบการ
//
// Deployed as Lambda handler `index.handler` on the Node.js 20.x runtime
// (see docs/aws-lambda-setup-guide.md step 3). Because the sibling
// package.json declares "type": "module", the runtime resolves
// `index.handler` to the exported `handler` in this index.mjs file.
//
// Dispatch is on event.routeKey, the API Gateway HTTP API payload
// format 2.0 field, whose value is the literal route as configured on the
// API ('GET /companies', 'GET /companies/{companyId}') — not the resolved
// request path.
//
// Unmatched routeKey -> 404 { error: 'Not found' }.
//   The contract does not specify this case and API Gateway can never
//   actually trigger it (only the two routes wired in step 5 invoke this
//   function). 404 is chosen over 500 because an unrecognized route is a
//   request-addressing problem, not a server fault — a 500 here would
//   wrongly signal a broken backend if the routes are ever misconfigured.
// ============================================================

import { listCompanies } from './listCompanies.mjs';
import { getCompanyById } from './getCompanyById.mjs';
import { listPositions } from './listPositions.mjs';
import { getPositionById } from './getPositionById.mjs';
import { listPeriods } from './listPeriods.mjs';
import { jsonResponse } from './response.mjs';
import { listCoopInfo } from './listCoopInfo.mjs';
import { listStudents } from './listStudents.mjs';
import { getStudentById } from './getStudentById.mjs';
import { listCoopPlans } from './listCoopPlans.mjs';
import { getCoopPlanById } from './getCoopPlanById.mjs';
import { createCoopPlan } from './createCoopPlan.mjs';
import { updateCoopPlan } from './updateCoopPlan.mjs';
import { submitCoopPlan } from './submitCoopPlan.mjs';
import { endorseCoopPlan } from './endorseCoopPlan.mjs';
import { screenCoopPlan } from './screenCoopPlan.mjs';
import { getPlanEligibility } from './getPlanEligibility.mjs';
import { getMe } from './getMe.mjs';
import { requestAttachmentUpload } from './requestAttachmentUpload.mjs';
import { confirmAttachment } from './confirmAttachment.mjs';
import { deleteAttachment } from './deleteAttachment.mjs';
import { listAttachments } from './listAttachments.mjs';
import { downloadAttachmentUrl } from './downloadAttachmentUrl.mjs';

const ROUTES = Object.assign(Object.create(null), {
  'GET /companies': listCompanies,
  'GET /companies/{companyId}': getCompanyById,
  'GET /positions': listPositions,
  'GET /positions/{positionId}': getPositionById,
  'GET /coop-info': listCoopInfo,
  'GET /me': getMe,
  'GET /students': listStudents,
  'GET /students/{studentId}': getStudentById,
  'GET /periods': listPeriods,
  'GET /coop-plans': listCoopPlans,                   
  'GET /coop-plans/{planId}': getCoopPlanById,
  'POST /coop-plans': createCoopPlan,
  'PATCH /coop-plans/{planId}': updateCoopPlan,
  'POST /coop-plans/{planId}/submit': submitCoopPlan,
  'POST /coop-plans/{planId}/endorse': endorseCoopPlan,
  'POST /coop-plans/{planId}/screen': screenCoopPlan,
  'GET /coop-plans/{planId}/eligibility': getPlanEligibility,
  'POST /coop-plans/{planId}/attachments/upload-url': requestAttachmentUpload,
  'POST /coop-plans/{planId}/attachments': confirmAttachment,
  'GET /coop-plans/{planId}/attachments': listAttachments,
  'GET /coop-plans/{planId}/attachments/{attachmentId}/download-url': downloadAttachmentUrl,
  'DELETE /coop-plans/{planId}/attachments/{attachmentId}': deleteAttachment,
});

/**
 * Lambda handler — routes an API Gateway HTTP API event to the matching
 * companies handler.
 *
 * @param {{routeKey?: string, queryStringParameters?: Record<string, string> | null, pathParameters?: Record<string, string> | null}} event
 * @returns {Promise<{statusCode: number, headers: Record<string, string>, body: string}>}
 */
export const handler = async (event) => {
  try {
    const route = ROUTES[event?.routeKey];

    if (!route) {
      console.error('Unhandled routeKey', event?.routeKey);
      return jsonResponse(404, { error: 'Not found' });
    }

    return await route(event);
  } catch (err) {
    // Last-resort net: the individual handlers already catch their own
    // failures, so reaching here means something unexpected (e.g. a
    // malformed event). Log the real error, return a generic body.
    console.error('Unhandled error in companies handler', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};
