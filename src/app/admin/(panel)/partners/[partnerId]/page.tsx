import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { db, partners, tenants, users } from "@/db";
import { getPartnerLogoUrl } from "@/lib/r2";
import { PartnerAdmins } from "./partner-admins";
import { PartnerBrandingForm } from "./partner-branding-form";
import { PartnerLogoForm } from "./partner-logo-form";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

export default async function PartnerManagePage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = await params;

  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1);
  if (!partner) notFound();

  const [admins, clients] = await Promise.all([
    db
      .select()
      .from(users)
      .where(eq(users.partnerId, partner.id))
      .orderBy(desc(users.createdAt)),
    db
      .select()
      .from(tenants)
      .where(eq(tenants.partnerId, partner.id))
      .orderBy(desc(tenants.createdAt)),
  ]);

  let logoUrl: string | null = null;
  if (partner.logoKey) {
    try {
      logoUrl = await getPartnerLogoUrl(partner.logoKey);
    } catch (error) {
      console.error("[admin] partner logo presign failed:", error);
    }
  }

  return (
    <>
      <p style={{ margin: "0 0 8px" }}>
        <Link
          href="/admin/partners"
          style={{ color: "var(--slate)", fontSize: 13 }}
        >
          ← All partners
        </Link>
      </p>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>{partner.name}</h1>
      <p style={{ color: "var(--slate)", fontSize: 13, margin: "0 0 32px" }}>
        {clients.length} client{clients.length === 1 ? "" : "s"} · created{" "}
        {formatDate(partner.createdAt)}
      </p>

      <section style={{ maxWidth: 620, marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Branding</h2>
        <p style={{ color: "var(--slate)", fontSize: 13, margin: "0 0 16px" }}>
          Renders on this partner&apos;s clients&apos; dashboards and as the
          display name on their emails.
        </p>
        <PartnerBrandingForm
          partnerId={partner.id}
          name={partner.name}
          supportEmail={partner.supportEmail}
          billingEmail={partner.billingEmail}
          accentColor={partner.accentColor}
        />
      </section>

      <section style={{ maxWidth: 620, marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Logo</h2>
        <p style={{ color: "var(--slate)", fontSize: 13, margin: "0 0 16px" }}>
          Shown in the dashboard rail instead of the brand name. PNG, JPEG,
          WebP, or SVG, under 2&nbsp;MB.
        </p>
        {logoUrl ? (
          <p style={{ margin: "0 0 12px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived presigned URL, remote patterns don't apply */}
            <img
              src={logoUrl}
              alt={`${partner.name} logo`}
              style={{
                maxHeight: 60,
                maxWidth: 240,
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: 8,
              }}
            />
          </p>
        ) : (
          <p style={{ color: "var(--slate)", fontSize: 13, margin: "0 0 12px" }}>
            No logo uploaded — the brand name renders as text.
          </p>
        )}
        <PartnerLogoForm partnerId={partner.id} />
      </section>

      <section style={{ maxWidth: 620, marginBottom: 40 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Partner admins</h2>
        <p style={{ color: "var(--slate)", fontSize: 13, margin: "0 0 16px" }}>
          Log in at the regular login page and land on the partner panel.
          Same invite flow as staff: emailed set-password link, valid 48
          hours.
        </p>
        <PartnerAdmins
          partnerId={partner.id}
          admins={admins.map((u) => ({
            id: u.id,
            email: u.email,
            active: u.passwordHash !== null,
            createdAt: formatDate(u.createdAt),
          }))}
        />
      </section>

      <section>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Clients</h2>
        <div style={{ overflowX: "auto" }}>
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
                {["Business", "Type", "Tier", "Status", "Retell agent", "Created", ""].map(
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
              {clients.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: "24px 12px", color: "var(--slate)" }}
                  >
                    No clients yet — the partner creates them from their
                    panel.
                  </td>
                </tr>
              ) : (
                clients.map((t) => (
                  <tr
                    key={t.id}
                    style={{ borderBottom: "1px solid var(--line-soft)" }}
                  >
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                      {t.name}
                    </td>
                    <td style={{ padding: "10px 12px" }}>{t.businessType}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {t.selectedTier ?? "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>{t.status}</td>
                    <td
                      style={{
                        padding: "10px 12px",
                        fontFamily: "monospace",
                        fontSize: 12,
                      }}
                    >
                      {t.retellAgentId ?? "—"}
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
                    <td style={{ padding: "10px 12px" }}>
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
      </section>
    </>
  );
}
