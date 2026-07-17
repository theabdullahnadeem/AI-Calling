# Digivixo Voice AI Platform — Claude Code Build Prompts

**Stack:** Next.js (App Router) + tRPC · Drizzle ORM + Neon Postgres · Redis (Upstash) · Retell (voice backend, white-label) · Resend (email) · Cloudflare R2 (permanent audio storage) · Polar (billing/subscriptions, Merchant of Record, manual payouts)

**Model:** Managed-service agency. All Retell configuration (agent prompts, telephony routing, LLM tuning) is done by Digivixo on the backend. Tenants get a read-only dashboard: calls, bookings, sentiment, transcripts, billing status. Nothing here is restaurant-specific — booking/intake fields are configurable per tenant at onboarding (CPA firm intake looks different from a restaurant reservation, same underlying schema).

Run these prompts in order. Each assumes the previous one is complete and committed.

---

## PROMPT 1 — Drizzle Schema + Migrations (Neon Postgres)

```
Create a complete Drizzle ORM schema for a multi-tenant voice AI platform on Neon Postgres.
Generate the following tables with full TypeScript types:

tenants
- id (varchar, PK)
- slug (varchar, unique, not null) — used in dashboard URL, must be unique and indexed
- name (varchar, not null)
- ownerEmail (varchar, not null)
- businessType (varchar, not null) — e.g. "cpa_firm", "restaurant", "retail" — drives which
  intake/booking fields render on the dashboard
- intakeSchema (jsonb, not null) — per-tenant configurable field definitions for the booking
  form (e.g. CPA firm needs "service requested", restaurant needs "party size" and "order items")
- status (varchar, not null, default 'pending_payment') — enum: 'pending_payment' | 'active'
  | 'suspended'. Created via the admin panel BEFORE payment (see Prompt 2.5) with status
  'pending_payment' — no user account exists yet at this point and no dashboard access is
  possible regardless of anything else in the system. Only the Polar 'subscription.active'
  webhook (Prompt 6) is allowed to flip this to 'active'. Do not let any other code path
  set status to 'active'.
- selectedTier (varchar, nullable) — enum: 'pilot' | 'standard' | 'pro'. Set at tenant
  creation so the correct Polar checkout link can be generated for this tenant later.
- polarCustomerReference (varchar, nullable) — a reference ID we generate and pass through
  the Polar checkout session (e.g. as client_reference_id or metadata) so the webhook
  handler can match an incoming payment back to the correct tenant row without relying on
  email matching alone.
- createdAt (timestamp, default now)

calls
- id (varchar, PK) — Retell call_id
- tenantId (varchar, FK -> tenants.id, not null, indexed)
- direction (varchar, not null) — 'inbound' | 'outbound'
- status (varchar, not null) — constrain to enum: 'ringing' | 'in-progress' | 'completed' | 'failed'
- phoneNumber (varchar, not null)
- durationSeconds (integer)
- recordingUrl (varchar) — permanent S3/Cloudinary URL, NOT the ephemeral Retell URL
- transcript (jsonb)
- summary (text)
- sentiment (varchar) — constrain to enum: 'positive' | 'neutral' | 'negative' | 'inquisitive'
- createdAt (timestamp, default now)
- updatedAt (timestamp, default now, auto-update on row change)

Add a unique constraint on calls.id at the DB level (not just PK) to guarantee webhook
retries can't create duplicate rows — this is a rebuild against a prior version of this schema
that had no idempotency protection and would double-count metrics on retry.

bookings
- id (varchar, PK) — generate as a UUID string, not serial. All other tables use varchar IDs;
  keep this consistent so ID handling in the app layer doesn't branch by type.
- tenantId (varchar, FK -> tenants.id, not null, indexed)
- callId (varchar, FK -> calls.id, not null)
- customerName (varchar) — NULLABLE. Voice-captured data is unreliable; a caller who doesn't
  give a name should not break the insert.
- customerEmail (varchar) — NULLABLE, same reasoning.
- customerPhone (varchar) — capture this as a fallback contact method since email is often
  unavailable on voice calls.
- intakeData (jsonb, not null) — flexible per-tenant fields matching tenants.intakeSchema
  (order details, service type, party size, whatever that tenant's business needs)
  instead of hardcoded restaurant-specific columns
- bookingTime (timestamp, default now)
- emailSentStatus (varchar, not null, default 'pending') — enum: 'pending' | 'sent' | 'failed'.
  Boolean isn't enough — we need to distinguish "never tried" from "tried and failed" so a
  retry worker can find failed sends specifically.
- createdAt (timestamp, default now)
- updatedAt (timestamp, default now, auto-update)

subscriptions
- id (varchar, PK)
- tenantId (varchar, FK -> tenants.id, not null, unique — one active subscription per tenant)
- tier (varchar, not null) — enum: 'pilot' | 'standard' | 'pro'
- monthlyPriceUsd (numeric, not null) — 800.00 / 1500.00 / 2200.00
- minuteCap (integer, not null) — 2940 / 5514 / 8088 respectively (40% net margin floor
  after Retell's $0.155/min cost AND Polar's 5% + $0.50 transaction fee — see product
  overview doc for the full math; these caps are lower than a naive $0.155-only calc
  because Polar's cut has to come out before the margin target is applied)
- overageRatePerMinuteUsd (numeric, not null, default 0.27) — this is the rate configured
  on Polar's metered price for the call_minutes meter, not something calculated and pushed
  by our own app — Polar bills overage automatically once the meter crosses the included
  quantity, per its Events → Meters → Metered Prices mechanism.
- minutesUsedThisCycle (integer, not null, default 0) — our own local counter, used for the
  dashboard usage bar and grace-period logic. Kept in sync with, but separate from, Polar's
  own meter (which is fed via usage event ingestion and is the actual billing source).
- polarCustomerId (varchar) — required for every usage event ingestion call.
- polarSubscriptionId (varchar) — the subscription object ID returned by Polar's API. Polar
  owns subscription lifecycle state (active/past_due/canceled) natively — do not duplicate
  full lifecycle tracking in this table; treat `status` below as a local cache synced from
  Polar's webhook events, not the source of truth.
- status (varchar, not null) — enum: 'active' | 'payment_overdue' | 'suspended' | 'cancelled'
  — kept in sync via Polar webhook events (see Prompt 6), not written directly by app logic
  except for the 3-day-grace-window suspension check.
- currentPeriodStart (timestamp, not null)
- currentPeriodEnd (timestamp, not null)
- overdueSince (timestamp, nullable) — set when a Polar payment-failed webhook fires; used
  to calculate the 3-day grace window
- createdAt (timestamp, default now)
- updatedAt (timestamp, default now, auto-update)

invoices
- id (varchar, PK)
- tenantId (varchar, FK -> tenants.id, not null, indexed)
- subscriptionId (varchar, FK -> subscriptions.id, not null)
- amountUsd (numeric, not null) — base tier price + any overage Polar attached from the
  call_minutes meter, read back from the webhook payload — not calculated by our own app.
- overageMinutes (integer, not null, default 0) — for display purposes on the dashboard;
  sourced from the invoice line item Polar's webhook payload includes, not recalculated.
- overageChargeUsd (numeric, not null, default 0) — same: read from Polar's payload.
- polarOrderId (varchar) — Polar's order/invoice reference from their webhook payload
- status (varchar, not null) — enum: 'pending' | 'paid' | 'failed'
- issuedAt (timestamp, default now)
- paidAt (timestamp, nullable)

Implement all migrations. Add indexes on every foreign key column and on tenants.slug.
Use Postgres CHECK constraints (or Drizzle enum types) for every field I've marked as
"enum" above — do not leave these as unconstrained varchar, since a malformed webhook
payload writing an unexpected value into calls.status or calls.sentiment will silently
break dashboard filtering logic downstream.
```

