import { eq } from "drizzle-orm";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { db, tenants, type Tenant } from "@/db";

/**
 * tRPC context. `loadTenantById` is injected (rather than the procedure
 * importing the db directly) so the tenant-scoping middleware is unit-testable
 * with a fake loader — and so there is exactly one query shape for resolving
 * the session's tenant.
 */
export type TrpcContext = {
  session: Session | null;
  loadTenantById: (tenantId: string) => Promise<Tenant | undefined>;
};

async function loadTenantById(tenantId: string): Promise<Tenant | undefined> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return tenant;
}

export async function createTrpcContext(): Promise<TrpcContext> {
  return {
    session: await auth(),
    loadTenantById,
  };
}
