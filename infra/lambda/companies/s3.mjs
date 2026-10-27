// The only place that talks to S3, so tests mock this file and nothing else.

import {
  S3Client,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { buildContentDisposition } from './attachmentRules.mjs';

let client = null;

function getClient() {
  if (!client) client = new S3Client({ region: process.env.AWS_REGION });
  return client;
}

function bucketName() {
  const bucket = process.env.ATTACHMENTS_BUCKET;
  if (!bucket) throw new Error('ATTACHMENTS_BUCKET is not set');
  return bucket;
}

/**
 * Presigned POST: S3 itself rejects a body outside the size range or with a
 * different Content-Type, so the limits hold even if a client skips our API.
 */
export async function presignUpload({ key, contentType, maxBytes, expiresIn }) {
  const bucket = bucketName();

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

/**
 * Asks S3 about one object without downloading it.
 *
 * @returns {Promise<{sizeBytes: number, contentType: string} | null>}
 *   null when the object does not exist. Any other failure (permissions,
 *   network) throws, so the caller answers 500 instead of "not uploaded".
 *
 *   Note: S3 answers 403 instead of 404 for a missing key when the caller
 *   lacks s3:ListBucket, so the Lambda role needs it on the bucket.
 */
export async function headObject(key) {
  try {
    const out = await getClient().send(
      new HeadObjectCommand({ Bucket: bucketName(), Key: key }),
    );
    return { sizeBytes: out.ContentLength, contentType: out.ContentType };
  } catch (err) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

/** Deletes one object. S3 treats a missing key as success. */
export async function deleteObject(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
}

/**
 * A short-lived link to read one private object. Signing is local arithmetic,
 * with no call to S3, so it costs next to nothing.
 *
 * The response headers are forced so the browser shows the file as a PDF with
 * its original name whatever the object's own metadata says.
 */
export async function presignDownload({ key, fileName, expiresIn }) {
  const command = new GetObjectCommand({
    Bucket: bucketName(),
    Key: key,
    ResponseContentType: 'application/pdf',
    ResponseContentDisposition: buildContentDisposition(fileName),
  });
  return getSignedUrl(getClient(), command, { expiresIn });
}
