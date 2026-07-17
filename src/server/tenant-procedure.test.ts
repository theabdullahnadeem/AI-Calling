import type { Session } from "next-auth";
import { describe, expect, it, vi } from "vitest";

import type { Tenant } from "@/db/schema";
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
    createdAt: new Date(),
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

describe("protectedTenantProcedure", () => {
  it("resolves data ONLY from the session's tenant — client input has no say", async () => {
    const loadTenantById = vi.fn(async () => makeTenant());
    const ctx: TrpcContext = { session: makeSession(), loadTenantById };

    // There is no way to pass a tenant identifier at all: tenant.me takes no
    // input. Whatever tenant a caller *wants*, it gets its session's own.
    const result = await appRouter.createCaller(ctx).tenant.me();

    expect(result.slug).toBe("tenant-b");
    // The one and only tenant lookup used the SESSION's tenantId.
    expect(loadTenantById).toHaveBeenCalledTimes(1);
    expect(loadTenantById).toHaveBeenCalledWith("tenant-b-id");
  });

  it("rejects an unauthenticated caller", async () => {
    const ctx: TrpcContext = {
      session: null,
      loadTenantById: vi.fn(async () => makeTenant()),
    };
    await expect(appRouter.createCaller(ctx).tenant.me()).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });

  it("blocks a suspended tenant with the specific TENANT_SUSPENDED error", async () => {
    const ctx: TrpcContext = {
      session: makeSession(),
      loadTenantById: vi.fn(async () => makeTenant({ status: "suspended" })),
    };
    await expect(appRouter.createCaller(ctx).tenant.me()).rejects.toMatchObject(
      { code: "FORBIDDEN", message: "TENANT_SUSPENDED" },
    );
  });

  it("blocks a non-active (pending_payment) tenant — hard invariant", async () => {
    const ctx: TrpcContext = {
      session: makeSession(),
      loadTenantById: vi.fn(async () =>
        makeTenant({ status: "pending_payment" }),
      ),
    };
    await expect(appRouter.createCaller(ctx).tenant.me()).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });

  it("treats a session pointing at a deleted tenant as dead", async () => {
    const ctx: TrpcContext = {
      session: makeSession(),
      loadTenantById: vi.fn(async () => undefined),
    };
    await expect(appRouter.createCaller(ctx).tenant.me()).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });
});
