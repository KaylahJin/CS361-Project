// The only place that talks to S3, so tests mock this file and nothing else.

import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

let client = null;

function getClient() {
  if (!client) client = new S3Client({ region: process.env.AWS_REGION });
  return client;
}

/**
 * Presigned POST: S3 itself rejects a body outside the size range or with a
 * different Content-Type, so the limits hold even if a client skips our API.
 */
export async function presignUpload({ key, contentType, maxBytes, expiresIn }) {
  const bucket = process.env.ATTACHMENTS_BUCKET;
  if (!bucket) throw new Error('ATTACHMENTS_BUCKET is not set');

  return createPresignedPost(getClient(), {
    Bucket: bucket,
    Key: key,
    Conditions: [
      ['content-length-range', 1, maxBytes],
      ['eq', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: expiresIn,
  });
}