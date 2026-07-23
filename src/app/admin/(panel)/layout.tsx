import Link from "next/link";
import type { ReactNode } from "react";

import { requireAdminPage } from "@/lib/admin-guard";

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Allows both admin-side roles; the role decides what the header offers —
  // staff never see a link to staff management (and the middleware + page
  // guard 404 them if they type the URL).
  const session = await requireAdminPage();
  const isSuperAdmin = session.user.role === "admin";

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
        <span style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
          <span style={{ fontWeight: 600 }}>Digivixo Admin</span>
          <Link
            href="/admin"
            style={{ color: "var(--rail-fg)", fontSize: 13 }}
          >
            Tenants
          </Link>
          {isSuperAdmin ? (
            <Link
              href="/admin/staff"
              style={{ color: "var(--rail-fg)", fontSize: 13 }}
            >
              Staff
            </Link>
          ) : null}
        </span>
        <span style={{ fontSize: 12, color: "var(--rail-fg-muted)" }}>
          {isSuperAdmin ? "Internal onboarding panel" : "Staff panel"} ·{" "}
          {session.user.email}
        </span>
      </header>
      <main style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}