---

## PROMPT 2.5 — Auth + Admin Panel (Tenant Creation, Payment Link, Webhook-Triggered Account Creation)

```
Build the authentication layer and an internal admin panel for onboarding clients. This is
a real, ongoing-use internal tool (not a throwaway script) since it will be used for every
new client and needs to give a clear record of each tenant's onboarding state. Keep it
simple, but build it as a proper protected route with a small UI, not just a form.

SEQUENCE THIS BUILDS TOWARD (confirm this matches before generating code — this is the
agreed flow):
1. Admin creates a tenant in the panel. tenants.status = 'pending_payment'. No user account
   exists yet.
2. Admin clicks "Send Payment Link" for that tenant. A Polar checkout session is generated
   for the tenant's selectedTier and emailed to them via Resend. No account, no login,
   nothing else happens yet.
3. Client pays on Polar's hosted checkout page.
4. Polar sends a subscription.active (or order.paid — confirm exact event name against
   Polar's current webhook docs) webhook. ONLY this webhook is allowed to: set
   tenants.status = 'active', create the corresponding users row, generate a
   setPasswordToken, and send the "set your password" email. This must happen automatically
   inside the webhook handler — it is not a second manual admin action.
5. Client sets their password and logs in to see their real dashboard.

Build the following:

1. Add a `users` table to the Drizzle schema:
   - id (varchar, PK)
   - tenantId (varchar, FK -> tenants.id, not null, indexed)
   - email (varchar, not null, unique)
   - passwordHash (varchar, nullable)
   - role (varchar, not null, default 'tenant_owner') — enum: 'tenant_owner' | 'admin'
   - setPasswordToken (varchar, nullable)
   - setPasswordTokenExpiresAt (timestamp, nullable)
   - createdAt (timestamp, default now)

2. Use an auth library (Better Auth or NextAuth) for session management and password
   hashing. Do not hand-roll password hashing.

3. Admin panel at /admin (protected by a separate admin login, role = 'admin', you are the
   only user):
   - Tenant list view: shows every tenant with its status (pending_payment / active /
     suspended), business name, tier, and created date — this is the "record of each and
     everything" the admin panel needs to provide. This list is the source of truth for
     which prospects you've sent links to and who's actually paying.
   - "Create Tenant" form: business name, owner email, business type, selected tier. On
     submit: create the `tenants` row with status = 'pending_payment' and a generated
     polarCustomerReference. Do NOT create a `users` row at this step — no login should be
     possible for an unpaid tenant.
   - Per-tenant action: "Send Payment Link" button. Generates a Polar checkout session for
     that tenant's selectedTier, passing polarCustomerReference through as the checkout's
     client reference / metadata so the webhook can match payment back to this exact tenant
     row. Sends the checkout URL to the tenant's ownerEmail via Resend. Log a timestamp on
     the tenant record (paymentLinkSentAt) so the admin list shows whether/when a link was
     sent, to avoid re-sending blindly.

4. Webhook handler update (extends Prompt 6's /api/webhooks/polar): on subscription.active /
   order.paid, look up the tenant by polarCustomerReference from the webhook payload's
   metadata. If found and tenants.status is 'pending_payment':
   - Set tenants.status = 'active'
   - Create the subscriptions row (per Prompt 1's schema) with the confirmed polarSubscriptionId
   - Create the users row for this tenant (email = tenants.ownerEmail, role = 'tenant_owner',
     no passwordHash yet)
   - Generate a setPasswordToken (expires in 48 hours)
   - Send the "set your password" email via Resend
   If a webhook arrives for a tenant that's already 'active' (e.g. a renewal payment, not
   the first one), do NOT recreate the user or resend the set-password email — only the
   first activation should trigger account creation. Treat this webhook handler as
   idempotent per tenant.

5. Set-password page at /set-password: validates the token (unexpired, unused), lets the
   user set a password, hashes it, saves it, invalidates the token, creates a session,
   redirects to their dashboard.

6. Login page at /login: email + password → validate against users.passwordHash → create a
   session containing the user's tenantId → redirect to /org/[their-slug]/dashboard. If no
   users row exists for the entered email (i.e. tenant hasn't paid yet), show a generic
   "invalid credentials" error — do not reveal whether a tenant record exists in
   'pending_payment' state, since that's account-enumeration information leakage.

7. A tenant's dashboard should only ever be reachable for tenants.status = 'active'. There
   should be no code path — admin action, direct URL, or otherwise — that grants dashboard
   access to a 'pending_payment' tenant. This is a hard invariant, not a soft default.
```

