import { after } from "next/server";
import { eq } from "drizzle-orm";
import Retell from "retell-sdk";
import { z } from "zod";

import { calls, db, tenants } from "@/db";
import { serverEnv } from "@/lib/env";
import { archiveCallRecording } from "@/lib/recording";
import { redis } from "@/lib/redis";
import {
  mapDirection,
  mapEndStatus,
  mapSentiment,
  mapStartStatus,
  resolveCustomerPhone,
  resolveDurationSeconds,
} from "@/lib/retell-mapping";

export const runtime = "nodejs";

const IDEMPOTENCY_TTL_SECONDS = 60 * 60; // duplicates arrive within minutes; 1h is ample
const LIVE_CALL_TTL_SECONDS = 4 * 60 * 60; // safety cap if a call_ended is never delivered

const payloadSchema = z
  .object({
    event: z.enum(["call_started", "call_ended", "call_analyzed"]),
    call: z
      .object({
        call_id: z.string().min(1),
        agent_id: z.string().optional(),
        direction: z.string().optional(),
        from_number: z.string().optional(),
        to_number: z.string().optional(),
        call_status: z.string().optional(),
        disconnection_reason: z.string().optional(),
        recording_url: z.string().optional(),
        duration_ms: z.number().optional(),
        start_timestamp: z.number().optional(),
        end_timestamp: z.number().optional(),
        transcript_object: z.unknown().optional(),
        call_analysis: z
          .object({
            call_summary: z.string().optional(),
            user_sentiment: z.string().optional(),
            custom_analysis_data: z
              .record(z.string(), z.unknown())
              .optional(),
          })
          .loose()
          .optional(),
      })
      .loose(),
  })
  .loose();

async function deadletter(entry: {
  event: string;
  callId: string;
  error: string;
  rawBody: string;
}): Promise<void> {
  try {
    await redis().lpush(
      "webhook:deadletter",
      JSON.stringify({ ...entry, receivedAt: new Date().toISOString() }),
    );
  } catch (redisError) {
    // Last resort: the log line itself is the record.
    console.error("[retell-webhook] deadletter write failed:", redisError);
    console.error("[retell-webhook] dropped payload:", entry.rawBody);
  }
}

