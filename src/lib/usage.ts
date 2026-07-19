import "server-only";

import { eq, sql } from "drizzle-orm";

import { db, subscriptions, type Tenant } from "@/db";
import { polarClient } from "./polar";
import { redis } from "./redis";

/**
 * Per-call minute accounting (Prompt 6, items 4 + 10). Two counters stay in
 * sync from one code path:
 *
 * - Polar's call_minutes meter (fed via the Events Ingestion API) — the
 *   ACTUAL billing source. Polar's credits benefit absorbs included minutes
 *   and its metered price bills overage automatically; we never calculate or
 *   push overage charges ourselves.
 * - subscriptions.minutesUsedThisCycle — our local counter driving the
 *   dashboard usage bar and the 3-day grace logic.
 *
 * Whole minutes, rounded UP per call (industry-standard billing rounding);
 * the SAME integer goes to both counters so they can't drift.
 */
export async function recordCallUsage(params: {
  tenant: Tenant;
  callId: string;
  durationSeconds: number;
}): Promise<void> {
  const { tenant, callId, durationSeconds } = params;

  try {
    // A pending_payment tenant can't have calls routed yet (agent setup
    // happens at onboarding); a suspended one shouldn't accrue billable
    // usage either.
    if (tenant.status !== "active") return;

    const minutes = Math.ceil(durationSeconds / 60);
    if (minutes <= 0) return;

    // Exactly once per call: call_ended AND call_analyzed both carry a final
    // duration, and Retell retries redeliver events. 7-day TTL outlives any
    // realistic redelivery window.
    const claimed = await redis().set(
      `usage:claim:${callId}`,
      "1",
      "EX",
      7 * 24 * 60 * 60,
      "NX",
    );
    if (claimed === null) return;

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenant.id))
      .limit(1);

    if (!sub) {
      // Manually-activated tenant (e.g. the demo account) — nothing to bill.
      console.warn(
        `[usage] tenant ${tenant.id} has no subscription — ${minutes} min not recorded`,
      );
      return;
    }

    // Atomic SQL increment — concurrent webhooks can't lose an update.
    await db
      .update(subscriptions)
      .set({
        minutesUsedThisCycle: sql`${subscriptions.minutesUsedThisCycle} + ${minutes}`,
      })
      .where(eq(subscriptions.id, sub.id));

    // Feed Polar's meter. customerId when we have it; externalCustomerId
    // (our polarCustomerReference) as the fallback channel.
    try {
      await polarClient().events.ingest({
        events: [
          {
            name: "call_minutes",
            ...(sub.polarCustomerId
              ? { customerId: sub.polarCustomerId }
              : { externalCustomerId: tenant.polarCustomerReference ?? tenant.id }),
            metadata: { minutes, callId },
          },
        ],
      });
    } catch (error) {
      // Local counter is already updated; losing the Polar event undercounts
      // BILLING, so it must be replayable — dead-letter it.
      console.error(
        `[usage] Polar ingestion failed for call ${callId}:`,
        error instanceof Error ? error.message : error,
      );
      await redis().lpush(
        "usage:deadletter",
        JSON.stringify({
          tenantId: tenant.id,
          callId,
          minutes,
          polarCustomerId: sub.polarCustomerId,
          failedAt: new Date().toISOString(),
        }),
      );
    }
  } catch (error) {
    console.error(
      `[usage] recording failed for call ${callId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