---

## PROMPT 2 — Tenant-Scoped Auth Middleware (fixes a real vulnerability)

```
Build tenant-scoped authentication middleware for the Next.js App Router dashboard at
/org/[tenantSlug]/dashboard.

Requirements:
- Every request to /org/[tenantSlug]/* must resolve the authenticated user's session and
  verify that the session's associated tenantId matches the tenant identified by
  [tenantSlug] in the URL.
- If the authenticated user's tenantId does not match the tenant resolved from the URL slug,
  return a 403 — do not silently redirect, do not leak whether the slug exists.
- Do NOT trust [tenantSlug] as an authorization boundary on its own. It is a display/routing
  convenience, not a security check. All tenant-scoped tRPC procedures must independently
  verify tenantId server-side from the session, never from a client-supplied slug or param.
- Implement this as a tRPC middleware (protectedTenantProcedure) that every tenant-scoped
  procedure uses, so there is exactly one place this check lives — not re-implemented per
  route.
- Write a test that attempts to access /org/tenant-a/dashboard while authenticated as a
  user belonging to tenant-b, and confirms it is rejected.

This is a required fix, not optional hardening — a previous version of this dashboard had
no tenant-ownership check on the slug, meaning any authenticated tenant could view any
other tenant's calls and bookings by editing the URL.
```

