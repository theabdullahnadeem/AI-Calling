import { appRouter } from "@/server";
import { createTrpcContext } from "@/server/context";

export const dynamic = "force-dynamic";

/**
 * Placeholder dashboard proving the full auth chain: middleware → org layout
 * → protectedTenantProcedure. Prompt 7 replaces this with the real UI per
 * the design doc. Data comes from tRPC procedures scoped by the SESSION —
 * the [tenantSlug] URL param is not read here at all.
 */
export default async function DashboardPage() {
  const caller = appRouter.createCaller(await createTrpcContext());
  const me = await caller.tenant.me();
  const overview = await caller.tenant.overview();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#FAFAF8",
        padding: 32,
        fontFamily:
          "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: "#161B22",
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{me.name}</h1>
      <p style={{ fontSize: 13, color: "#5B6472", marginBottom: 32 }}>
        {me.slug} · {me.businessType} · {me.status}
      </p>
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { label: "Calls received", value: overview.totalCalls },
          { label: "Bookings secured", value: overview.totalBookings },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "#FFFFFF",
              border: "1px solid #E4E4E0",
              borderRadius: 6,
              padding: "20px 28px",
              minWidth: 180,
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {card.value}
            </div>
            <div style={{ fontSize: 13, color: "#5B6472" }}>{card.label}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "#5B6472", marginTop: 40 }}>
        Full dashboard arrives with Prompt 7.
      </p>
    </main>
  );
}
