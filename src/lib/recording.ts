import "server-only";

import { eq, isNull, and } from "drizzle-orm";

import { calls, db } from "@/db";
import { putRecordingObject } from "./r2";
import {
  extensionFromContentType,
  recordingObjectKey,
  RETRY_DELAYS_MS,
} from "./recording-format";
import { redis } from "./redis";

/**
 * Archives a call's audio from Retell's EPHEMERAL recording URL (it expires)
 * into permanent R2 storage, then writes the object KEY — never a public
 * URL — to calls.recordingUrl. Runs post-response from the call_ended /
 * call_analyzed webhook handlers via next/server's after().
 */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchAndStore(
  tenantId: string,
  callId: string,
  sourceUrl: string,
): Promise<string> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`recording fetch returned HTTP ${response.status}`);
  }
  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() || "audio/wav";
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength === 0) {
    throw new Error("recording fetch returned an empty body");
  }

  const objectKey = recordingObjectKey(
    tenantId,
    callId,
    extensionFromContentType(contentType),
  );
  await putRecordingObject({ objectKey, body, contentType });
  return objectKey;
}

export async function archiveCallRecording(params: {
  tenantId: string;
  callId: string;
  sourceUrl: string;
}): Promise<void> {
  const { tenantId, callId, sourceUrl } = params;

  // Claim this call's archival once — call_ended AND call_analyzed both carry
  // recording_url, and only one of them should do the transfer.
  const claimed = await redis().set(`recording:claim:${callId}`, "1", {
    ex: 24 * 60 * 60,
    nx: true,
  });
  if (claimed === null) return;

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
    }
    try {
      const objectKey = await fetchAndStore(tenantId, callId, sourceUrl);

      // Guarded write: never clobber an already-archived recording.
      await db
        .update(calls)
        .set({ recordingUrl: objectKey })
        .where(and(eq(calls.id, callId), isNull(calls.recordingUrl)));
      return;
    } catch (error) {
      lastError = error;
      console.warn(
        `[recording] archive attempt ${attempt + 1} failed for call ${callId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // All attempts exhausted: leave a loud, replayable record — a null
  // recordingUrl must never be a silent mystery (spec, Prompt 4 item 4).
  console.error(
    `[recording] giving up on call ${callId} after ${RETRY_DELAYS_MS.length + 1} attempts`,
  );
  try {
    await redis().lpush("recording:deadletter", {
      tenantId,
      callId,
      sourceUrl, // NOTE: ephemeral — may already be expired on replay
      error: lastError instanceof Error ? lastError.message : String(lastError),
      failedAt: new Date().toISOString(),
    });
    // Release the claim so a later webhook retry may attempt again.
    await redis().del(`recording:claim:${callId}`);
  } catch (redisError) {
    console.error("[recording] deadletter write failed:", redisError);
  }
}
