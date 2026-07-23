import { desc, eq } from "drizzle-orm";

import { db, subscriptions, tenants } from "@/db";
import { requirePartnerPage } from "@/lib/partner-guard";
import { getPartnerLogoUrl } from "@/lib/r2";
import { CreateClientForm } from "./create-client-form";
import { PartnerSignOutButton } from "./signout-button";
import { payForClientAction, resolvePaymentAction } from "./actions";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 10);
}

const TIER_LABELS: Record<string, string> = {
  pilot: "Pilot — $1,000/mo · 3,000 min",
  standard: "Standard — $1,700/mo · 5,600 min",
  pro: "Pro — $2,500/mo · 8,150 min",
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "var(--slate)",
  active: "var(--signal)",
  suspended: "var(--alert)",
};

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "That request wasn't valid — try again.",
  notfound: "Client not found.",
  paid: "That client is already paid and active.",
  config: "Checkout isn't available right now — contact support.",
  checkout: "Checkout creation failed — try again or contact support.",
  portal: "Couldn't open the billing portal — try again or contact support.",
};

/**
 * The partner panel (white-label v1). A partner creates client tenants,
 * pays MONTHLY per client at the standard tier prices (the prices shown
 * here are what the PARTNER pays us — they charge their clients whatever
 * they like, off-platform), and their branding renders on every client
 * dashboard. Data access is pinned to the session's partner everywhere.
 */
export default async function PartnerHomePage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; error?: string }>;
}) {
  const { partner } = await requirePartnerPage();
  const { paid, error } = await searchParams;

  const rows = await db
    .select({ tenant: tenants, sub: subscriptions })
    .from(tenants)
    .leftJoin(subscriptions, eq(subscriptions.tenantId, tenants.id))
    .where(eq(tenants.partnerId, partner.id))
    .orderBy(desc(tenants.createdAt));

  let logoUrl: string | null = null;
  if (partner.logoKey) {
    try {
      logoUrl = await getPartnerLogoUrl(partner.logoKey);
    } catch (err) {
      console.error("[partner] logo presign failed:", err);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        color: "var(--ink)",
      }}
    >
      <header
        style={{
          background: "var(--rail-bg)",
          color: "var(--rail-fg)",
          padding: "14px 32px",
          fontSize: 15,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived presigned URL
            <img
              src={logoUrl}
              alt={`${partner.name} logo`}
              style={{ maxHeight: 28, maxWidth: 140 }}
            />
          ) : (
            <span style={{ fontWeight: 600 }}>{partner.name}</span>
          )}
          <span style={{ fontSize: 12, color: "var(--rail-fg-muted)" }}>
            Partner panel
          </span>
        </span>
        <PartnerSignOutButton />
      </header>

      <main style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
        {paid ? (
          <p
            style={{
              background: "var(--card)",
              border: "1px solid var(--signal)",
              color: "var(--signal)",
              borderRadius: 6,
              padding: "12px 16px",
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            Payment received — the client activates automatically within a
            minute or two, and their owner gets a set-password email.
          </p>
        ) : null}
        {error ? (
          <p
            style={{
              background: "var(--card)",
              border: "1px solid var(--alert)",
              color: "var(--alert)",
              borderRadius: 6,
              padding: "12px 16px",
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            {ERROR_MESSAGES[error] ?? "Something went wrong — try again."}
          </p>
        ) : null}

        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Clients</h1>
        <p style={{ color: "var(--slate)", fontSize: 13, margin: "0 0 24px" }}>
          Prices shown are what you pay per client. You bill your clients at
          your own rates, outside this platform.
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
                {["Business", "Type", "Plan", "Status", "Minutes used", "Created", ""].map(
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
                    colSpan={7}
                    style={{ padding: "24px 12px", color: "var(--slate)" }}
                  >
                    No clients yet — create the first one below.
                  </td>
                </tr>
              ) : (
                rows.map(({ tenant: t, sub }) => {
                  const overdue = sub?.status === "payment_overdue";
                  return (
                    <tr
                      key={t.id}
                      style={{ borderBottom: "1px solid var(--line-soft)" }}
                    >
                      <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                        {t.name}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {t.businessType}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {t.selectedTier
                          ? (TIER_LABELS[t.selectedTier] ?? t.selectedTier)
                          : "—"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            color: overdue
                              ? "var(--alert)"
                              : (STATUS_COLORS[t.status] ?? "var(--ink)"),
                            fontWeight: 600,
                          }}
                        >
                          {overdue ? "payment overdue" : t.status}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--slate)",
                        }}
                      >
                        {sub
                          ? `${sub.minutesUsedThisCycle.toLocaleString()} / ${sub.minuteCap.toLocaleString()}`
                          : "—"}
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
                      <td
                        style={{ padding: "10px 12px", whiteSpace: "nowrap" }}
                      >
                        {t.status === "pending_payment" ? (
                          <form
                            action={payForClientAction}
                            style={{ display: "inline" }}
                          >
                            <input
                              type="hidden"
                              name="tenantId"
                              value={t.id}
                            />
                            <button type="submit" style={payButtonStyle}>
                              Pay &amp; activate
                            </button>
                          </form>
                        ) : null}
                        {overdue ? (
                          <form
                            action={resolvePaymentAction}
                            style={{ display: "inline" }}
                          >
                            <input
                              type="hidden"
                              name="tenantId"
                              value={t.id}
                            />
                            <button type="submit" style={overdueButtonStyle}>
                              Resolve payment
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <h2 style={{ fontSize: 18, margin: "0 0 16px" }}>Create client</h2>
        <p style={{ color: "var(--slate)", fontSize: 13, margin: "0 0 16px" }}>
          The client stays inactive until you pay for it. Once paid, it
          activates automatically and the owner email receives a set-password
          link under your brand. The voice agent is configured for you after
          creation.
        </p>
        <CreateClientForm />
      </main>
    </div>
  );
}

const payButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "var(--signal)",
  color: "var(--on-accent)",
  border: "1px solid var(--signal)",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const overdueButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "var(--card)",
  color: "var(--alert)",
  border: "1px solid var(--alert)",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
