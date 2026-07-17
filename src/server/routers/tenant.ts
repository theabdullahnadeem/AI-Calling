import { count, eq } from "drizzle-orm";

import { protectedTenantProcedure, router } from "../trpc";

/**
 * Tenant-scoped procedures. Note none of them accept a tenant identifier as
 * input — scoping comes entirely from protectedTenantProcedure's ctx.tenant.
 */
export const tenantRouter = router({
  me: protectedTenantProcedure.query(({ ctx }) => ({
    name: ctx.tenant.name,
    slug: ctx.tenant.slug,
    businessType: ctx.tenant.businessType,
    status: ctx.tenant.status,
  })),

  overview: protectedTenantProcedure.query(async ({ ctx }) => {
    // Lazy import keeps the router importable without a configured
    // DATABASE_URL (unit tests build their own context and never get here).
    const { db, calls, bookings } = await import("@/db");

    const [callRow] = await db
      .select({ value: count() })
      .from(calls)
      .where(eq(calls.tenantId, ctx.tenant.id));
    const [bookingRow] = await db
      .select({ value: count() })
      .from(bookings)
      .where(eq(bookings.tenantId, ctx.tenant.id));

    // All-time totals for now; Prompt 7 scopes these to the billing period.
    return {
      totalCalls: callRow?.value ?? 0,
      totalBookings: bookingRow?.value ?? 0,
    };
  }),
});
