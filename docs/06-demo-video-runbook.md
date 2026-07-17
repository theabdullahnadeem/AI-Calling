# Demo Video Runbook (Restaurant Scenario)

**Use this once the full build (Prompts 1–8) is deployed and reachable.** This is a step-by-step plan so you get a clean recording in as few takes as possible — Retell's $10 signup credit covers roughly 60-90 minutes of test calls, but treat this as a scripted single take, not unlimited free practice.

Why restaurant: it's the most universally legible scenario to a stranger watching a demo — everyone understands "booking a table and ordering food" instantly, with zero domain explanation needed, which is exactly what a 2-3 minute demo has time for. Save the CPA-firm-specific version for pitches to actual CPA firms, where the intake fields should match their vertical instead.

---

## 1. Pre-Recording Setup (do this before you hit record)

- [ ] Create a demo tenant via the `/admin` panel: business name something obviously fictional but restaurant-shaped (e.g. "Saffron Table" or similar) — do not use a real restaurant's name or identity without permission.
- [ ] Set `businessType` to restaurant, and configure `intakeSchema` with restaurant-appropriate fields: party size, order items, pickup or delivery, preferred time.
- [ ] Manually flip this demo tenant's `status` to `'active'` directly in the database (skip the real Polar checkout flow for a demo account — you don't need to pay yourself to test your own product) so the dashboard is fully accessible.
- [ ] Register one phone number in Retell for this demo tenant, and configure the agent prompt to match a restaurant receptionist persona (see script below for what it needs to handle).
- [ ] Confirm the webhook pipeline is live and pointed at your real deployed domain, not localhost — the whole point of this demo is showing the real, working pipeline, not a mocked one.
- [ ] Open the dashboard in a second window/tab, logged in as this demo tenant, ready to screen-record.
- [ ] Do one silent test call first (not recorded) to confirm the full pipeline actually works end-to-end — call connects, webhook fires, dashboard updates, booking appears, email sends — before you record the version you intend to keep. Debugging live on the real recording wastes the good take.

## 2. The Call Script

Keep this to under 3 minutes. Longer doesn't make the demo more convincing — it makes the viewer bored before they see the dashboard, which is the actual point of the video.

**Caller (you, or whoever's placing the demo call) says something like:**

> "Hi, I'd like to book a table for four this Saturday at 7pm, and I'd also like to go ahead and order a couple of things ahead — one order of the grilled salmon and one order of the mushroom risotto. My name's [demo name], and my number's [demo number]."

**What this single call needs to demonstrate, and why each piece is in the script:**
- A **booking-intent trigger** (table reservation) — this is what makes `custom_analysis_data` flag a booking and write to the `bookings` table.
- **Structured intake data** (party size: 4, date: Saturday, time: 7pm, plus two specific order items) — this is what populates the dynamic `intakeData` fields you configured in the demo tenant's `intakeSchema`, proving the dashboard renders vertical-specific fields correctly.
- A **name and phone number**, so the booking panel shows populated `customerName`/`customerPhone` fields, not blank ones — a demo with empty customer fields undercuts the "look what this captures" pitch.
- Keep the AI agent's responses natural but let it confirm the booking back to you verbally before hanging up — this is the moment in the recording where a watching prospect hears the AI actually handling the interaction competently, not just transcribing.

**Do not overcomplicate the script with an edge case (interruptions, a complaint, a menu question) for this first demo.** One clean, successful booking flow is the strongest opening pitch — edge-case handling is a second, more advanced demo video once you have a first client's trust and want to show more sophistication.

## 3. Recording Sequence (what to show, in order)

Screen-record the dashboard, not the phone call audio in isolation — the call happening live and the dashboard updating in near-real-time is the actual demo. If your screen recorder supports picture-in-picture with a phone/audio indicator, use it; if not, a simple voiceover afterward explaining "this call just came in" over the dashboard is fine.

1. **Open on the dashboard, empty or near-empty state** — a few seconds showing "here's the dashboard before anything happens" grounds the viewer.
2. **Place the call** (per the script above). If you're not showing live audio, cut to dashboard here and narrate that a call is coming in.
3. **Show the live-call indicator** (per the design doc's signature element — the pulsing dot on the performance card) if the call is still in progress when you cut back to the dashboard. This is the single most impressive "wow, it's really live" moment in the whole video — don't skip past it quickly.
4. **After the call ends, show the performance cards updating** — inbound call count increments.
5. **Open the call log**, show the new row: duration, sentiment tag, timestamp.
6. **Click into the transcript + recording playback** — let it play a few seconds of the actual audio with the synced transcript visible, then move on. Don't play the whole call again here; the viewer already heard it live.
7. **Open the booking panel**, show the new booking row with the restaurant-specific intake fields populated — party size, order items, pickup/delivery, the caller's name and number. This is the payoff shot: "the AI didn't just answer the phone, it captured everything correctly and it's sitting right here."
8. **Show the confirmation email** (open your own inbox, or a demo inbox) that Resend sent — proving the loop closes automatically, no manual step from the business owner.
9. **Close on the billing status pill** in the header — a clean "active" state, tier and usage visible — a few seconds is enough. This isn't the focus of the demo, but it quietly signals "there's a real subscription/business model behind this," which matters if the prospect is evaluating this as a serious vendor, not a side project.

## 4. What to Say While Showing It (rough voiceover beats, not a script to read verbatim)

- Open: "This is what happens when a customer calls [demo business name] — no one on their end has to do anything."
- During the live-call moment: "You can see the call is live right now — this updates in real time, not on a delay."
- At the booking panel: "Everything the caller said gets pulled out automatically — who they are, what they want, when — and it's all sitting here for the owner to see."
- At the email: "And the confirmation goes out immediately, to both the customer and the business, without anyone lifting a finger."
- Close: keep it short — don't oversell with adjectives ("amazing," "incredible"); let the working software be the pitch, per the design doc's own writing guidance (plain verbs, no forced enthusiasm).

## 5. After Recording

- [ ] Trim dead air (dial tone, ringing, any dashboard loading spinners) in editing — a 3-minute demo shouldn't have more than a few seconds of any single "waiting" moment.
- [ ] Do not reuse this exact recording for a CPA-firm prospect — the restaurant-specific intake fields and script will read as mismatched to their business, undercutting the "this is built for you" positioning from the product overview doc. Budget a second short call (still well within the free credit) for a CPA-firm-flavored version before pitching that vertical.
- [ ] Delete or clearly label the demo tenant in your admin panel afterward so it doesn't get confused with a real paying client in your own records.
