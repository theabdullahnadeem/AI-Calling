import type { ReactNode } from "react";

import { requireAdminPage } from "@/lib/admin-guard";

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminPage();

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
        }}
      >
        <span style={{ fontWeight: 600 }}>Digivixo Admin</span>
        <span style={{ fontSize: 12, color: "var(--rail-fg-muted)" }}>
          Internal onboarding panel
        </span>
      </header>
      <main style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}
