# Dashboard Design Doc

**Audience for this doc: Claude Code, building the actual UI from Prompt 7.** This is a design spec, not a mockup — it defines the visual system so the dashboard reads as deliberate, professional software rather than a default component-library look.

## 1. Who This Is For, and What It Has to Feel Like

The person opening this dashboard is a business owner — a CPA firm partner, a restaurant owner — checking whether their phone system is working and whether they're making money from it. They are not a developer. They will judge this software the same way they judge any tool they pay for: does it look like something a real, capable company built, or does it look like a template someone stitched together over a weekend.

The brief itself already names the failure mode to avoid: it should not look like AI-generated slop, and it should look like professional software. That's the whole design problem — not "make it pretty," but "make it read as considered."

**What "AI slop" specifically looks like, so it's avoidable on purpose:** a warm cream background with a high-contrast serif and a terracotta/clay accent near #D97757; or a near-black background with one bright acid-green/vermilion accent; or a dense broadsheet layout with hairline rules and zero border-radius everywhere. All three are legitimate looks in the right brief, but they're the reflexive default, not a choice — this doc deliberately avoids all three.

## 2. Design Direction

**Concept: instrument panel, not marketing page.** The dashboard's job is to answer three questions fast — did we get calls, did we get bookings, are we getting paid — and then let the owner drill into any one call if something looks off. The visual metaphor is closer to a well-designed operations console (think: the clarity of a good banking app, not the personality of a startup landing page). Confidence comes from restraint and precision, not decoration.

**Color — 5 named values:**

- `--ink` `#161B22` — near-black, used for primary text and the nav rail. Not pure black; slightly blue-shifted so it feels engineered rather than default.
- `--paper` `#FAFAF8` — the base background. Warm-neutral off-white, but cooler and less "cream" than the AI-slop default — closer to unbleached paper than latte foam.
- `--slate` `#5B6472` — secondary text, muted labels, inactive states.
- `--signal` `#1F6F5C` — the one accent color. A deep, confident teal-green — chosen because it reads as "money/growth/positive signal" without being the expected fintech blue or the AI-slop terracotta/acid-green. Used sparingly: primary actions, positive sentiment tags, the "active" subscription state.
- `--alert` `#B3542C` — a burnt orange-red, used only for payment_overdue banners, negative sentiment tags, and suspended-state messaging. Never decorative — if this color appears, something needs the owner's attention.

**Typography — 2 roles, deliberately paired:**

- **Display/headers:** a grotesk sans with real character, not a generic system font — something like **Söhne** or **General Sans** (or an equivalent geometric-but-humanist grotesk your font pipeline has access to). Used at restrained sizes — this is a dashboard, not a poster. Headers should feel typeset, not just "bold and bigger."
- **Body/data:** a highly legible, slightly condensed sans built for dense tabular reading — something like **Inter** or **IBM Plex Sans** — used for call logs, transcripts, and numbers. This is the workhorse face; it should disappear into readability, not compete with the display face.
- Numbers (minute counts, dollar figures, call durations) should use **tabular figures** (`font-variant-numeric: tabular-nums`) everywhere they appear in a list or table, so columns of numbers align vertically instead of jittering — a small detail that reads as "someone who builds software for a living made this," which is exactly the signal this brief is asking for.

**Layout concept:**

```
┌─────────────────────────────────────────────────┐
│ [Business name / slug]      [Billing status pill]│  <- persistent header
├───────────┬─────────────────────────────────────┤
│           │  Performance cards (3 across)         │
│  Nav rail │  ─────────────────────────────────    │
│  (icons + │  Call log (searchable table)          │
│  labels)  │  ─────────────────────────────────    │
│           │  Booking panel                        │
└───────────┴─────────────────────────────────────┘
```

