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
        background: "#FAFAF8",
        fontFamily:
          "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center", color: "#161B22" }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Payment received</h1>
        <p style={{ fontSize: 14, color: "#5B6472", lineHeight: 1.6 }}>
          Your subscription is being set up. Within a few minutes you&apos;ll
          receive an email with a link to set your dashboard password — that
          link is your way in.
        </p>
      </div>
    </main>
  );
}
