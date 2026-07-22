import type { Metadata } from "next";

import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = { title: "Admin — Digivixo" };

export default function AdminLoginPage() {
  return (
    <main className="ui-auth-screen ui-auth-screen--dark">
      <AdminLoginForm />
    </main>
  );
}
