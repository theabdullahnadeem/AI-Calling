import { initTRPC, TRPCError } from "@trpc/server";

// Type-only import: erased at runtime, so this module never pulls in the
// auth/database chain — tests can build a context by hand.
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * THE tenant authorization boundary — every tenant-scoped procedure builds on
 * this middleware, so the check lives in exactly one place (Prompt 2's
 * requirement), never re-implemented per route.
 *
 * The tenant is resolved EXCLUSIVELY from the authenticated session's
 * tenantId. No procedure input, URL slug, header, or any other
 * client-supplied value ever participates in choosing which tenant's data is
 * touched — a client can send whatever it likes; it can only ever get its own
 * tenant.
 */
export const protectedTenantProcedure = t.procedure.use(
  async ({ ctx, next }) => {
    const user = ctx.session?.user;
    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (user.role !== "tenant_owner" || !user.tenantId) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const tenant = await ctx.loadTenantById(user.tenantId);
    if (!tenant) {
      // Session references a tenant that no longer exists — treat the
      // session as dead.
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    if (tenant.status === "suspended") {
      // Specific, machine-readable message so the frontend renders the
      // "access revoked — contact support" state, not a generic 403.
      throw new TRPCError({ code: "FORBIDDEN", message: "TENANT_SUSPENDED" });
    }
    if (tenant.status !== "active") {
      // 'pending_payment' tenants have no users row, so this should be
      // unreachable — kept as a hard invariant anyway (Prompt 2.5, item 7).
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    // Prompt 6 extends this middleware with subscriptions.status handling
    // (payment_overdue grace-window banner flag).

    return next({ ctx: { ...ctx, tenant } });
  },
);
