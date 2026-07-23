import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums — every field the spec marks as "enum" is a real Postgres enum type,
// not an unconstrained varchar. A malformed webhook payload writing an
// unexpected value into e.g. calls.status or calls.sentiment fails at the DB
// boundary instead of silently breaking dashboard filtering downstream.
// ---------------------------------------------------------------------------

export const tenantStatusEnum = pgEnum("tenant_status", [
  "pending_payment",
  "active",
  "suspended",
]);

// Shared by tenants.selectedTier and subscriptions.tier.
export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "pilot",
  "standard",
  "pro",
]);

export const callDirectionEnum = pgEnum("call_direction", [
  "inbound",
  "outbound",
]);

export const callStatusEnum = pgEnum("call_status", [
  "ringing",
  "in-progress",
  "completed",
  "failed",
]);

export const callSentimentEnum = pgEnum("call_sentiment", [
  "positive",
  "neutral",
  "negative",
  "inquisitive",
]);

export const emailSentStatusEnum = pgEnum("email_sent_status", [
  "pending",
  "sent",
  "failed",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "payment_overdue",
  "suspended",
  "cancelled",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "paid",
  "failed",
]);

// 'admin' is the super-admin (full panel incl. money + staff management);
// 'staff_admin' runs day-to-day onboarding (create tenants, send payment
// links, map agents, set intake) but never sees dollar amounts or invoices.
// 'partner_admin' belongs to a white-label partner: manages that partner's
// client tenants from /partner and pays to activate them.
export const userRoleEnum = pgEnum("user_role", [
  "tenant_owner",
  "admin",
  "staff_admin",
  "partner_admin",
]);

// ---------------------------------------------------------------------------
// partners — white-label resellers (v1: per-client fee + branding only)
//
// A partner resells the platform under their own brand at their own retail
// prices, collected from their end clients OFF-platform. The partner pays US
// monthly per client at the standard tier prices (they are simply the Polar
// payer on their clients' checkouts). Branding here renders on their
// clients' dashboards and email display names.
// ---------------------------------------------------------------------------

