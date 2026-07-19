import type { Session } from "next-auth";
import { describe, expect, it, vi } from "vitest";

import type { Subscription, Tenant } from "@/db/schema";
import { appRouter } from "./index";
import type { TrpcContext } from "./context";

function makeTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: "tenant-b-id",
    slug: "tenant-b",
    name: "Tenant B LLC",
    ownerEmail: "owner@tenant-b.test",
    businessType: "restaurant",
    intakeSchema: { fields: [] },
    status: "active",
    selectedTier: "standard",
    polarCustomerReference: "dvx_ref",
    paymentLinkSentAt: null,
    retellAgentId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeSubscription(
  overrides: Partial<Subscription> = {},
): Subscription {
  return {
    id: "sub-b-id",
    tenantId: "tenant-b-id",
    tier: "standard",
    monthlyPriceUsd: "1500.00",
    minuteCap: 5514,
    overageRatePerMinuteUsd: "0.27",
    minutesUsedThisCycle: 100,
    polarCustomerId: "polar-cus-1",
    polarSubscriptionId: "polar-sub-1",
    status: "active",
    currentPeriodStart: new Date(Date.now() - 10 * 86400_000),
    currentPeriodEnd: new Date(Date.now() + 20 * 86400_000),
    overdueSince: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSession(): Session {
  return {
    user: {
      id: "user-b-id",
      email: "owner@tenant-b.test",
      role: "tenant_owner",
      tenantId: "tenant-b-id",
      tenantSlug: "tenant-b",
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as Session;
}

function makeContext(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    session: makeSession(),
    loadTenantById: vi.fn(async () => makeTenant()),
    loadSubscriptionByTenantId: vi.fn(async () => makeSubscription()),
    ...overrides,
  };
}

describe("protectedTenantProcedure — tenant scoping", () => {
  it("resolves data ONLY from the session's tenant — client input has no say", async () => {
    const loadTenantById = vi.fn(async () => makeTenant());
    const ctx = makeContext({ loadTenantById });

    // There is no way to pass a tenant identifier at all: tenant.me takes no
    // input. Whatever tenant a caller *wants*, it gets its session's own.
    const result = await appRouter.createCaller(ctx).tenant.me();

    expect(result.slug).toBe("tenant-b");
    expect(loadTenantById).toHaveBeenCalledTimes(1);
    expect(loadTenantById).toHaveBeenCalledWith("tenant-b-id");
  });

  it("rejects an unauthenticated caller", async () => {
    const ctx = makeContext({ session: null });
    await expect(appRouter.createCaller(ctx).tenant.me()).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });

  it("blocks a suspended tenant with the specific TENANT_SUSPENDED error", async () => {
    const ctx = makeContext({
      loadTenantById: vi.fn(async () => makeTenant({ status: "suspended" })),
    });
    await expect(appRouter.createCaller(ctx).tenant.me()).rejects.toMatchObject(
      { code: "FORBIDDEN", message: "TENANT_SUSPENDED" },
    );
  });

  it("blocks a non-active (pending_payment) tenant — hard invariant", async () => {
    const ctx = makeContext({
      loadTenantById: vi.fn(async () =>
        makeTenant({ status: "pending_payment" }),
      ),
    });
    await expect(appRouter.createCaller(ctx).tenant.me()).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });

  it("treats a session pointing at a deleted tenant as dead", async () => {
    const ctx = makeContext({
      loadTenantById: vi.fn(async () => undefined),
    });
    await expect(appRouter.createCaller(ctx).tenant.me()).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });
});

describe("protectedTenantProcedure — subscription gating (Prompt 6)", () => {
  it("blocks a suspended subscription with SUBSCRIPTION_SUSPENDED", async () => {
    const ctx = makeContext({
      loadSubscriptionByTenantId: vi.fn(async () =>
        makeSubscription({ status: "suspended" }),
      ),
    });
    await expect(appRouter.createCaller(ctx).tenant.me()).rejects.toMatchObject(
      { code: "FORBIDDEN", message: "SUBSCRIPTION_SUSPENDED" },
    );
  });

  it("blocks a cancelled subscription — no service after revocation", async () => {
    const ctx = makeContext({
      loadSubscriptionByTenantId: vi.fn(async () =>
        makeSubscription({ status: "cancelled" }),
      ),
    });
    await expect(appRouter.createCaller(ctx).tenant.me()).rejects.toMatchObject(
      { code: "FORBIDDEN", message: "SUBSCRIPTION_SUSPENDED" },
    );
  });

  it("allows payment_overdue INSIDE the 3-day grace window", async () => {
    const ctx = makeContext({
      loadSubscriptionByTenantId: vi.fn(async () =>
        makeSubscription({
          status: "payment_overdue",
          overdueSince: new Date(Date.now() - 1 * 86400_000), // 1 day ago
        }),
      ),
    });
    const result = await appRouter.createCaller(ctx).tenant.me();
    expect(result.slug).toBe("tenant-b");
  });

  it("blocks payment_overdue PAST the 3-day grace window without waiting for the daily job", async () => {
    const ctx = makeContext({
      loadSubscriptionByTenantId: vi.fn(async () =>
        makeSubscription({
          status: "payment_overdue",
          overdueSince: new Date(Date.now() - 4 * 86400_000), // 4 days ago
        }),
      ),
    });
    await expect(appRouter.createCaller(ctx).tenant.me()).rejects.toMatchObject(
      { code: "FORBIDDEN", message: "SUBSCRIPTION_SUSPENDED" },
    );
  });

  it("allows a tenant with no subscription row (manually-activated demo tenant)", async () => {
    const ctx = makeContext({
      loadSubscriptionByTenantId: vi.fn(async () => undefined),
    });
    const result = await appRouter.createCaller(ctx).tenant.me();
    expect(result.slug).toBe("tenant-b");
  });
});
