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
        background: "#FAFAF8",
        fontFamily:
          "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: "#161B22",
      }}
    >
      <header
        style={{
          background: "#161B22",
          color: "#FAFAF8",
          padding: "14px 32px",
          fontSize: 15,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 600 }}>Digivixo Admin</span>
        <span style={{ fontSize: 12, color: "#9AA3AF" }}>
          Internal onboarding panel
        </span>
      </header>
      <main style={{ padding: "32px", maxWidth: 1100, margin: "0 auto" }}>
        {children}
      </main>
    </div>
  );
}
