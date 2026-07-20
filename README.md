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

> Deployed before adding the env vars? The build fails at "Collecting page
> data" with a `DATABASE_URL environment variable is not set` error. That's
> expected — add the vars, then hit **Redeploy**. Nothing is broken.

### Step 5 — Point the webhooks at your deployment

A webhook is just a URL where another service sends your app news — Retell
tells it "a call happened", Polar tells it "a payment happened". You paste
one URL into each dashboard. Use your real deployed domain everywhere below
(the same value as `APP_URL`).

**a. Retell — one URL, nothing else**

1. Retell dashboard → **Settings → Webhooks**.
2. Paste:
   ```
   https://yourdomain.com/api/webhooks/retell
   ```
3. Save. Done — there's no secret to copy. Retell signs its messages with
   your API key, which the app already has as `RETELL_API_KEY`.

**b. Polar — one URL plus one secret**

1. Polar dashboard → **Settings → Webhooks → Add endpoint**.
2. Paste:
   ```
   https://yourdomain.com/api/webhooks/polar
   ```
3. Payload format: **Raw**.
4. Events: tick `order.paid`, `subscription.active`,
   `subscription.past_due`, `subscription.canceled`,
   `subscription.revoked`. (Can't find the list, or unsure? Sending *all*
   events is also fine — the app safely ignores ones it doesn't use.)
5. After saving, Polar shows a **signing secret**. Copy it → Vercel →
   Environment Variables → `POLAR_WEBHOOK_SECRET` → **Redeploy**. Without
   it, the app rejects everything Polar sends.

**c. QStash — a command, not a dashboard**

The scheduled jobs (email retries, billing suspension) aren't configured in
any web UI. With your `.env` containing the deployed `APP_URL`, run:

```bash
npm run qstash:setup
```

When you see two "Scheduled …" lines, it worked — you can confirm under
Upstash → QStash → Schedules. Re-running is safe; it updates rather than
duplicates.

### Step 6 — Set up billing in Polar (one-time, ~15 minutes)

**What you're building**: three subscription plans. Each plan includes a
bundle of free minutes; minutes beyond that cost $0.27 each. Polar does all
the counting and charging by itself — the app just reports each call's
minutes. Three Polar concepts make that work:

| Polar term | Plain meaning |
|---|---|
| **Meter** | A per-customer counter. The app reports "this call used 3 minutes"; Polar adds it up. |
| **Meter credits** (a benefit) | The plan's free minutes, refilled at the start of every billing month. |
| **Metered price** | The $0.27/minute charge that only starts once the free minutes are used up. |

**6.1 — Create the meter** (once, before the products)

1. Polar dashboard → **Products → Meters → Create Meter**.
2. Name it exactly `call_minutes` — the app sends usage under this name.
3. Filter: event name **equals** `call_minutes`.
4. Aggregation: **Sum**, over the property **`minutes`**.
5. Save.

**6.2 — Create the Pilot product** (walkthrough; then repeat twice)

1. **Products → Create Product**. Name: `Pilot`. Billing: **Monthly
   subscription**, price **$800**.
2. On the same product, add a **second, metered price**: pick the
   `call_minutes` meter, set **$0.27 per unit**.
3. In the product's **Benefits** section: **Add benefit → Meter Credits** →
   meter `call_minutes` → **2,940 units**, granted **every billing cycle**.
4. Save, open the product, copy its **product ID**. That's
   `POLAR_PRODUCT_ID_PILOT`.

**6.3 — Repeat for Standard and Pro** — everything identical except:

| Product | Monthly price | Free minutes (credits) | ID goes into |
|---|---|---|---|
| Pilot | $800 | 2,940 | `POLAR_PRODUCT_ID_PILOT` |
| Standard | $1,500 | 5,514 | `POLAR_PRODUCT_ID_STANDARD` |
| Pro | $2,200 | 8,088 | `POLAR_PRODUCT_ID_PRO` |

**6.4 —** Put the three IDs into Vercel env vars → **Redeploy**.

**6.5 — Create a free test coupon**: **Products → Discounts → Create** →
**100% off**, code `GOLIVE-TEST`, limit redemptions. Step 8 uses it so your
test checkout charges $0.

*(Polar occasionally renames buttons — if a label differs, look for the
concept: one meter, three products, each with a fixed price + a metered
price + a credits benefit.)*

### Step 7 — Connect a client's AI agent (Retell)

**How the pieces fit**: every client gets **one agent** in Retell. Two
things link that agent to the client's dashboard:

1. The **agent ID** pasted into `/admin` — this is how the app knows *whose*
   call each webhook belongs to.
2. The agent's **post-call analysis fields** — after each call, the agent
   fills in a little answer sheet ("did they book?", "party size?"). The
   app reads those answers to create bookings, so **the field names in
   Retell must exactly match the names in that tenant's intake schema**
   (the JSON you pasted in the admin create form).

Step by step, per client:

**7.1** Create the tenant in `/admin` (name, owner email, type, tier,
intake schema).

**7.2** In Retell: create the agent, write its prompt, pick a voice, attach
their phone number — your normal managed-service work.

**7.3** In the agent's settings, open **Post-Call Analysis** and add one
field per answer you want captured. For the default restaurant-style intake
schema, that's:

| Field name in Retell | Type | What the AI fills in |
|---|---|---|
| `is_booking_confirmed` | Boolean | Did the caller actually book? |
| `party_size` | Number | How many people |
| `order_items` | Text | What they ordered |
| `preferred_time` | Text | When they want it |
| `customer_name` | Text | Caller's name |
| `customer_email` | Text | Caller's email, if they gave one |
| `customer_phone` | Text | Caller's number |

The first four names come from **your intake schema** — `bookingIntentField`
plus each `fields[].key`, spelled identically. The last three
(`customer_*`) are standard: always add them, for every client.

**7.4** On the agent's page, copy its ID (looks like `agent_…`) → `/admin`
→ that tenant's row → paste into the **Retell agent** box → Save.

Until 7.4 is done, that client's calls don't reach their dashboard — they
sit in a recovery queue (`webhook:deadletter`), not lost, but invisible.

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
