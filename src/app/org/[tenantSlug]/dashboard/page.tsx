import { appRouter } from "@/server";
import { createTrpcContext } from "@/server/context";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  tierLabel,
} from "@/lib/format";
import { parseIntakeSchema } from "@/lib/intake";
import { SUPPORT_EMAIL } from "@/lib/support";
import { CallLog } from "./call-log";
import { PerformanceCards } from "./performance-cards";
import { RailIcon, SignOutButton } from "./signout-button";

export const dynamic = "force-dynamic";

/**
 * The tenant dashboard (Prompt 7), built to docs/05-design-doc.md: instrument
 * panel, left rail, persistent header with the billing pill, performance
 * cards → call log → booking panel. Every byte of data comes from
 * session-scoped tRPC procedures; the [tenantSlug] URL param is never read
 * for data access (Prompt 2's rule).
 */
export default async function DashboardPage() {
  const caller = appRouter.createCaller(await createTrpcContext());

  let data;
  try {
    data = await Promise.all([
      caller.tenant.me(),
      caller.tenant.overview(),
      caller.tenant.billing(),
      caller.tenant.callsList({ limit: 50 }),
      caller.tenant.bookingsList(),
      caller.tenant.liveCalls(),
    ]);
  } catch (error) {
    // Subscription-level suspension (Prompt 6, item 9): the specific error
    // renders as "access revoked, contact support" — not a generic 403 and
    // not a crash. Tenant-level suspension is handled earlier by the layout.
    if (
      error instanceof Error &&
      error.message === "SUBSCRIPTION_SUSPENDED"
    ) {
      return (
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ maxWidth: 440, textAlign: "center" }}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                color: "var(--alert)",
                marginBottom: 12,
              }}
            >
              Dashboard access is paused
            </h1>
            <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.6 }}>
              Access was revoked after an unresolved payment. Contact us at{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to
              restore your subscription — your call data is safe.
            </p>
          </div>
        </main>
      );
    }
    throw error;
  }

  const [me, overview, billing, initialCalls, bookings, liveCalls] = data;

  const intakeConfig = parseIntakeSchema(me.intakeSchema);
  const intakeColumns = intakeConfig.fields ?? [];
  const overdue = billing.hasSubscription && billing.status === "payment_overdue";

  return (
    <div className="dv-shell">
      <nav className="dv-rail">
        <div className="dv-rail-brand">Digivixo</div>
        <a className="dv-rail-link" href="#overview">
          <RailIcon path="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z" />
          Overview
        </a>
        <a className="dv-rail-link" href="#calls">
          <RailIcon path="M4 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 3 4a1 1 0 0 1 1-1" />
          Calls
        </a>
        <a className="dv-rail-link" href="#bookings">
          <RailIcon path="M5 4h10a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4 8h12M8 3v3M12 3v3" />
          Bookings
        </a>
        <div className="dv-rail-footer">
          <SignOutButton />
        </div>
      </nav>

      <main className="dv-main">
        <header className="dv-header">
          <div>
            <h1 style={{ display: "inline" }}>{me.name}</h1>
            <span className="dv-header-slug">/{me.slug}</span>
          </div>
          {overdue ? (
            <span className="dv-pill dv-pill--overdue">Payment overdue</span>
          ) : (
            <span className="dv-pill dv-pill--active">
              <span className="dv-pill-dot" aria-hidden />
              {billing.hasSubscription
                ? `${tierLabel(billing.tier)} · Active`
                : "Active"}
            </span>
          )}
        </header>

        {overdue ? (
          <div className="dv-banner">
            <span>
              Payment failed — please resolve within 3 days or dashboard access
              will be suspended.
              {billing.graceEndsAt
                ? ` Access pauses ${formatDateTime(billing.graceEndsAt)}.`
                : ""}
            </span>
            <span className="dv-banner-actions">
              <a
                className="dv-btn dv-btn--banner"
                href={
                  billing.customerPortalUrl ??
                  `mailto:${SUPPORT_EMAIL}?subject=Retry%20payment%20for%20${encodeURIComponent(me.name)}`
                }
              >
                Retry Payment
              </a>
              <a
                className="dv-btn dv-btn--banner"
                href={`mailto:${SUPPORT_EMAIL}?subject=Billing%20issue%20for%20${encodeURIComponent(me.name)}`}
              >
                Report an Issue
              </a>
            </span>
          </div>
        ) : null}

        <section id="overview" className="dv-section">
          <h2 className="dv-section-title">This billing period</h2>
          <PerformanceCards
            inboundCalls={overview.inboundCalls}
            outboundCalls={overview.outboundCalls}
            bookingsSecured={overview.bookingsSecured}
            initialLiveCount={liveCalls.length}
          />

          <div style={{ marginTop: 16 }} className="dv-billing">
            {billing.hasSubscription ? (
              <>
                <div className="dv-billing-row">
                  <strong>
                    {tierLabel(billing.tier)} — ${billing.monthlyPriceUsd}/mo
                  </strong>
                  <span className="dv-num" style={{ color: "var(--slate)" }}>
                    {formatNumber(billing.minutesUsed)} /{" "}
                    {formatNumber(billing.minuteCap)} min
                  </span>
                </div>
                <div className="dv-meter">
                  <div
                    className={`dv-meter-fill${billing.overageMinutes > 0 ? " dv-meter-fill--over" : ""}`}
                    style={{
                      width: `${Math.min(100, (billing.minutesUsed / billing.minuteCap) * 100)}%`,
                    }}
                  />
                </div>
                <div
                  className="dv-billing-row"
                  style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}
                >
                  <span style={{ color: "var(--slate)" }}>
                    {billing.overageMinutes > 0
                      ? `Overage: ${formatNumber(billing.overageMinutes)} min × $${billing.overageRatePerMinuteUsd}/min`
                      : "No overage this period"}
                  </span>
                  <span style={{ color: "var(--slate)" }} suppressHydrationWarning>
                    Renews {formatDate(billing.currentPeriodEnd)}
                  </span>
                </div>
              </>
            ) : (
              <span style={{ color: "var(--slate)", fontSize: 13 }}>
                Billing is managed by Digivixo — your subscription details will
                appear here once billing is connected.
              </span>
            )}
          </div>
        </section>

        <section id="calls" className="dv-section">
          <h2 className="dv-section-title">Call log</h2>
          <CallLog initialRows={initialCalls} />
        </section>

        <section id="bookings" className="dv-section">
          <h2 className="dv-section-title">Bookings</h2>
          <div className="dv-table-wrap">
            <table className="dv-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Customer</th>
                  {intakeColumns.map((field) => (
                    <th key={field.key}>{field.label ?? field.key}</th>
                  ))}
                  <th>Confirmation</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={3 + intakeColumns.length} className="dv-empty">
                      No bookings yet — when a caller books, it lands here
                      automatically.
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => {
                    const intakeData = (booking.intakeData ?? {}) as Record<
                      string,
                      unknown
                    >;
                    return (
                      <tr key={booking.id}>
                        <td className="dv-num" suppressHydrationWarning>
                          {formatDateTime(booking.bookingTime ?? booking.createdAt)}
                        </td>
                        <td>
                          <span className="dv-field-value">
                            {booking.customerName ?? "Caller"}
                          </span>
                          {booking.customerPhone ? (
                            <div className="dv-field-label dv-num">
                              {booking.customerPhone}
                            </div>
                          ) : null}
                        </td>
                        {intakeColumns.map((field) => {
                          const value = intakeData[field.key];
                          return (
                            <td key={field.key} className="dv-field-value">
                              {value === null || value === undefined
                                ? "—"
                                : Array.isArray(value)
                                  ? value.join(", ")
                                  : String(value)}
                            </td>
                          );
                        })}
                        <td>
                          {booking.emailSentStatus === "sent" ? (
                            <>
                              <span className="dv-dot dv-dot--signal" />
                              Email sent
                            </>
                          ) : booking.emailSentStatus === "failed" ? (
                            <>
                              <span className="dv-dot dv-dot--alert" />
                              Email failed
                            </>
                          ) : (
                            <>
                              <span className="dv-dot" />
                              Email pending
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
