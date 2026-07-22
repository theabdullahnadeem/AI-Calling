import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { db, suppressedNumbers, tenants } from "@/db";
import { ComplianceForm } from "./compliance-form";
import { SuppressionList } from "./suppression-list";

export const dynamic = "force-dynamic";

/**
 * Per-tenant compliance controls (Prompt 8): outbound-calling opt-in with
 * its consent-basis record, and the do-not-call suppression list. Kept off
 * the crowded tenant list — these settings deserve a page where the admin
 * reads what they're toggling.
 */
export default async function TenantManagePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) notFound();

  const suppressed = await db
    .select()
    .from(suppressedNumbers)
    .where(eq(suppressedNumbers.tenantId, tenant.id))
    .orderBy(desc(suppressedNumbers.addedAt));

  return (
    <>
      <p style={{ margin: "0 0 8px" }}>
        <Link href="/admin" style={{ color: "var(--slate)", fontSize: 13 }}>
          ← All tenants
        </Link>
      </p>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>{tenant.name}</h1>
      <p style={{ color: "var(--slate)", fontSize: 13, margin: "0 0 32px" }}>
        {tenant.slug} · {tenant.businessType} · {tenant.status}
      </p>

      <section style={{ maxWidth: 620, marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Outbound calling</h2>
        <p style={{ color: "var(--slate)", fontSize: 13, margin: "0 0 16px" }}>
          Off by default for every tenant. Enable only after the compliance
          conversation — record how this tenant obtains calling consent below.
          This record does not by itself make outbound calling legally
          compliant (see docs/04).
        </p>
        <ComplianceForm
          tenantId={tenant.id}
          outboundCallingEnabled={tenant.outboundCallingEnabled}
          consentBasis={tenant.consentBasis}
        />
      </section>

      <section style={{ maxWidth: 620 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>
          Suppression list (do not call)
        </h2>
        <p style={{ color: "var(--slate)", fontSize: 13, margin: "0 0 16px" }}>
          Numbers this tenant&apos;s customers asked never to be called, or
          that the tenant supplied directly. Checked before every outbound
          call, alongside the National DNC Registry.
        </p>
        <SuppressionList
          tenantId={tenant.id}
          entries={suppressed.map((row) => ({
            id: row.id,
            phoneNumber: row.phoneNumber,
            addedAt: row.addedAt.toISOString(),
          }))}
        />
      </section>
    </>
  );
}
