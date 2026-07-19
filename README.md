# Digivixo — Managed Voice AI Platform

Multi-tenant platform behind a managed voice-AI agency: Retell answers each
client's phone line, calls and bookings land on a read-only client dashboard,
Polar bills the subscription (included minutes + automatic overage), and an
internal `/admin` panel runs onboarding.

**Stack**: Next.js (App Router) + tRPC · Drizzle ORM + Neon Postgres ·
Upstash Redis + QStash · Retell · Resend · Cloudflare R2 · Polar · NextAuth.

**Docs in this repo**: this README is the step-by-step setup path.
[OPERATIONS.md](OPERATIONS.md) covers day-2 operations (per-client
onboarding runbook, dead-letter lists, payouts). `/docs` holds the original
build spec — treat it as read-only.

---

## Setup, step by step

Do these in order. Steps 1–3 are local; step 4 deploys; steps 5–7 configure
the third parties against your live domain; step 8 proves the whole loop.

### Step 1 — Create the accounts

You need: [Neon](https://neon.tech) (Postgres), [Upstash](https://upstash.com)
(Redis **and** QStash), [Retell](https://retellai.com),
[Resend](https://resend.com), [Cloudflare](https://cloudflare.com) (R2),
[Polar](https://polar.sh) (production org), [Vercel](https://vercel.com).

Start Polar's merchant verification + payout account (Stripe Connect
Express) **now** — underwriting can take ~2 weeks and nothing else blocks on
it.

### Step 2 — Fill in `.env`

Copy `.env.example` to `.env` and fill every ACTIVE key:

| Key | Exactly where to find it |
|---|---|
| `DATABASE_URL` | Neon console → your project → **Connect** → copy the **pooled** connection string (host contains `-pooler`). |
| `AUTH_SECRET` | Run `openssl rand -base64 32` in any terminal (Git Bash works) and paste the output. |
| `APP_URL` | Your production domain, `https://yourdomain.com` — no trailing slash. (Use `http://localhost:3000` only while testing locally.) |
| `REDIS_URL` | Upstash console → Redis → your database → **Connect** → the `rediss://default:…` TCP string (not the REST URL). |
| `RETELL_API_KEY` | Retell dashboard → **API Keys** → create/copy. This same key verifies webhook signatures — Retell has no separate signing key. |
| `RESEND_API_KEY` | Resend → **API Keys**. First add your domain under **Domains** and complete SPF/DKIM/DMARC DNS records — unverified domains land in spam. |
| `EMAIL_FROM` | `Digivixo <notifications@yourdomain.com>` — an address on that verified domain. |
| `R2_ACCOUNT_ID` | Cloudflare dashboard → R2 → right sidebar shows the Account ID. |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 → **Manage R2 API Tokens** → Create token → scope it to the one bucket, Object Read & Write. |
| `R2_BUCKET_NAME` | R2 → **Create bucket** (any name, e.g. `digivixo-recordings`). Leave public access OFF — playback uses 5-minute signed URLs. |
| `QSTASH_TOKEN` | Upstash console → **QStash** tab → Token. |
| `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | Same QStash page, "Signing keys" section. |
| `POLAR_ACCESS_TOKEN` | Polar → **Settings → Developers** → New token (organization scope). |
| `POLAR_WEBHOOK_SECRET` | Created in **Step 6b** below — come back and fill it. |
| `POLAR_ENVIRONMENT` | `production` (your org has no sandbox). |
| `POLAR_PRODUCT_ID_PILOT` / `_STANDARD` / `_PRO` | Created in **Step 6a** below — come back and fill them. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Your own admin login (password ≥ 12 chars). Only the seed script reads these. |

### Step 3 — Bootstrap the database and your admin login

```bash
npm install
npm run db:migrate    # applies migrations to Neon (safe to re-run)
npm run seed:admin    # creates your admin user from ADMIN_EMAIL / ADMIN_PASSWORD
npm run test          # 55 tests should pass
```

### Step 4 — Deploy to Vercel

1. Push the repo to GitHub (already done) → Vercel → **Add New Project** →
   import `AI-Calling`. Framework preset: Next.js, defaults are fine.
2. Project → **Settings → Environment Variables** → add **every** key from
   Step 2 (Production environment). Two of them (`POLAR_WEBHOOK_SECRET`,
   `POLAR_PRODUCT_ID_*`) don't exist yet — add them in Step 6 and redeploy.
3. **Settings → Domains** → add your domain, point DNS as instructed.
4. Set `APP_URL` (in Vercel env vars) to that domain, exactly
   `https://yourdomain.com`.
5. Deploy. Check `https://yourdomain.com/login` renders and
   `https://yourdomain.com/admin/login` accepts your seeded admin.

### Step 5 — Point the webhooks at your deployment

Both webhooks reject unsigned requests, so nothing works until the URLs AND
secrets/keys line up.

**a. Retell** — Retell dashboard → **Webhooks** (account-level settings):

```
https://yourdomain.com/api/webhooks/retell
```

That's it — deliveries are signed with your `RETELL_API_KEY` automatically.
(You can also set the webhook per-agent; same URL either way.)

**b. Polar** — Polar dashboard → **Settings → Webhooks → Add endpoint**:

```
https://yourdomain.com/api/webhooks/polar
```

- Format: **Raw**
- Events to enable: `order.paid`, `subscription.active`,
  `subscription.past_due`, `subscription.canceled`, `subscription.revoked`
  (anything extra is acknowledged and ignored)
- Copy the **signing secret** it shows you → paste into
  `POLAR_WEBHOOK_SECRET` in Vercel env vars → **redeploy**.

**c. QStash** (scheduled jobs — not pasted in any dashboard; registered by
script). From your machine, with `.env` now containing the deployed
`APP_URL`:

```bash
npm run qstash:setup
```

Registers two schedules against your domain: booking-email retries every
15 minutes and the daily billing-suspension check. Re-run any time; it
overwrites rather than duplicates.

### Step 6 — Polar products, meter, and credits (one-time)

In the Polar dashboard (full detail in [OPERATIONS.md §4](OPERATIONS.md)):

1. **Meter first**: Products → Meters → create `call_minutes`, aggregation
   **Sum** over metadata property `minutes`, filtered to event name
   `call_minutes`. The name must match exactly — the app sends usage events
   with it.
2. **Three products** (recurring, monthly): Pilot $800, Standard $1,500,
   Pro $2,200. On each: add a **metered price** on the `call_minutes` meter
   at **$0.27/unit**, and a **Meter Credits benefit** granting the included
   minutes per cycle — 2,940 / 5,514 / 8,088 respectively. Credits absorb
   usage first; the metered price bills only the overage. The app never
   calculates overage itself.
3. Copy each product's ID into `POLAR_PRODUCT_ID_PILOT` / `_STANDARD` /
   `_PRO` in Vercel → redeploy.
4. Create a **100%-off discount code** (e.g. `GOLIVE-TEST`, limited
   redemptions) — used in Step 8 so your test checkout charges nothing.

### Step 7 — Retell agent per tenant

For each client (and your Step 8 test tenant):

1. Create the tenant in `/admin` (business name, owner email, type, tier,
   intake schema — the JSON template in the form is documented in
   [OPERATIONS.md §6](OPERATIONS.md)).
2. In Retell: register their number, configure the agent, and in
   **post-call analysis** define fields matching that tenant's intake schema
   — the booking-intent boolean (e.g. `is_booking_confirmed`), each
   `fields[].key`, plus `customer_name` / `customer_email` /
   `customer_phone`.
3. Copy the **agent ID** into the tenant's row in `/admin` ("Retell agent"
   column). Unmapped agents' calls go to the dead-letter list, not the
   dashboard.

### Step 8 — Prove the whole loop (go-live test)

1. `/admin` → create tenant `GOLIVE TEST` → **Send payment link** (to your
   own email).
2. Open the checkout, apply the `GOLIVE-TEST` discount code, "pay" $0.
3. Watch `/admin`: the tenant flips to `active` automatically (that's the
   Polar webhook). You receive the set-password email; set one; the
   dashboard loads at `/org/golive-test/dashboard`.
4. Call the mapped Retell number: the live-call pulse appears on the
   dashboard; after hang-up the call row, transcript, and recording playback
   show up; if you trigger the booking intent, the booking row + emails
   arrive.
5. In Polar → the test customer → confirm `call_minutes` events equal the
   call's rounded-up minutes.
6. Clean up: cancel the test subscription in Polar, archive the discount
   code, delete/label the test tenant.

If every box ticks, you're live. Ongoing operations — client onboarding
runbook, dead-letter queues, manual payouts, the outbound-calling policy —
live in [OPERATIONS.md](OPERATIONS.md).

---

## Development

```bash
npm run dev          # local dev server
npm run test         # vitest suite
npm run typecheck    # tsc --noEmit
npm run db:generate  # create a migration after schema changes
npm run db:migrate   # apply migrations
npm run db:studio    # browse the database
```

Local quirk: `REDIS_URL` must point at a reachable Redis even in dev —
webhook idempotency and the live-call indicator depend on it (the app
degrades gracefully, but those features silently no-op without it).
