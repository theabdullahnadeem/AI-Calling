import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in — Digivixo" };

export default function LoginPage() {
  return (
    <main className="ui-auth-screen">
      <LoginForm />
    </main>
  );
}
