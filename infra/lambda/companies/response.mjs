// ============================================================
// CS361 V2 — Lambda JSON response helper
// ============================================================
// Issue: #26 — ทำการเรียกข้อมูลสถานประกอบการ
//
// IMPORTANT — CORS:
//   This helper sets Content-Type ONLY. It must NEVER set
//   Access-Control-Allow-Origin (or any other Access-Control-* header).
//   The single source of CORS for this API is API Gateway HTTP API's
//   native CORS configuration on the API resource itself
//   (see docs/aws-lambda-setup-guide.md step 5, allowing
//   http://localhost:5173). If the Lambda also emitted a CORS header the
//   response would carry it twice, and browsers reject a duplicated
//   Access-Control-Allow-Origin as invalid.
// ============================================================

/**
 * Build an API Gateway HTTP API (payload format 2.0) JSON response.
 *
 * @param {number} statusCode HTTP status code (200 / 400 / 404 / 500)
 * @param {unknown} body      JSON-serializable body (bare array or object)
 * @returns {{statusCode: number, headers: Record<string, string>, body: string}}
 */
export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}
