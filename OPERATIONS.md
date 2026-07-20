# Digivixo — Operations & Go-Live Guide

Everything you (the operator) do outside the codebase to take the platform
live and run it. Follow top to bottom the first time; sections 7–9 are the
ones you'll come back to. Written against the state of the code at Prompt 8
completion — every env key here is one the code actually reads.

> Your Polar org is **production** (no sandbox). Nothing in this guide sends
> real money except where explicitly marked 💳 — and the end-to-end payment
> test uses a 100%-off discount code so the card is never charged.

---

## 1. Deploy the app first (Vercel)

The webhook URLs and QStash schedules all need your public domain, so deploy
before configuring any third party.

1. Push/merge everything to `main`, import the GitHub repo into Vercel.
2. Framework preset: Next.js. No special build settings needed.
3. Add **every** environment variable from section 2 in Vercel → Project →
   Settings → Environment Variables (Production). The build succeeds without
   them, but nothing works at runtime until they're set.
4. Point your production domain's DNS at Vercel; set `APP_URL` to that domain
   (`https://yourdomain.com`, no trailing slash).
5. Redeploy after all env vars are in.

## 2. Environment variables — the complete list

Same list as `.env.example`; here's where each value comes from.

| Key | Where to get it |
|---|---|
| `DATABASE_URL` | Neon → your project → Connection string — use the **pooled** one (`-pooler` in the host). |
| `AUTH_SECRET` | Generate: `openssl rand -base64 32` (or any 32+ random bytes). |
| `APP_URL` | Your deployed origin, e.g. `https://yourdomain.com`. |
| `REDIS_URL` | Upstash → your Redis database → the `rediss://…` TCP connection string. **Currently missing from your local .env** — webhook idempotency, live-call indicator, and dead-letter lists silently no-op without it. |
| `RETELL_API_KEY` | Retell dashboard → API Keys. Also verifies webhook signatures (Retell has no separate signing key). |
| `RESEND_API_KEY` | Resend → API Keys. Domain must be verified (SPF/DKIM/DMARC) first or mail lands in spam. |
| `EMAIL_FROM` | e.g. `Digivixo <notifications@yourdomain.com>` — must be on the verified domain. |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` | Cloudflare → R2. Create the bucket, then an API token **scoped to that one bucket**. Bucket must NOT have public access — playback uses 5-minute presigned URLs only. |
| `QSTASH_TOKEN` / `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | Upstash console → QStash tab. Token is only used by `npm run qstash:setup`. |
| `POLAR_ACCESS_TOKEN` | Polar → Settings → Developers → New token (organization token). |
| `POLAR_WEBHOOK_SECRET` | Created in section 4 when you add the webhook endpoint. |
| `POLAR_ENVIRONMENT` | `production` (your setup). |
| `POLAR_PRODUCT_ID_PILOT` / `_STANDARD` / `_PRO` | Copied from the three products you create in section 4. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Your choice — read only by `npm run seed:admin`; safe to blank the password afterward. |

## 3. One-time bootstrap commands

Run locally with the production values in `.env`:

```
npm run db:migrate     # apply any unapplied migrations to Neon (0000–0004 are already applied)
npm run seed:admin     # creates your admin login from ADMIN_EMAIL / ADMIN_PASSWORD
npm run qstash:setup   # registers the two schedules (needs APP_URL = deployed domain)
```

`qstash:setup` registers: `email-retry` every 15 min and `billing-suspend`
daily at 03:00 UTC. Idempotent — rerun any time (e.g. if APP_URL changes).

## 4. Polar dashboard setup (production org)

Do these once, in order, in the Polar dashboard:

**a. Merchant readiness** — finish identity verification and connect the
payout account (Stripe Connect Express with your bank details). Underwriting
can take ~2 weeks; start early. Payouts are **manual** — set a recurring
personal reminder to trigger them; Polar never auto-sweeps your balance.

**b. Meter** — Products → Meters → Create:
- Name: `call_minutes` (must match exactly — the code sends events with this name)
call_minutes- Aggregation: **Sum** over metadata property `minutes`
- Filter: event name equals `call_minutes`

**c. Three products** — Products → New (recurring, monthly):

| Product | Price | Included minutes (credits) |
|---|---|---|
| Pilot | $1,000/mo | 3,000 |
| Standard | $1,700/mo | 5,600 |
| Pro | $2,500/mo | 8,150 |

> These supersede the older tiers still written in `/docs` (the original
> spec, deliberately left unedited). `src/lib/pricing.ts` is the live source
> of truth and matches the table above.

For **each** product:
1. Fixed recurring price: the monthly amount above.
2. Add a **metered price** using the `call_minutes` meter at **$0.27 per unit**
   — this is what bills overage automatically; the app never calculates it.
3. Attach a **Meter Credits benefit** granting that tier's included minutes on
   the `call_minutes` meter, re-issued every billing cycle. Credits absorb
   usage first; the metered price only bills after they're exhausted.
4. Copy the product ID into the matching `POLAR_PRODUCT_ID_*` env var.