- Left nav rail, not a top nav bar — this is a "return daily to check on your business" tool, and a persistent rail with the billing-status pill always visible (in the header, not buried in a settings page) matches how the owner actually uses it: glance at status, then drill into whatever needs attention.
- Generous whitespace between sections, but tight, information-dense rows *within* the call log and booking tables — the contrast between "breathing room at the macro level" and "no wasted space at the micro level" is what separates a dashboard that feels engineered from one that feels like a form builder's default table.
- Card corner radius: small and consistent (6px), not the rounded-everything softness that reads as generic SaaS, and not sharp zero-radius broadsheet edges either — a deliberate middle that reads as precise rather than either extreme.

**Signature element:** the **live call indicator** — when a call is actively in progress (per the Redis-cached live status from Prompt 3), the relevant performance card gets a subtle pulsing dot next to "Calls Received," and a thin `--signal`-colored line traces along the top edge of that card. This is the one piece of motion in the whole interface, and it's functional, not decorative — it's the dashboard visibly proving the system is alive and working in real time, which is the single most reassuring thing this software can show a nervous first-week client.

**Motion, generally: almost none.** No page-load animations, no scroll-triggered reveals, no hover flourishes beyond a simple state change (background shift, no scale/bounce). The live-call pulse above is the one deliberate exception. Restraint here is itself the professional signal — busy motion is one of the more common tells for a design that hasn't been edited down.

## 3. Component Notes

- **Performance cards:** big number, small label, no icon-heavy decoration. Tabular-nums for the figure. If a stat improved vs. last period, a small `--signal`-colored delta indicator (e.g. "+12%"), muted and small — supporting information, not the headline.
- **Billing status pill (header):** three states, each with a distinct but restrained treatment — `active` (quiet `--signal` dot, no banner), `payment_overdue` (visible `--alert` background pill with the countdown/CTA text from Prompt 7), `suspended` (full-page block, not a pill at all — see Prompt 7).
- **Call log table:** sentiment shown as a small colored dot + label, not a loud badge — `--signal` for positive, `--slate` for neutral/inquisitive, `--alert` for negative. Recording playback icon inline, opens the transcript+audio view rather than navigating away.
- **Booking panel:** since `intakeData` fields are dynamic per tenant (per `intakeSchema`), render field labels in `--slate`, values in `--ink` — consistent hierarchy regardless of what the actual fields are, so a CPA firm's "Service Requested" column looks exactly as considered as a restaurant's "Party Size" column. No field should look like an afterthought just because it's tenant-specific.
- **Empty states:** per the writing guidance below — an empty call log on day one should say something like "No calls yet — once your line is live, they'll show up here," not a generic "No data" or a decorative illustration. It's an invitation, not an apology.

## 4. Writing/Copy Rules for the Interface

- Name things by what the owner controls, never by system internals. "Your bookings," not "webhook-triggered records." "Payment failed," not "Polar subscription status: past_due."
- Active voice, consistent verb across a flow: if a button says "Retry Payment," the resulting confirmation says "Payment retried" — not "Transaction resubmitted" or some other drifted phrase.
- Errors state what happened and what to do, plainly, no apology tone: "This call recording isn't available yet — check back in a few minutes," not "Oops! Something went wrong."
- No exclamation points, no forced enthusiasm ("Great job! Your bookings are up!"). This is a business owner checking on operations, not a consumer app trying to feel fun.

## 5. What NOT To Do (explicit anti-patterns for this brief)

- No stock "dashboard template" gradient hero at the top of the page — there is no hero here, this isn't a marketing page, it opens straight into the performance cards.
- No numbered-step markers (01 / 02 / 03) anywhere in the dashboard — nothing here is a sequence; don't decorate with sequence markers that don't carry real order information.
- No cream-background-plus-terracotta or near-black-plus-neon-accent palette — both are the reflexive AI-generated defaults this brief is explicitly trying to avoid.
- No illustrated empty-state graphics or mascot-style icons — keep the visual language consistent with "instrument panel," not "friendly onboarding app."