export const partners = pgTable("partners", {
  id: varchar("id", { length: 64 }).primaryKey(),
  // The brand their clients see — rail logo text, email display name.
  name: varchar("name", { length: 256 }).notNull(),
  // Client-facing support inbox: rendered on their clients' overdue banners
  // and suspended screens INSTEAD of our support address.
  supportEmail: varchar("support_email", { length: 256 }).notNull(),
  // Where the partner receives Polar receipts for per-client subscriptions —
  // used as customerEmail on partner-paid checkouts.
  billingEmail: varchar("billing_email", { length: 256 }).notNull(),
  // R2 object KEY (not a URL — the bucket is private; the dashboard mints a
  // short-lived presigned URL per load, same pattern as call recordings).
  logoKey: varchar("logo_key", { length: 256 }),
  // Optional hex color swapped in for --signal on their clients' dashboards.
  accentColor: varchar("accent_color", { length: 16 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// tenants
// ---------------------------------------------------------------------------

export const tenants = pgTable(
  "tenants",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    // Used in the dashboard URL (/org/[slug]/...) — routing/display only,
    // never an authorization boundary (see Prompt 2).
    slug: varchar("slug", { length: 128 }).notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    ownerEmail: varchar("owner_email", { length: 256 }).notNull(),
    // e.g. "cpa_firm", "restaurant", "retail" — drives which intake/booking
    // fields render on the dashboard. Free-form by design: new verticals must
    // not require a migration.
    businessType: varchar("business_type", { length: 64 }).notNull(),
    // Per-tenant field definitions for the booking/intake form. A CPA firm's
    // intake (service requested) and a restaurant's (party size, order items)
    // share this one schema-driven column instead of vertical-specific tables.
    intakeSchema: jsonb("intake_schema").notNull(),
    // Only the Polar subscription-active webhook (Prompt 6) may flip this to
    // 'active'. No other code path is allowed to — hard invariant.
    status: tenantStatusEnum("status").notNull().default("pending_payment"),
    // Set at tenant creation so the correct Polar checkout link can be
    // generated for this tenant later.
    selectedTier: subscriptionTierEnum("selected_tier"),
    // Generated by us and passed through the Polar checkout session so the
    // webhook handler can match a payment back to this exact row without
    // relying on email matching alone.
    polarCustomerReference: varchar("polar_customer_reference", {
      length: 128,
    }),
    // Stamped when the admin sends a Polar checkout link (Prompt 2.5) so the
    // admin list shows whether/when a link went out — avoids blind re-sends.
    paymentLinkSentAt: timestamp("payment_link_sent_at", {
      withTimezone: true,
    }),
    // Set when this tenant belongs to a white-label partner: the partner
    // created it, pays for it, and their branding renders on its dashboard.
    // Null = a direct Digivixo tenant; nothing else changes for those.
    partnerId: varchar("partner_id", { length: 64 }).references(
      () => partners.id,
    ),
    // SPEC ADDITION (flagged in PR): Retell webhooks identify calls only by
    // agent_id, so tenant attribution needs this mapping. Set in the admin
    // panel once the agent is configured in Retell's dashboard (docs/02 §1).
    // Unique — one agent must never serve two tenants.
    retellAgentId: varchar("retell_agent_id", { length: 128 }),
    // Prompt 8 item 1: outbound calling is explicit opt-in per tenant, never
    // a default-on feature. Every code path that would place an outbound
    // call MUST check this via checkOutboundCallAllowed and no-op if false.
    outboundCallingEnabled: boolean("outbound_calling_enabled")
      .notNull()
      .default(false),
    // Prompt 8 item 2: free-text record, captured at onboarding, of how this
    // tenant states they obtain calling consent from their customers (e.g.
    // "opt-in via booking form"). Not a compliance guarantee — a documented
    // record that the question was asked.
    consentBasis: text("consent_basis"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("tenants_slug_idx").on(t.slug),
    uniqueIndex("tenants_retell_agent_id_idx").on(t.retellAgentId),
    index("tenants_partner_id_idx").on(t.partnerId),
  ],
);

// ---------------------------------------------------------------------------
// calls
// ---------------------------------------------------------------------------

export const calls = pgTable(
  "calls",
  {
    // Retell call_id. The PK plus the explicit unique index below guarantee a
    // retried Retell webhook can never create a duplicate row — the prior
    // version of this schema had no idempotency protection and double-counted
    // metrics on retry.
    id: varchar("id", { length: 128 }).primaryKey(),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => tenants.id),
    direction: callDirectionEnum("direction").notNull(),
    status: callStatusEnum("status").notNull(),
    phoneNumber: varchar("phone_number", { length: 32 }).notNull(),
    durationSeconds: integer("duration_seconds"),
    // Permanent R2 object key — NOT the ephemeral Retell URL, and not a
    // permanently public link; playback goes through short-lived signed URLs
    // (Prompts 4 and 8).
    recordingUrl: varchar("recording_url", { length: 1024 }),
    transcript: jsonb("transcript"),
    summary: text("summary"),
    sentiment: callSentimentEnum("sentiment"),
    // Prompt 8 item 4: per-CALL consent record (distinct from the tenant-
    // level field) — why this specific outbound call was placed, e.g.
    // "informational follow-up on existing booking". Set by the outbound
    // trigger when one exists; null for inbound calls. This is the granular
    // record that matters if a specific call is ever disputed.
    consentBasis: text("consent_basis"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("calls_tenant_id_idx").on(t.tenantId),
    // Explicit DB-level unique constraint on id, per spec, in addition to the
    // PK — webhook-retry idempotency must hold even if the PK definition ever
    // changes.
    uniqueIndex("calls_id_unique_idx").on(t.id),
  ],
);

// ---------------------------------------------------------------------------
// bookings
// ---------------------------------------------------------------------------

export const bookings = pgTable(
  "bookings",
  {
    // UUID string, not serial — every table in this schema uses varchar IDs so
    // ID handling in the app layer never branches by type.
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => tenants.id),
    callId: varchar("call_id", { length: 128 })
      .notNull()
      .references(() => calls.id),
    // Voice-captured data is unreliable: a caller who doesn't give a name or
    // email must not break the insert, hence nullable.
    customerName: varchar("customer_name", { length: 256 }),
    customerEmail: varchar("customer_email", { length: 256 }),
    // Fallback contact method — email is often unavailable on voice calls.
    customerPhone: varchar("customer_phone", { length: 32 }),
    // Flexible per-tenant fields matching tenants.intakeSchema (order details,
    // service type, party size — whatever that tenant's business needs).
    intakeData: jsonb("intake_data").notNull(),
    bookingTime: timestamp("booking_time", { withTimezone: true }).defaultNow(),
    // Three states, not a boolean: "never tried" and "tried and failed" must
    // be distinguishable so the retry worker (Prompt 5) can find failed sends.
    emailSentStatus: emailSentStatusEnum("email_sent_status")
      .notNull()
      .default("pending"),
    // SPEC ADDITION (flagged in PR): the retry worker gives up permanently
    // after 3 retries — that count has to live somewhere durable, not in a
    // cache. 0 = never attempted; initial send + 3 retries = 4 max.
    emailAttempts: integer("email_attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("bookings_tenant_id_idx").on(t.tenantId),
    index("bookings_call_id_idx").on(t.callId),
  ],
);

// ---------------------------------------------------------------------------
// subscriptions
// ---------------------------------------------------------------------------

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: varchar("id", { length: 64 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    // Unique: one active subscription per tenant. The unique index doubles as
    // the FK index.
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => tenants.id),
    tier: subscriptionTierEnum("tier").notNull(),
    // 1000.00 / 1700.00 / 2500.00 — see src/lib/pricing.ts (source of truth)
    monthlyPriceUsd: numeric("monthly_price_usd", {
      precision: 10,
      scale: 2,
    }).notNull(),
    // 3000 / 5600 / 8150 — clears the 40% net margin floor after Retell's
    // $0.155/min cost AND Polar's 5% + $0.50 fee. Derived numbers, not
    // constants: recalculate if either rate changes (see src/lib/pricing.ts).
    minuteCap: integer("minute_cap").notNull(),
    // The rate configured on Polar's metered price for the call_minutes meter
    // — Polar bills overage automatically once the meter crosses the included
    // quantity; our app never calculates or pushes overage charges itself.
    overageRatePerMinuteUsd: numeric("overage_rate_per_minute_usd", {
      precision: 6,
      scale: 2,
    })
      .notNull()
      .default("0.27"),
    // Local counter for the dashboard usage bar and grace-period logic. Kept
    // in sync with, but separate from, Polar's meter (fed via usage event
    // ingestion), which is the actual billing source.
    minutesUsedThisCycle: integer("minutes_used_this_cycle")
      .notNull()
      .default(0),
    // Required for every Polar usage event ingestion call.
    polarCustomerId: varchar("polar_customer_id", { length: 128 }),
    // Polar owns subscription lifecycle natively — status below is a local
    // cache synced from Polar webhooks, not the source of truth.
    polarSubscriptionId: varchar("polar_subscription_id", { length: 128 }),
    // Synced via Polar webhook events (Prompt 6); app logic only writes it
    // directly for the 3-day-grace-window suspension check.
    status: subscriptionStatusEnum("status").notNull(),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }).notNull(),
    // Set when a Polar payment-failed webhook fires; drives the 3-day grace
    // window calculation.
    overdueSince: timestamp("overdue_since", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("subscriptions_tenant_id_idx").on(t.tenantId)],
);

// ---------------------------------------------------------------------------
// invoices
// ---------------------------------------------------------------------------

export const invoices = pgTable(
  "invoices",
  {
    id: varchar("id", { length: 64 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => tenants.id),
    subscriptionId: varchar("subscription_id", { length: 64 })
      .notNull()
      .references(() => subscriptions.id),
    // Base tier price + any overage Polar attached from the call_minutes
    // meter, read back from the webhook payload — never calculated by us.
    amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }).notNull(),
    // Display-only, sourced from the invoice line item in Polar's webhook
    // payload, not recalculated.
    overageMinutes: integer("overage_minutes").notNull().default(0),
    overageChargeUsd: numeric("overage_charge_usd", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("0"),
    // Polar's order/invoice reference from their webhook payload.
    polarOrderId: varchar("polar_order_id", { length: 128 }),
    status: invoiceStatusEnum("status").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [
    index("invoices_tenant_id_idx").on(t.tenantId),
    index("invoices_subscription_id_idx").on(t.subscriptionId),
  ],
);

// ---------------------------------------------------------------------------
// users
//
// Created ONLY by the Polar activation webhook (Prompt 2.5) for tenants, and
// by the seed script for the single admin. A 'pending_payment' tenant never
// has a users row — no login can exist before payment. Hard invariant.
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 64 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    // DIVERGENCE FROM SPEC (flagged in PR): the spec marks tenantId NOT NULL,
    // but admin-side users ('admin', 'staff_admin') belong to no tenant.
    // Rather than fabricate a fake tenant row, tenantId is nullable with a
    // CHECK below enforcing that ONLY admin-side roles may have it null —
    // every tenant_owner row still requires a tenant, exactly as the spec
    // intends.
    tenantId: varchar("tenant_id", { length: 64 }).references(() => tenants.id),
    // Set ONLY for role 'partner_admin' — scopes the /partner panel exactly
    // the way tenantId scopes /org for tenant owners.
    partnerId: varchar("partner_id", { length: 64 }).references(
      () => partners.id,
    ),
    // Always stored lowercased — normalize at every app boundary before
    // insert or lookup.
    email: varchar("email", { length: 256 }).notNull(),
    // Null until the set-password flow completes. A user with a null hash can
    // never authenticate.
    passwordHash: varchar("password_hash", { length: 256 }),
    role: userRoleEnum("role").notNull().default("tenant_owner"),
    // Stores the SHA-256 HEX DIGEST of the raw token, never the raw token —
    // a leaked DB row cannot be replayed into a working set-password link.
    setPasswordToken: varchar("set_password_token", { length: 128 }),
    setPasswordTokenExpiresAt: timestamp("set_password_token_expires_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    index("users_tenant_id_idx").on(t.tenantId),
    index("users_partner_id_idx").on(t.partnerId),
    check(
      "users_admin_or_tenant_check",
      // Each role must carry the scope it authorizes: tenant owners a tenant,
      // partner admins a partner, admin-side roles neither.
      // ::text on purpose: comparing the enum column as text keeps the
      // migration that adds an enum value single-file — a CHECK referencing a
      // just-added ENUM VALUE in the same transaction is rejected by Postgres
      // ("unsafe use of new value"), the text comparison is not.
      sql`${t.role}::text IN ('admin', 'staff_admin') OR (${t.role}::text = 'tenant_owner' AND ${t.tenantId} IS NOT NULL) OR (${t.role}::text = 'partner_admin' AND ${t.partnerId} IS NOT NULL)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// suppressedNumbers — Prompt 8 item 3
//
// Per-tenant do-not-call list: numbers a tenant's customers have asked not
// to be called, or that the tenant supplied directly. Checked (alongside the
// National DNC Registry) before ANY outbound call is placed.
// ---------------------------------------------------------------------------

export const suppressedNumbers = pgTable(
  "suppressed_numbers",
  {
    id: varchar("id", { length: 64 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    tenantId: varchar("tenant_id", { length: 64 })
      .notNull()
      .references(() => tenants.id),
    // Stored normalized (digits with leading +) so lookups can't miss on
    // formatting differences.
    phoneNumber: varchar("phone_number", { length: 32 }).notNull(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("suppressed_numbers_tenant_id_idx").on(t.tenantId),
    uniqueIndex("suppressed_numbers_tenant_phone_idx").on(
      t.tenantId,
      t.phoneNumber,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type SuppressedNumber = typeof suppressedNumbers.$inferSelect;
export type NewSuppressedNumber = typeof suppressedNumbers.$inferInsert;
