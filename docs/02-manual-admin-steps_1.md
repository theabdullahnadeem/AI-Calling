# Manual Admin & Deployment Steps

Claude Code only edits project files. Everything below has to be done by you, outside the codebase, before or alongside each build prompt.

---

## 1. Retell Setup

- [ ] **Get white-label confirmation in writing.** You've told me you confirmed this on Retell's site — before onboarding your first paying client on this architecture, get this in an email or signed doc from Retell directly (not just a pricing page), and save it somewhere retrievable. If a client ever asks "is this actually your own platform," you want a paper trail, not a memory of a webpage.
- [ ] Register each tenant's phone number in the Retell dashboard.
- [ ] Map each phone number to the correct Retell Agent ID for that tenant.
- [ ] Configure the Retell agent's system prompt, LLM choice, and voice per tenant — this is the "managed service" work you do manually per client, not something Claude Code builds.
- [ ] Point Retell's webhook settings to: `https://yourdomain.com/api/webhooks/retell`
- [ ] Confirm your actual per-minute Retell cost matches $0.155/min (LLM + voice infra + TTS + telephony) before onboarding a client at the pricing tiers below — if your real contracted rate differs, the minute caps in Prompt 1 need to be recalculated, not reused as-is.

## 2. Neon Postgres

- [ ] Create a Neon project and database.
- [ ] Get the connection string, add to `.env` as `DATABASE_URL`.
- [ ] Confirm connection pooling is enabled (Neon's pooled connection string, not the direct one) — Next.js serverless functions will exhaust direct connections fast under load.

## 3. Redis (Upstash)

- [ ] Create an Upstash Redis instance.
- [ ] Add `REDIS_URL` (and token, if using Upstash's REST client) to `.env`.

## 4. Resend

- [ ] Create a Resend account, verify your sending domain (SPF/DKIM/DMARC) — do not send from an unverified domain, it will land in spam and you've already had a deliverability problem on this exact issue before with cold outreach email.
- [ ] Add `RESEND_API_KEY` to `.env`.

## 5. Cloudflare R2 (permanent audio storage)

- [ ] Create a Cloudflare account and an R2 bucket for permanent call recording storage.
- [ ] Generate R2 API credentials (Access Key ID / Secret, S3-compatible) scoped to that bucket only — do not use account-wide credentials for this.
- [ ] Add R2 credentials and bucket endpoint to `.env`.
- [ ] Confirm the bucket is NOT set to public access — recordings must be served via signed/presigned URLs only, per the security doc.

## 6. Polar (billing/subscriptions)

- [ ] Sign up at polar.sh. Note the underwriting review before payouts are enabled can take about two weeks per third-party integration reports — start this now, don't wait until your first paying client is ready to be billed.
- [ ] Complete merchant verification — add real social profiles (LinkedIn, etc.) since Polar reviews the person behind the account, not just the business.
- [ ] Create the three subscription Products in the Polar dashboard: Pilot ($800/mo), Standard ($1,500/mo), Pro ($2,200/mo). Do this once, manually, before onboarding any tenant — do not have Claude Code create products per signup.
- [ ] Connect a payout account (Stripe Connect Express, per Polar's docs) using your actual Pakistani bank details. Confirm the business type (individual vs. company) supported for Pakistan specifically inside Stripe Connect Express's own verification flow, since this varies by country and Polar's docs point you to check it directly.
- [ ] Get your Polar API access token and webhook signing secret, add both to `.env`.
- [ ] Set the webhook endpoint in your Polar dashboard to point to `https://yourdomain.com/api/webhooks/polar`.
- [ ] Test the full checkout → webhook → subscription-active flow in Polar's sandbox environment before going live with a real client — do not test this for the first time against a paying client's card.
- [ ] Payouts are manual — set a personal reminder (weekly or monthly) to actually log in and trigger a payout from your Polar balance to your connected bank account. Polar does not do this automatically.
- [ ] Before your first paying client: confirm directly in Polar's dashboard/docs how one-time overage charges get added to an active subscription (this wasn't fully confirmed during planning — verify before Prompt 6's overage billing step goes live, not after).

## 7. Domain & Deployment

- [ ] Point your production domain's DNS at your deployment (Vercel or otherwise).
- [ ] Set all `.env` variables in your production deployment's environment settings, not just locally.

## 8. Environment Variables Checklist

```
DATABASE_URL=your_neon_connection_string
REDIS_URL=your_upstash_redis_url
RETELL_API_KEY=your_retell_api_key
RETELL_SIGNING_KEY=your_retell_signing_key
RESEND_API_KEY=your_resend_api_key
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_r2_bucket_name
POLAR_ACCESS_TOKEN=your_polar_api_access_token
POLAR_WEBHOOK_SECRET=your_polar_webhook_signing_secret
POLAR_ENVIRONMENT=sandbox_or_production
```

## 9. Per-Tenant Onboarding Checklist (repeat for every new client)

Confirmed sequence: create tenant (unpaid) → send payment link manually from the admin panel → client pays on Polar's hosted page → payment webhook automatically creates their login and sends the set-password email. No tenant ever has login credentials before they've paid — this is a hard rule the system enforces, not a best-effort guideline.

- [ ] Confirm tenant's business type and define their `intakeSchema` (what fields the booking/intake form needs).
- [ ] In the `/admin` panel, create the tenant: business name, owner email, business type, selected tier. This creates a `pending_payment` record — no login exists yet.
- [ ] Click "Send Payment Link" in the admin panel for that tenant. This generates and emails a Polar checkout link for their chosen tier.
- [ ] Wait for payment confirmation — check the admin tenant list for status flipping to `active` (this happens automatically via webhook; you don't need to do anything, but don't tell the client their dashboard is ready until you see this).
- [ ] Once active, the client automatically receives a "set your password" email — you don't send this manually.
- [ ] Register their phone number with Retell and configure the agent prompt (inbound/outbound as needed) — do this once payment is confirmed, not before, since there's no point configuring a live agent for someone who hasn't paid.
- [ ] Confirm their first test call end-to-end (call in, dashboard reflects it, booking email sends if applicable) before going live for their real customers.

**Recurring task, not per-client:** log into Polar periodically (set your own cadence — weekly or monthly) and manually trigger a payout to your bank account. Polar never auto-sweeps your balance — this is an ongoing task you have to remember, not a one-time setup step.

## 10. Pricing Reference (for your own use, not in the client-facing doc)

At $0.155/min Retell cost, Polar's 5% + $0.50 transaction fee, 40% net margin floor:

| Tier | Price/mo | Minute cap | Overage rate | Net profit at cap |
|---|---|---|---|---|
| Pilot | $800 | 2,940 min | $0.27/min | ~$304 |
| Standard | $1,500 | 5,514 min | $0.27/min | ~$570 |
| Pro | $2,200 | 8,088 min | $0.27/min | ~$836 |

These caps are lower than a naive "$0.155/min only" calculation because Polar's fee comes out before the 40% margin target is applied. If your confirmed Retell rate or Polar's fee structure ever changes, these caps need to be recalculated — they are not fixed numbers, they're derived from (price − Polar fee) × margin target ÷ Retell cost per minute.