export async function POST(req: Request): Promise<Response> {
  // Raw body first — the signature covers the exact bytes. NOTHING is parsed
  // or processed before verification succeeds.
  const rawBody = await req.text();
  const signature = req.headers.get("x-retell-signature");

  if (
    !signature ||
    !Retell.verify(rawBody, serverEnv("RETELL_API_KEY"), signature)
  ) {
    return new Response("Invalid signature", { status: 401 });
  }

  const parsed = payloadSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    // Authentic (signed) but structurally unusable — keep it for inspection.
    await deadletter({
      event: "unparseable",
      callId: "unknown",
      error: parsed.error.message,
      rawBody,
    });
    return Response.json({ received: true, parsed: false });
  }

  const { event, call } = parsed.data;

  // Idempotency: one processing slot per (call, event). SET NX means a
  // duplicate Retell retry is a clean no-op — no double writes, and no
  // double email triggers once Prompt 5's booking pipeline hangs off this.
  const idempotencyKey = `webhook:${call.call_id}:${event}`;
  const claimed = await redis().set(
    idempotencyKey,
    "1",
    "EX",
    IDEMPOTENCY_TTL_SECONDS,
    "NX",
  );
  if (claimed === null) {
    return Response.json({ received: true, duplicate: true });
  }

  // Attribute the call to a tenant via the agent-id mapping.
  const agentId = call.agent_id;
  const [tenant] = agentId
    ? await db
        .select({ id: tenants.id, status: tenants.status })
        .from(tenants)
        .where(eq(tenants.retellAgentId, agentId))
        .limit(1)
    : [];

  if (!tenant) {
    // Signed webhook for an unmapped agent = a misconfiguration to fix, not
    // an event Retell should retry. Dead-letter it for replay after the
    // mapping is corrected in /admin.
    console.warn(
      `[retell-webhook] no tenant mapped to agent "${agentId ?? "<missing>"}" — deadlettered`,
    );
    await deadletter({
      event,
      callId: call.call_id,
      error: `no tenant for agent_id ${agentId ?? "<missing>"}`,
      rawBody,
    });
    return Response.json({ received: true, matched: false });
  }

  try {
    switch (event) {
      case "call_started": {
        const status = mapStartStatus(call.call_status);
        await db
          .insert(calls)
          .values({
            id: call.call_id,
            tenantId: tenant.id,
            direction: mapDirection(call.direction),
            status,
            phoneNumber: resolveCustomerPhone(call),
          })
          .onConflictDoUpdate({
            target: calls.id,
            set: { status },
          });

        // Live-status cache: the dashboard's live-call indicator polls this
        // key, not Postgres.
        await redis().set(
          `call:${tenant.id}:${call.call_id}`,
          JSON.stringify({
            callId: call.call_id,
            status,
            direction: mapDirection(call.direction),
            phoneNumber: resolveCustomerPhone(call),
            startedAt: call.start_timestamp ?? Date.now(),
          }),
          "EX",
          LIVE_CALL_TTL_SECONDS,
        );
        break;
      }

      case "call_ended": {
        const status = mapEndStatus(call.disconnection_reason);
        const durationSeconds = resolveDurationSeconds(call);
        // Upsert, not update: webhooks can arrive out of order and a missed
        // call_started must not make us drop the call record entirely.
        await db
          .insert(calls)
          .values({
            id: call.call_id,
            tenantId: tenant.id,
            direction: mapDirection(call.direction),
            status,
            phoneNumber: resolveCustomerPhone(call),
            durationSeconds,
            transcript: call.transcript_object ?? null,
          })
          .onConflictDoUpdate({
            target: calls.id,
            set: {
              status,
              durationSeconds,
              transcript: call.transcript_object ?? null,
            },
          });

        // Call is over — clear the live-status cache.
        await redis().del(`call:${tenant.id}:${call.call_id}`);

        // Prompt 4: archive the ephemeral recording to R2 AFTER the webhook
        // response is sent — audio transfer must not add to (or fail) the
        // webhook's own latency budget. Failures retry + dead-letter inside.
        if (call.recording_url) {
          const sourceUrl = call.recording_url;
          after(() =>
            archiveCallRecording({
              tenantId: tenant.id,
              callId: call.call_id,
              sourceUrl,
            }),
          );
        }

        // Prompt 6 hooks in here: ingest the Polar usage event and increment
        // minutesUsedThisCycle.
        break;
      }

      case "call_analyzed": {
        const analysis = call.call_analysis;
        const sentiment = mapSentiment(analysis?.user_sentiment);
        await db
          .insert(calls)
          .values({
            id: call.call_id,
            tenantId: tenant.id,
            direction: mapDirection(call.direction),
            status: "completed",
            phoneNumber: resolveCustomerPhone(call),
            durationSeconds: resolveDurationSeconds(call),
            transcript: call.transcript_object ?? null,
            summary: analysis?.call_summary ?? null,
            sentiment,
          })
          .onConflictDoUpdate({
            target: calls.id,
            set: {
              summary: analysis?.call_summary ?? null,
              sentiment,
              transcript: call.transcript_object ?? null,
            },
          });

        // Belt-and-suspenders: if call_ended was missed (or arrived without
        // a recording_url), this event also carries it. The Redis claim in
        // archiveCallRecording makes double-triggering a no-op.
        if (call.recording_url) {
          const sourceUrl = call.recording_url;
          after(() =>
            archiveCallRecording({
              tenantId: tenant.id,
              callId: call.call_id,
              sourceUrl,
            }),
          );
        }

        // Booking-intent check (which field to look at is per-tenant via
        // tenants.intakeSchema). Prompt 5 implements the bookings write and
        // Resend pipeline on top of this hook.
        const customData = analysis?.custom_analysis_data;
        if (customData && Object.keys(customData).length > 0) {
          console.log(
            `[retell-webhook] call ${call.call_id} carries custom_analysis_data (booking pipeline lands in Prompt 5)`,
          );
        }
        break;
      }
    }
  } catch (error) {
    // DB write failed: keep the raw payload replayable, release the
    // idempotency slot so a retry can reprocess, and 500 so Retell retries.
    console.error(`[retell-webhook] ${event} processing failed:`, error);
    await deadletter({
      event,
      callId: call.call_id,
      error: error instanceof Error ? error.message : String(error),
      rawBody,
    });
    await redis()
      .del(idempotencyKey)
      .catch(() => {});
    return new Response("Processing failed", { status: 500 });
  }

  return Response.json({ received: true });
}