---

## PROMPT 3 — Secure Webhook Endpoint (Retell)

```
Write a Next.js App Router API route at /api/webhooks/retell that:

1. Verifies the incoming webhook signature using Retell's SDK before processing anything.
   Reject unverified requests with 401 immediately.
2. Handles three event types: 'call_started', 'call_ended', 'call_analyzed'.
3. On 'call_started': upsert a row into `calls` with status 'ringing' or 'in-progress'.
4. On 'call_analyzed': extract sentiment and any custom_analysis_data fields, update the
   `calls` row, and check custom_analysis_data for a booking-intent flag.
5. Idempotency: before inserting or updating, check whether this call_id + event type has
   already been processed (use a Redis key with a short TTL, e.g. `webhook:{callId}:{event}`,
   SET with NX so a duplicate Retell webhook retry is a no-op instead of a duplicate write
   or duplicate email trigger).
6. Cache the live call status in Redis (key: `call:{tenantId}:{callId}`) so the dashboard
   can show real-time in-progress calls without hitting Postgres on every poll.
7. On any DB write failure, log the raw payload to a dead-letter table or Redis list
   (`webhook:deadletter`) rather than silently dropping it — we need a way to replay failed
   webhook processing later.

Do not process any payload before signature verification succeeds.
```

---

## PROMPT 4 — Audio Permanent Storage (Cloudflare R2)

```
Build a utility that runs when the 'call_ended' webhook fires:
1. Fetch the raw audio from Retell's recording URL (this URL is ephemeral and expires).
2. Upload it to Cloudflare R2 for permanent storage, using R2's S3-compatible API
   (aws-sdk or a lighter S3-compatible client pointed at the R2 endpoint — do not use
   Cloudinary; R2 has no egress fees, which matters directly for a product whose core
   function is replaying stored audio on every dashboard playback).
3. Save the object key (not a permanently public URL) to calls.recordingUrl — actual
   playback access is via signed URLs generated on demand, not a stored public link. See
   Prompt 8, item 5: recordings must never be served from a permanently public URL.
4. If the upload fails, retry up to 3 times with exponential backoff before giving up and
   logging the failure — do not leave calls.recordingUrl null silently with no record of
   why.
```

