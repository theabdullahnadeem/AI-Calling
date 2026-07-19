import "server-only";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { serverEnv } from "./env";

/**
 * Cloudflare R2 via its S3-compatible API — chosen over Cloudinary per spec:
 * R2 has no egress fees, which matters directly for a product whose core
 * function is replaying stored audio on every dashboard playback.
 *
 * The bucket must NOT be public (docs/02 §5). Objects are addressed by key;
 * playback happens exclusively through short-lived presigned URLs from
 * getRecordingPlaybackUrl — a stored link is never directly fetchable.
 */

const globalForR2 = globalThis as unknown as { r2?: S3Client };

export function r2Client(): S3Client {
  if (!globalForR2.r2) {
    globalForR2.r2 = new S3Client({
      region: "auto",
      endpoint: `https://${serverEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: serverEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: serverEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return globalForR2.r2;
}

export async function putRecordingObject(params: {
  objectKey: string;
  body: Uint8Array;
  contentType: string;
}): Promise<void> {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: serverEnv("R2_BUCKET_NAME"),
      Key: params.objectKey,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
}

/** Default 5 minutes — regenerated on each dashboard load, per Prompt 8 §5. */
export async function getRecordingPlaybackUrl(
  objectKey: string,
  expiresInSeconds = 300,
): Promise<string> {
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: serverEnv("R2_BUCKET_NAME"),
      Key: objectKey,
    }),
    { expiresIn: expiresInSeconds },
  );
}
