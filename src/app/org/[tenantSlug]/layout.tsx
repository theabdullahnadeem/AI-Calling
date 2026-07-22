import { forbidden, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { db, tenants } from "@/db";

/**
 * Authoritative server-side gate for everything under /org/[tenantSlug].
 *
 * The edge middleware already 403'd obvious mismatches from JWT claims; this
 * layout re-verifies against the DATABASE — the tenant is loaded by the
 * session's tenantId (never by the URL slug), then the URL slug must match
 * that tenant's real slug, and the tenant must be 'active'. A stale or
 * tampered claim dies here.
 */
export default async function OrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (session.user.role !== "tenant_owner" || !session.user.tenantId) {
    forbidden();
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, session.user.tenantId))
    .limit(1);

  // No tenant for this session, or the URL isn't THIS tenant's slug → 403.
  // Same response either way: nothing reveals whether the slug exists.
  if (!tenant || tenant.slug !== tenantSlug) forbidden();

  if (tenant.status === "suspended") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--paper)",
        }}
      >
        <div
          style={{ maxWidth: 440, textAlign: "center", color: "var(--ink)" }}
        >
          <h1 style={{ fontSize: 22, marginBottom: 12, color: "var(--alert)" }}>
            Dashboard access is paused
          </h1>
          <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.6 }}>
            Your account is suspended. Contact us to resolve billing and
            restore access — your call data is safe and will be here when
            you&apos;re back.
          </p>
        </div>
      </main>
    );
  }

  // 'pending_payment' can't normally reach here (no users row exists), but
  // the invariant is enforced regardless of how a session might come to be.
  if (tenant.status !== "active") forbidden();

  return <>{children}</>;
}
