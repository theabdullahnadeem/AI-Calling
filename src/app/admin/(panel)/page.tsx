import { desc } from "drizzle-orm";

import { db, tenants } from "@/db";
import { AgentIdForm } from "./agent-id-form";
import { CreateTenantForm } from "./create-tenant-form";
import { SendLinkButton } from "./send-link-button";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "var(--slate)",
  active: "var(--signal)",
  suspended: "var(--alert)",
};

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

/**
 * The tenant list is the operational source of truth: who has been created,
 * who was sent a link (and when), who is actually paying.
 */
export default async function AdminHomePage() {
  const rows = await db
    .select()
    .from(tenants)
    .orderBy(desc(tenants.createdAt));

  return (
    <>
      <h1 style={{ fontSize: 22, margin: "0 0 24px" }}>Tenants</h1>

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
              {[
                "Business",
                "Slug",
                "Type",
                "Tier",
                "Status",
                "Retell agent",
                "Link sent",
                "Created",
                "",
              ].map((h) => (
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
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ padding: "24px 12px", color: "var(--slate)" }}
                >
                  No tenants yet — create the first one below.
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                    {t.name}
                  </td>
                  <td style={{ padding: "10px 12px", color: "var(--slate)" }}>
                    {t.slug}
                  </td>
                  <td style={{ padding: "10px 12px" }}>{t.businessType}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {t.selectedTier ?? "—"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        color: STATUS_COLORS[t.status] ?? "var(--ink)",
                        fontWeight: 600,
                      }}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <AgentIdForm
                      tenantId={t.id}
                      currentAgentId={t.retellAgentId}
                    />
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "var(--slate)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatDate(t.paymentLinkSentAt)}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      color: "var(--slate)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatDate(t.createdAt)}
                  </td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                    {t.status === "pending_payment" ? (
                      <SendLinkButton
                        tenantId={t.id}
                        alreadySent={t.paymentLinkSentAt !== null}
                      />
                    ) : null}{" "}
                    <a
                      href={`/admin/tenants/${t.id}`}
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

      <h2 style={{ fontSize: 18, margin: "0 0 16px" }}>Create tenant</h2>
      <CreateTenantForm />
    </>
  );
}
