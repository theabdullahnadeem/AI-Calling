import { count, desc, eq } from "drizzle-orm";

import { db, partners, tenants } from "@/db";
import { CreatePartnerForm } from "./create-partner-form";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

/**
 * White-label partners (v1): resellers who run their own client tenants from
 * /partner, pay us monthly per client at retail tier prices, and whose
 * branding renders on their clients' dashboards. Managed here by both
 * admin-side roles — nothing on this page is a dollar amount or invoice.
 */
export default async function PartnersPage() {
  const rows = await db
    .select({
      partner: partners,
      clientCount: count(tenants.id),
    })
    .from(partners)
    .leftJoin(tenants, eq(tenants.partnerId, partners.id))
    .groupBy(partners.id)
    .orderBy(desc(partners.createdAt));

  return (
    <>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Partners</h1>
      <p style={{ color: "var(--slate)", fontSize: 13, margin: "0 0 24px" }}>
        White-label resellers. Each manages its own clients from the partner
        panel and pays per client; their branding replaces ours on their
        clients&apos; dashboards and emails.
      </p>

      <div style={{ overflowX: "auto", marginBottom: 48 }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 6,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: "var(--slate)" }}>
              {["Partner", "Support email", "Billing email", "Clients", "Created", ""].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--line)",
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{ padding: "24px 12px", color: "var(--slate)" }}
                >
                  No partners yet — create the first one below.
                </td>
              </tr>
            ) : (
              rows.map(({ partner, clientCount }) => (
                <tr
                  key={partner.id}
                  style={{ borderBottom: "1px solid var(--line-soft)" }}
                >
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                    {partner.name}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--slate)" }}>
                    {partner.supportEmail}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--slate)" }}>
                    {partner.billingEmail}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {clientCount}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "var(--slate)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatDate(partner.createdAt)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <a
                      href={`/admin/partners/${partner.id}`}
                      style={{ color: "var(--signal)", fontSize: 12 }}
                    >
                      Manage
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 18, margin: "0 0 16px" }}>Create partner</h2>
      <CreatePartnerForm />
    </>
  );
}
