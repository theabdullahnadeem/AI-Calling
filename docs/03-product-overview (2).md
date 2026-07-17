# Automated Voice AI Platform — Product Overview

## 1. The Problem

Professional services firms and consumer-facing businesses lose revenue every time a call goes unanswered. A missed call during business hours is a missed lead; a missed call after hours is a lead that often never calls back. Hiring dedicated reception staff to cover this is expensive and doesn't scale with call volume spikes.

Traditional IVR ("press 1 for hours") doesn't solve this — it degrades the caller experience and doesn't handle anything beyond static menu options.

## 2. The Solution

A managed AI voice agent that answers every inbound call, handles routine inquiries, captures booking/intake details, and can place outbound follow-up calls to warm leads — all without the business owner touching any technical configuration. We handle the AI setup, prompt tuning, and telephony routing on the backend. The business owner gets a read-only dashboard showing exactly what happened on every call and what it's worth to them.

This is not built for one industry. The intake and booking fields are configured per client at onboarding — a CPA firm's intake (service type, callback urgency) looks different from a restaurant's (party size, order details), but the underlying platform is the same.

## 3. How It Works

**Inbound calls:** The AI agent answers immediately, handles the conversation using that business's configured knowledge base (hours, services, pricing, policies), and captures structured intake data when the caller wants to book, inquire, or place an order.

**Booking capture:** When intake is detected, it's written to the dashboard in real time and triggers a confirmation email (via Resend) to both the customer and the business owner — assuming the caller provided an email; if not, the business owner is still notified so they can follow up.

**Outbound follow-up:** For dropped-off or unresolved inquiries, the same AI agent can place a follow-up call referencing the prior conversation.

**Sentiment tagging:** Every call is tagged (positive / neutral / negative / inquisitive) so the business owner can see satisfaction trends without reading every transcript.

## 4. What the Business Owner Sees

- **Performance cards** — inbound calls, outbound follow-ups, bookings secured this billing period.
- **Call log** — searchable, filterable, with recording playback and synced transcripts.
- **Booking panel** — active bookings/orders with the fields relevant to that specific business.
- **Billing status** — current tier, minutes used against the cap, subscription status.

Everything is read-only by design — the business owner sees results, we manage the underlying AI system.

## 5. Verified Results (Real Client Data)

We have one verified client deployment with permission to reference results anonymously:

- **Missed call rate reduced from 32% to 5%** over a 60-day measurement period.
- **13% revenue increase** attributed directly to calls that would previously have gone unanswered, converting to booked business.

We do not publish projected or industry-average ROI figures (e.g. "up to 35% revenue recovery," "100% call capture") because we don't have the client volume yet to back broader claims, and unverifiable numbers in a sales document are a credibility risk with a buyer who will ask for the methodology. As more verified clients come online, this section gets more data points — not bigger unverified ones.

## 6. Pricing

| Tier | Price | Minutes included | Overage rate |
|---|---|---|---|
| Pilot | $800/mo | 2,940 min | $0.27/min |
| Standard | $1,500/mo | 5,514 min | $0.27/min |
| Pro | $2,200/mo | 8,088 min | $0.27/min |

Billed monthly via recurring subscription. If a payment fails, the account has a 3-day grace window to resolve it or flag a billing issue before dashboard access is paused.

## 7. What This Is Not

- Not a DIY tool — the business owner never touches AI configuration, prompts, or telephony settings.
- Not a generic universal dashboard — intake fields are configured per client's business type at onboarding, not a one-size-fits-all form.
- Not a payments processor for the client's own transactions — this platform handles call/booking capture and agency billing; it does not process the business's customer payments.
