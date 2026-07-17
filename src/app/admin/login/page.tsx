import type { Metadata } from "next";

import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = { title: "Admin — Digivixo" };

export default function AdminLoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#161B22",
      }}
    >
      <AdminLoginForm />
    </main>
  );
}
