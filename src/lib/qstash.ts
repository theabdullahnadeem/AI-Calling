import "server-only";

import { Receiver } from "@upstash/qstash";

import { serverEnv } from "./env";

/**
 * Upstash QStash drives all scheduled jobs (chosen over Vercel Cron: the
 * hobby plan caps cron jobs account-wide, and QStash cryptographically signs
 * every delivery — stronger than a shared bearer secret).
 *
 * Every /api/jobs/* route must verify the Upstash-Signature JWT before doing
 * anything. Two keys because Upstash rotates them: current verifies new
 * deliveries, next covers the rotation window.
 */
export async function verifyQStashRequest(req: Request): Promise<boolean> {
  const signature = req.headers.get("upstash-signature");
  if (!signature) return false;

  const receiver = new Receiver({
    currentSigningKey: serverEnv("QSTASH_CURRENT_SIGNING_KEY"),
    nextSigningKey: serverEnv("QSTASH_NEXT_SIGNING_KEY"),
  });

  try {
    await receiver.verify({
      signature,
      body: await req.text(),
    });
    return true;
  } catch {
    return false;
  }
}