**d. Webhook** — Settings → Webhooks → Add endpoint:
- URL: `https://yourdomain.com/api/webhooks/polar`
- Format: Raw
- Events: `order.paid`, `subscription.active`, `subscription.past_due`,
  `subscription.canceled`, `subscription.revoked` (extra events are safely
  acknowledged and ignored)
- Copy the signing secret into `POLAR_WEBHOOK_SECRET`.

**e. Test discount** — Products → Discounts → create `GOLIVE-TEST`,
100% off, restricted to as few redemptions as possible. Used in section 8's
payment test so no real charge occurs; archive it afterward.

## 5. Retell setup

1. Point the webhook to `https://yourdomain.com/api/webhooks/retell`
   (account-level webhook settings).
2. Per tenant (managed-service work, per client):
   - Register their phone number, map it to their agent.
   - Configure the agent's prompt/voice/LLM.
   - In **post-call analysis**, define fields whose names match that tenant's
     `intakeSchema` in the admin panel:
     - the boolean **booking-intent field** (whatever name you chose, e.g.
       `is_booking_confirmed`)
     - one field per intake `fields[].key` (e.g. `party_size`, `order_items`)
     - `customer_name`, `customer_email`, `customer_phone` (or set
       `customerFieldMap` in the intake schema if you name them differently)
   - Copy the **agent ID** into the tenant's row in `/admin` — until it's
     set, that tenant's webhooks land in the dead-letter list, not the
     dashboard.

## 6. The intakeSchema contract (what you paste in the admin create form)

```json
{
  "bookingIntentField": "is_booking_confirmed",
  "fields": [
    { "key": "party_size",     "label": "Party size",     "type": "number" },
    { "key": "order_items",    "label": "Order items",    "type": "text"   },
    { "key": "preferred_time", "label": "Preferred time", "type": "text"   }
  ],
  "customerFieldMap": {
    "name": "customer_name",
    "email": "customer_email",
    "phone": "customer_phone"
  }
}
```

- `bookingIntentField` — which analysis field flags a booking. Truthy values
  recognized: `true`, `"true"`, `"yes"`, `"1"`, `1`, `"confirmed"`.
- `fields` — become the booking-panel columns on the tenant dashboard and the
  data stored per booking.
- `customerFieldMap` — optional; omit it if your agents use the conventional
  `customer_*` names.

## 7. Per-client onboarding runbook

1. `/admin` → Create tenant (name, owner email, business type, tier, intake
   schema; consent basis if discussing outbound). Status: `pending_payment` —
   no login exists.
2. Click **Send payment link** — generates the Polar checkout for their tier
   and emails it via Resend. 💳 real checkout.
3. Client pays → the Polar webhook automatically: activates the tenant,
   creates the subscription record, creates their user, and emails the
   set-password link (48 h, single use). You do nothing.
4. Configure their Retell agent (section 5) and paste the agent ID into their
   tenant row.
5. Place one test call end-to-end: call connects → dashboard shows it live →
   transcript + recording appear → booking email sends. Then hand over.

**Outbound calling**: stays OFF per tenant until you enable it on
`/admin/tenants/<id>` — which requires a recorded consent basis, and even
then the guard **fails closed** because the National DNC Registry check is
not yet implemented (flagged for research in docs/01 Prompt 8). Do not
promise outbound to clients until a DNC data source is wired into
`src/lib/outbound-guard.ts`.

## 8. Go-live verification (run once after sections 1–5)

- [ ] `https://yourdomain.com/login` renders; admin login works at `/admin/login`.
- [ ] Create a throwaway tenant (`GOLIVE TEST`), send yourself the payment
      link, pay with the `GOLIVE-TEST` 100% discount code.
- [ ] Tenant flips to `active` in `/admin` within a minute (webhook worked).
- [ ] You receive the set-password email; set a password; the dashboard loads.
- [ ] Make a test call to a Retell agent mapped to that tenant: live-call
      pulse appears; after hang-up the call row, transcript, recording
      playback, and (if booking-intent fired) the booking + emails all land.
- [ ] Polar → Customers → the test customer shows ingested `call_minutes`
      events matching the call's rounded-up minutes.
- [ ] Cancel the test subscription in Polar, delete the test tenant row, and
      archive the discount code.

## 9. Ongoing operations

- **Payouts**: manual, in Polar — recurring reminder (weekly/monthly).
- **Dead-letter lists** (Redis, inspect with `LRANGE <key> 0 -1`):
  `webhook:deadletter` (unprocessable/unmatched Retell events),
  `recording:deadletter` (audio archival failures),
  `usage:deadletter` (Polar ingestion failures — these are unbilled minutes;
  replay them), `outbound:skips` (blocked outbound attempts).
- **Email retries**: automatic (QStash, every 15 min, max 3 retries). A
  booking stuck on "Email failed" after that needs manual attention.
- **Grace window**: overdue subscriptions are blocked after 3 days —
  immediately by the middleware, and flipped to `suspended` by the daily job.
  Recovery is automatic when Polar reports payment success.
- **Support email**: update `SUPPORT_EMAIL` in `src/lib/support.ts` to your
  real inbox (it's on the payment-failed banner).
- **Key hygiene**: rotate any credential you suspect exposed; all of them
  live only in env vars, never in code or the client bundle.
