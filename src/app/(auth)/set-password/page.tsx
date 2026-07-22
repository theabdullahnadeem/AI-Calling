import type { Metadata } from "next";

import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Set your password — Digivixo" };

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="ui-auth-screen">
      {token ? (
        <SetPasswordForm token={token} />
      ) : (
        <p style={{ color: "var(--ink)", fontSize: 14 }}>
          This page needs the link from your welcome email. Open the email and
          use the button there.
        </p>
      )}
    </main>
  );
}
