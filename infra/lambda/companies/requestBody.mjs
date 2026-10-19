// Request-body parsing for the V3-04 write handlers.

/**
 * Parses an API Gateway HTTP API (payload 2.0) JSON body into a plain object.
 * Handles `isBase64Encoded`, and refuses anything that is not a JSON object
 * (missing, empty, malformed, array, null, scalar).
 *
 * @returns {{ok: true, value: Record<string, unknown>} | {ok: false, message: string}}
 */
export function parseJsonObject(event) {
  const raw = event?.body;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, message: 'A JSON request body is required.' };
  }

  let text = raw;
  if (event.isBase64Encoded) {
    text = Buffer.from(raw, 'base64').toString('utf8');
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, message: 'The request body is not valid JSON.' };
  }

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, message: 'The request body must be a JSON object.' };
  }
  return { ok: true, value };
}

/** First key of `body` that is not in `allowed`, or null. */
export function findUnknownField(body, allowed) {
  return Object.keys(body).find((key) => !allowed.includes(key)) ?? null;
}
