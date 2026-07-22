import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payment received — Digivixo" };

/** Polar redirects here after a successful hosted checkout. */
export default function CheckoutSuccessPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--paper)",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center", color: "var(--ink)" }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Payment received</h1>
        <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.6 }}>
          Your subscription is being set up. Within a few minutes you&apos;ll
          receive an email with a link to set your dashboard password — that
          link is your way in.
        </p>
      </div>
    </main>
  );
}
