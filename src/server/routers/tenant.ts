import { and, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { z } from "zod";

import { protectedTenantProcedure, router } from "../trpc";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The current billing period. Until Polar is wired (a subscription row
 * exists), fall back to the trailing 30 days so the dashboard still reads
 * sensibly for manually-activated tenants (e.g. the demo tenant).
 */
function resolvePeriod(sub: {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
} | null): { start: Date; end: Date } {
  if (sub) return { start: sub.currentPeriodStart, end: sub.currentPeriodEnd };
  const now = new Date();
  return { start: new Date(now.getTime() - 30 * DAY_MS), end: now };
}

const callFilterSchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    direction: z.enum(["inbound", "outbound"]).optional(),
    status: z
      .enum(["ringing", "in-progress", "completed", "failed"])
      .optional(),
    sentiment: z
      .enum(["positive", "neutral", "negative", "inquisitive"])
      .optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .default({ limit: 50 });

/**
 * Tenant-scoped procedures. None accept a tenant identifier as input —
 * scoping comes entirely from protectedTenantProcedure's ctx.tenant. Where a
 * row id IS client input (callDetail), the query pins tenantId server-side
 * so another tenant's id returns nothing, not something.
 */
export const tenantRouter = router({
  me: protectedTenantProcedure.query(({ ctx }) => ({
    name: ctx.tenant.name,
    slug: ctx.tenant.slug,
    businessType: ctx.tenant.businessType,
    status: ctx.tenant.status,
    intakeSchema: ctx.tenant.intakeSchema,
  })),

  /** Performance cards — this billing period. */
  overview: protectedTenantProcedure.query(async ({ ctx }) => {
    const { db, calls, bookings } = await import("@/db");
    const period = resolvePeriod(ctx.subscription);

    const inPeriod = (column: typeof calls.createdAt) =>
      and(gte(column, period.start), lte(column, period.end));

    const [inbound] = await db
      .select({ value: count() })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, ctx.tenant.id),
          eq(calls.direction, "inbound"),
          inPeriod(calls.createdAt),
        ),
      );
    const [outbound] = await db
      .select({ value: count() })
      .from(calls)
      .where(
        and(
          eq(calls.tenantId, ctx.tenant.id),
          eq(calls.direction, "outbound"),
          inPeriod(calls.createdAt),
        ),
      );
    const [booked] = await db
      .select({ value: count() })
      .from(bookings)
      .where(
        and(
          eq(bookings.tenantId, ctx.tenant.id),
          gte(bookings.createdAt, period.start),
          lte(bookings.createdAt, period.end),
        ),
      );

    return {
      periodStart: period.start.toISOString(),
      periodEnd: period.end.toISOString(),
      inboundCalls: inbound?.value ?? 0,
      outboundCalls: outbound?.value ?? 0,
      bookingsSecured: booked?.value ?? 0,
    };
  }),

  /** Billing status card + overdue banner state. */
  billing: protectedTenantProcedure.query(async ({ ctx }) => {
    const sub = ctx.subscription;
    if (!sub) {
      return { hasSubscription: false as const };
    }
    const overageMinutes = Math.max(
      0,
      sub.minutesUsedThisCycle - sub.minuteCap,
    );

    // Retry Payment goes to Polar's hosted customer portal (card update +
    // retry live there — we never touch payment details). Session links are
    // short-lived, so mint one per dashboard load, only when it's needed.
    let customerPortalUrl: string | null = null;
    if (sub.status === "payment_overdue" && sub.polarCustomerId) {
      try {
        const { polarClient } = await import("@/lib/polar");
        const session = await polarClient().customerSessions.create({
          customerId: sub.polarCustomerId,
        });
        customerPortalUrl = session.customerPortalUrl;
      } catch (error) {
        console.error(
          "[dashboard] Polar customer session failed:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    return {
      hasSubscription: true as const,
      tier: sub.tier,
      status: sub.status,
      minuteCap: sub.minuteCap,
      minutesUsed: sub.minutesUsedThisCycle,
      overageMinutes,
      overageRatePerMinuteUsd: sub.overageRatePerMinuteUsd,
      monthlyPriceUsd: sub.monthlyPriceUsd,
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      overdueSince: sub.overdueSince?.toISOString() ?? null,
      // 3-day grace window countdown for the banner; the daily job (and the
      // tRPC middleware, immediately) enforce the actual suspension.
      graceEndsAt: sub.overdueSince
        ? new Date(sub.overdueSince.getTime() + 3 * DAY_MS).toISOString()
        : null,
      customerPortalUrl,
    };
  }),

  /**
   * In-progress calls from the Redis live cache (Prompt 3) — not Postgres.
   * Degrades to [] if Redis is unreachable: the live indicator disappears,
   * the dashboard itself must never go down with the cache.
   */
  liveCalls: protectedTenantProcedure.query(async ({ ctx }) => {
    let values: (string | null)[];
    try {
      const { redis } = await import("@/lib/redis");
      const client = redis();

      const keys: string[] = [];
      let cursor = "0";
      do {
        const [next, batch] = await client.scan(
          cursor,
          "MATCH",
          `call:${ctx.tenant.id}:*`,
          "COUNT",
          100,
        );
        cursor = next;
        keys.push(...batch);
      } while (cursor !== "0" && keys.length < 500);

      if (keys.length === 0) return [];
      values = await client.mget(...keys);
    } catch (error) {
      console.error(
        "[dashboard] liveCalls Redis lookup failed:",
        error instanceof Error ? error.message : error,
      );
      return [];
    }

    return values
      .flatMap((value) => {
        if (!value) return [];
        try {
          const parsed = JSON.parse(value) as {
            callId?: string;
            status?: string;
            direction?: string;
            phoneNumber?: string;
            startedAt?: number;
          };
          return parsed.callId ? [parsed] : [];
        } catch {
          return [];
        }
      })
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
  }),

  /** Call log — server-side search + filters, newest first. */
  callsList: protectedTenantProcedure
    .input(callFilterSchema)
    .query(async ({ ctx, input }) => {
      const { db, calls } = await import("@/db");

      const conditions = [eq(calls.tenantId, ctx.tenant.id)];
      if (input.direction) {
        conditions.push(eq(calls.direction, input.direction));
      }
      if (input.status) conditions.push(eq(calls.status, input.status));
      if (input.sentiment) {
        conditions.push(eq(calls.sentiment, input.sentiment));
      }
      if (input.search) {
        const term = `%${input.search}%`;
        const searchCondition = or(
          ilike(calls.phoneNumber, term),
          ilike(calls.summary, term),
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      const rows = await db
        .select({
          id: calls.id,
          createdAt: calls.createdAt,
          direction: calls.direction,
          status: calls.status,
          durationSeconds: calls.durationSeconds,
          sentiment: calls.sentiment,
          phoneNumber: calls.phoneNumber,
          recordingUrl: calls.recordingUrl,
        })
        .from(calls)
        .where(and(...conditions))
        .orderBy(desc(calls.createdAt))
        .limit(input.limit);

      return rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        direction: row.direction,
        status: row.status,
        durationSeconds: row.durationSeconds,
        sentiment: row.sentiment,
        phoneNumber: row.phoneNumber,
        hasRecording: row.recordingUrl !== null,
      }));
    }),

  /**
   * Transcript + audio for one call. callId is client input, so the query
   * pins ctx.tenant.id — another tenant's callId yields NOT_FOUND, never
   * data. The playback URL is a FRESH short-lived presigned R2 URL on every
   * request (Prompt 8 item 5): nothing permanent ever reaches the client.
   */
  callDetail: protectedTenantProcedure
    .input(z.object({ callId: z.string().min(1).max(128) }))
    .query(async ({ ctx, input }) => {
      const { db, calls } = await import("@/db");
      const { TRPCError } = await import("@trpc/server");

      const [call] = await db
        .select()
        .from(calls)
        .where(
          and(eq(calls.id, input.callId), eq(calls.tenantId, ctx.tenant.id)),
        )
        .limit(1);

      if (!call) throw new TRPCError({ code: "NOT_FOUND" });

      let playbackUrl: string | null = null;
      if (call.recordingUrl) {
        const { getRecordingPlaybackUrl } = await import("@/lib/r2");
        try {
          playbackUrl = await getRecordingPlaybackUrl(call.recordingUrl);
        } catch (error) {
          console.error(
            `[dashboard] presign failed for call ${call.id}:`,
            error instanceof Error ? error.message : error,
          );
        }
      }

      return {
        id: call.id,
        createdAt: call.createdAt.toISOString(),
        direction: call.direction,
        status: call.status,
        durationSeconds: call.durationSeconds,
        sentiment: call.sentiment,
        phoneNumber: call.phoneNumber,
        summary: call.summary,
        transcript: call.transcript,
        playbackUrl,
      };
    }),

  /** Booking panel — columns render from intakeSchema, not hardcoded. */
  bookingsList: protectedTenantProcedure.query(async ({ ctx }) => {
    const { db, bookings } = await import("@/db");
    const rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.tenantId, ctx.tenant.id))
      .orderBy(desc(bookings.createdAt))
      .limit(100);

    return rows.map((row) => ({
      id: row.id,
      callId: row.callId,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      intakeData: row.intakeData,
      bookingTime: row.bookingTime?.toISOString() ?? null,
      emailSentStatus: row.emailSentStatus,
      createdAt: row.createdAt.toISOString(),
    }));
  }),
});