---

## PROMPT 5 — Booking Detection + Resend Email Pipeline

```
Inside the 'call_analyzed' webhook handler, add booking detection:

1. Check custom_analysis_data for the tenant's configured booking-intent field (this is
   configurable per tenant per tenants.intakeSchema — do not hardcode a single field name
   like "is_order_booked", since different business types will name this differently).
2. If a booking is detected, write a row to `bookings` using intakeData (jsonb) to store
   whatever fields that tenant's intake schema defines.
3. If bookings.customerEmail is present, dispatch a transactional HTML email via Resend to
   both the customer and the tenant's ownerEmail. If customerEmail is null (voice-captured
   data with no email given), skip the customer email but still notify the tenant, and set
   emailSentStatus to reflect only what was actually attempted.
4. On Resend API failure, set emailSentStatus to 'failed' (not silently leave it 'pending'
   forever) and enqueue a retry job.
5. Build a lightweight retry worker (can be a scheduled route or a queue consumer) that
   finds bookings where emailSentStatus = 'failed' and retries up to 3 times before giving
   up permanently.
```

---

## PROMPT 6 — Polar Subscription + Billing Module

```
Build a billing module integrating Polar (polar.sh) as the subscription billing provider.
Polar is a Merchant of Record — it owns subscription lifecycle, checkout, invoicing, and
usage-based overage billing natively via its API and webhooks. Do not hand-roll subscription
state machines or invoice-generation logic that duplicates what Polar already does; this
app's job is to (a) ingest usage events, (b) sync Polar's subscription state into our own
tables, and (c) gate dashboard access based on that synced state.

1. Create three Polar Products in the dashboard: Pilot ($800/mo), Standard ($1,500/mo),
   Pro ($2,200/mo). Do this once manually, not per tenant — tenants subscribe to an existing
   product.
2. For each product, create a Meter that aggregates a "call_minutes" event by summing a
   "minutes" metadata field per customer. Attach a metered price to each product using this
   meter, set at the overage rate ($0.27/min). Attach a Credits benefit to each product
   granting the plan's included minutes (2,940 / 5,514 / 8,088 respectively) — Credits are
   issued automatically at the start of every billing cycle and are deducted from the
   customer's meter balance first as usage events arrive. Only once the credit balance hits
   zero does the metered price start billing the overage rate — this is native Polar
   behavior, not something our app needs to gate or delay manually.
3. Checkout is admin-triggered, not self-serve (per Prompt 2.5) — when the admin clicks
   "Send Payment Link," generate a Polar Checkout Session for the tenant's selectedTier,
   passing the tenant's polarCustomerReference as the session's client reference/metadata
   so the resulting webhook can be matched back to the correct tenant row. Use
   `createCustomerOnSignUp`-equivalent behavior at this point (or create the Polar customer
   explicitly in this step) so a Polar customer_id exists once payment completes — store it
   on the tenants or subscriptions table, since every usage event ingestion call requires it.
4. Event ingestion: every time the webhook in Prompt 3 processes a 'call_ended' or
   'call_analyzed' event with a final call duration, ingest a Polar usage event via the
   Events Ingestion API — event name "call_minutes", customer_id = the tenant's Polar
   customer ID, metadata = { minutes: <call duration in minutes> }. Do this in the same
   webhook handler that increments subscriptions.minutesUsedThisCycle in our own DB — the
   two should stay in sync, since our local counter drives the dashboard's usage bar and
   the 3-day-grace-period logic, while Polar's meter drives what actually gets billed.
   Note: this only applies once tenants.status = 'active' — a tenant in 'pending_payment'
   cannot have calls routed to them yet anyway, since their Retell agent setup happens as
   part of onboarding alongside payment confirmation.
5. Build a webhook receiver at /api/webhooks/polar that verifies Polar's webhook signature
   (confirm signing method — HMAC with a shared secret — against Polar's current webhook
   docs) before processing anything.
6. Handle these Polar webhook events (confirm exact event names against Polar's current
   docs, since Polar's API has changed naming/structure before):
   - subscription active / order paid, FIRST occurrence for a tenant → this is the tenant
     activation path detailed in Prompt 2.5: look up the tenant by polarCustomerReference,
     set tenants.status = 'active', create the subscriptions row, create the users row,
     send the set-password email. Do this activation logic in Prompt 2.5's handler, not
     duplicated here — this webhook receiver should call out to that same activation logic
     rather than reimplementing it.
   - subscription active / order paid, SUBSEQUENT occurrences (renewals) → reset
     minutesUsedThisCycle to 0, advance currentPeriodStart/currentPeriodEnd, create an
     invoices row (status 'paid', polarOrderId from payload, including whatever overage
     line item Polar attached from the meter). Do NOT recreate the user or resend the
     set-password email on renewal payments — check tenants.status first; only act on the
     activation path if it's still 'pending_payment'.
   - subscription past_due / payment failed → set subscriptions.status = 'payment_overdue',
     subscriptions.overdueSince = now(), create an invoices row with status 'failed'.
   - subscription canceled → set subscriptions.status = 'cancelled'.
7. Do NOT build custom overage-charge logic that manually calculates overageChargeUsd and
   pushes a separate one-time charge to Polar — this was the original plan before
   confirming Polar's actual mechanism. Polar's metered price + meter combination handles
   this automatically: it reads the meter at the end of each cycle and writes the overage
   line item onto the next invoice by itself. Our job is only to (a) ingest accurate usage
   events per call and (b) read the resulting invoice back via webhook to log it in our
   own `invoices` table for the client-facing dashboard's billing history view.
8. Polar explicitly does not enforce usage caps or block API access when a meter crosses
   its threshold — that responsibility stays entirely in our own application. Build a
   scheduled job (cron route, runs daily) that checks all subscriptions with
   status = 'payment_overdue' and overdueSince older than 3 days, and sets status to
   'suspended'.
9. Middleware: any tenant-scoped tRPC procedure must check subscriptions.status server-side
   — if 'suspended', block dashboard data access and return a specific error the frontend
   can render as "access revoked, contact support," not a generic 403. If 'payment_overdue'
   but within the 3-day window, allow access but flag the response so the frontend renders
   a warning banner.
10. Minute tracking in our own DB: every completed call should increment the tenant's
    subscriptions.minutesUsedThisCycle by callDurationSeconds / 60, atomically (Postgres
    transaction or Redis INCR), independent of and in addition to the Polar event ingestion
    in step 4 — the local counter is what the dashboard progress bar and grace-period logic
    read; Polar's meter is what actually generates the invoice line item.
11. Payouts are manual by design (confirmed: Polar does not auto-sweep balances) — do not
    build an automated payout-triggering job.

Do not assume Polar's exact webhook event names or payload field structure — confirm these
against Polar's current API/webhook docs before writing the handler. The billing mechanism
itself (Meters + Credits + Metered Prices for included-then-overage billing) is confirmed
and requires no custom gating logic in our own app; ingest usage events accurately and let
Polar's native credit-deduction and overage-billing handle the rest.
```

