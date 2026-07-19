import { eq } from "drizzle-orm";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import {
  db,
  subscriptions,
  tenants,
  type Subscription,
  type Tenant,
} from "@/db";

/**
 * tRPC context. The loaders are injected (rather than procedures importing
 * the db directly) so the tenant-scoping middleware is unit-testable with
 * fakes — and so there is exactly one query shape for resolving the
 * session's tenant and its subscription.
 */
export type TrpcContext = {
  session: Session | null;
  loadTenantById: (tenantId: string) => Promise<Tenant | undefined>;
  loadSubscriptionByTenantId: (
    tenantId: string,
  ) => Promise<Subscription | undefined>;
};

async function loadTenantById(tenantId: string): Promise<Tenant | undefined> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return tenant;
}

async function loadSubscriptionByTenantId(
  tenantId: string,
): Promise<Subscription | undefined> {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);
  return subscription;
}

export async function createTrpcContext(): Promise<TrpcContext> {
  return {
    session: await auth(),
    loadTenantById,
    loadSubscriptionByTenantId,
  };
}