---

## PROMPT 7 — Read-Only Tenant Dashboard

```
Build the tenant dashboard at /org/[tenantSlug]/dashboard/page.tsx, gated by the
protectedTenantProcedure middleware from Prompt 2.

Sections:
1. Performance cards: total inbound calls, outbound follow-ups, bookings secured — this
   billing period.
2. Billing status card: current tier, minutes used / minute cap (progress bar), overage
   minutes if any, subscription status. If status is 'payment_overdue', render a banner:
   "Payment failed — please resolve within 3 days or dashboard access will be suspended.
   [Retry Payment] [Report an Issue]". If 'suspended', render a full-page block instead of
   the dashboard content.
3. Call log: searchable/filterable table — date, direction, duration, sentiment, status —
   with a link to open recording + transcript.
4. Transcript + audio player: timestamp-synced transcript alongside an HTML5 audio player
   using the permanent recordingUrl.
5. Booking panel: table of bookings with intakeData rendered dynamically based on the
   tenant's intakeSchema (do not hardcode "customer name / order details" columns — read
   the field definitions from tenants.intakeSchema so this renders correctly whether the
   tenant is a CPA firm or a restaurant).

All data fetched via tRPC procedures scoped server-side to the authenticated tenant. No
client-side trust of tenantSlug for data filtering — the slug is used for routing/display
only, per Prompt 2.
```

---

## PROMPT 8 — Security & Compliance Additions

```
Apply the following to the schema and prompts already built. These are the code-level
requirements from the project's security & compliance doc (04-security-compliance.md) —
read that file for full context before implementing. Note explicitly: some items in that
doc (legal review, client contract terms, the business decision of whether to offer
outbound calling at all) are NOT code tasks — do not attempt to implement those. Only the
items below are in scope for this prompt.

1. Add an `outboundCallingEnabled` (boolean, not null, default false) field to the tenants
   table. Outbound calling must be explicitly enabled per tenant — it is not a default-on
   feature. Any code path that triggers an outbound call (Phase D follow-up logic,
   wherever it lives) must check this flag first and no-op if false.

2. Add a `consentBasis` (text, nullable) field to the tenants table, captured during
   onboarding in the admin panel (Prompt 2.5's tenant creation form) — a free-text field
   where the admin records how this tenant states they obtain calling consent from their
   customers (e.g. "opt-in via booking form," "existing customer relationship"). This does
   not make the platform legally compliant on its own — it creates a documented record that
   the question was asked at onboarding.

3. Add a `donotcall_check` step to any outbound call trigger: before placing an outbound
   call, check the number against the National DNC Registry (requires researching the
   correct API/data source for DNC scrubbing — this was not resolved during planning, flag
   it for manual research before this step can be implemented for real) and against a
   per-tenant suppression list (add a `suppressedNumbers` table: tenantId, phoneNumber,
   addedAt — numbers a tenant's customers have asked not to be called, or that the tenant
   uploads directly). If either check fails, do not place the call, and log the skip with
   a reason.

4. Add a `consentBasis` field (text, nullable) to the `bookings` or `calls` table — not the
   tenant-level field from item 2, but a per-call/per-booking field logging why this
   specific outbound call was placed (e.g. "informational follow-up on existing booking,"
   "customer requested callback"). This is the granular record that matters if any specific
   call is ever disputed.

5. Recording storage access control (extends Prompt 4): do not store or serve
   calls.recordingUrl as a permanently public R2 URL. Use signed URLs (R2 supports
   presigned URLs via its S3-compatible API) with a reasonable expiration (e.g.
   re-generated on each dashboard page load, valid for a short window) so recordings are
   not accessible to anyone with the link indefinitely. The dashboard's audio player
   (Prompt 7) should request a fresh signed URL server-side each time the tenant loads the
   call log, not store the permanent unsigned URL client-side.

6. API key handling audit: confirm no Retell, Polar, Resend, or Cloudflare R2 key is ever
   referenced with a NEXT_PUBLIC_ prefix or otherwise bundled into client-side JavaScript.
   All third-party API calls must happen server-side (API routes, server actions, or tRPC
   procedures) — the browser should never hold a credential for any of these services.

7. Do not implement: legal consultation, client contract drafting, or any business-logic
   decision about which clients are permitted to use outbound calling. These are flagged in
   04-security-compliance.md Section 3 as human/legal action items, not code. If asked to
   "make this TCPA compliant," the correct response is that no code change can guarantee
   legal compliance — the items above reduce risk and create audit trail, they do not
   constitute a compliance guarantee.
```
