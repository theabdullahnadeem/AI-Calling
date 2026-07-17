# Security & Compliance Notes

**This is not legal advice.** This document is an internal risk-awareness reference, written from public sources as of July 2026. TCPA law is actively contested and shifting — before onboarding any client who will place outbound AI calls, get a real consultation with a lawyer familiar with TCPA and AI voice regulation. This doc tells you what to be aware of; it does not tell you that you're compliant.

---

## 1. TCPA — What Actually Applies

The Telephone Consumer Protection Act governs calls made using an "artificial or prerecorded voice." The FCC ruled in February 2024 that AI-generated voice counts as an artificial voice under this law — this is settled and applies nationwide. Every outbound AI call this platform places is subject to TCPA, full stop, regardless of how conversational or "not really a robocall" it sounds.

**Two consent tiers, and they matter:**

- **Informational / transactional calls** (e.g. appointment reminders, order status, a follow-up on an existing inquiry) require **prior express consent** — this can be oral or written.
- **Marketing / telemarketing calls** (e.g. cold outbound sales pitches, promotional follow-ups) require the higher bar: **prior express written consent (PEWC)** — a written agreement, in most of the US, clearly authorizing AI/prerecorded-voice calls.

**One regional exception, and don't over-rely on it:** in February 2026, the Fifth Circuit ruled in *Bradford v. Sovereign Pest Control* that the TCPA statute itself only requires oral-or-written consent, not the FCC's stricter written-consent rule — but this ruling **only binds Texas, Louisiana, and Mississippi**. Everywhere else in the US, the FCC's stricter PEWC-for-marketing rule still stands. Do not build this platform's compliance posture around the Fifth Circuit exception unless a specific client's calling is genuinely confined to those three states — treat PEWC as the default requirement for marketing-type outbound calls everywhere else.

**Other requirements that apply regardless of consent tier:**
- Do-not-call scrubbing — both the National DNC Registry and the client's own internal do-not-call list.
- Calling-hour limits — commonly 8am–8pm in the called party's local time (some states extend to 9pm).
- Honoring opt-out/revocation requests — if someone says stop calling, the platform needs a way to actually stop calling them.
- Increasingly common (not universally mandated yet, but a defensible best practice): disclosing at the start of the call that the caller is an AI agent.

## 2. Who Is Actually Liable

Be precise about this rather than assuming the worst-case framing by default. TCPA liability generally attaches to **the entity that initiates the call and the business the call is being made on behalf of** — in this platform's case, that's your client (the CPA firm, restaurant, etc.), not automatically Digivixo. Consent is something the client is expected to obtain upstream (e.g. a customer gave their number on an intake form, or agreed to follow-up calls) — the calling platform doesn't gather that consent and can't vouch for it having been obtained correctly.

That said, do not read this as "Digivixo has no exposure." Two things narrow that comfort:

- If Digivixo is deemed to have *initiated* the call (not just provided the technology) — a real possibility given the managed-service model here, where you configure the agent and control when/how outbound calls fire — liability exposure shifts toward the platform operator, not just the end client.
- Multiple sources are explicit that a vendor claiming their tool makes a client "TCPA-compliant" is not something a calling tool can actually deliver — implying that too. Don't market this platform's outbound feature as inherently compliant. It isn't, on its own.

**Practical posture:** treat outbound calling as a feature that requires an explicit compliance conversation with every client before it's turned on for them, not a default feature that ships enabled.

## 3. What This Means for the Platform (Action Items, Not Just Awareness)

- [ ] **Add a consent-capture field to the tenant intake process.** Before enabling outbound calling for any client, the client should affirmatively state how they're obtaining consent from the people they want called (e.g. "customer opted in via our booking form," "existing customer relationship"). This doesn't make Digivixo compliant on the client's behalf, but it creates a documented record that the question was asked and answered — meaningfully better than silence if this is ever scrutinized.
- [ ] **Do not enable outbound calling by default for new clients.** Treat it as an explicit opt-in feature requiring the consent conversation above, not something bundled automatically into the Standard/Pro tiers.
- [ ] **Add a contractual clause in your client agreement** (not this technical doc — an actual signed agreement with each client) stating the client is responsible for obtaining and maintaining valid consent for anyone they have the platform call, and that Digivixo is not liable for the client's failure to do so. This won't eliminate Digivixo's exposure entirely (see above), but it's a standard risk-allocation practice and its absence would be a real gap.
- [ ] **Build DNC scrubbing into the outbound flow if outbound calling ships** — check the National DNC Registry (and ideally let clients upload their own suppression list) before the platform dials anyone. This is a real feature requirement, not a policy footnote, if Prompt 6/7's outbound follow-up capability goes live for any client doing marketing-type calls.
- [ ] **Log consent basis and calling-hour compliance per call** in the `calls` table or a related table — if this is ever disputed, "we have no record of why we called this number" is a much worse position than having something to point to.
- [ ] **Before signing any client whose primary use case is outbound sales/marketing calls** (versus inbound reception + informational follow-up, which is a materially lower-risk profile), get actual legal review of that specific client's consent practices. Don't self-assess this one.

## 4. API Key & Infrastructure Security

- **Retell API keys and signing keys** — store only in environment variables (`.env` in local dev, your deployment platform's secret management in production). Never commit to git, never log in plaintext, never expose to the client-facing dashboard bundle (i.e. never a `NEXT_PUBLIC_` prefixed env var).
- **Scope keys as narrowly as Retell's dashboard allows** — if Retell supports per-agent or per-permission API key scoping, use it instead of one master key with full account access. Limits the blast radius if a key ever leaks.
- **Polar access token and webhook secret** — same rules. The webhook secret in particular must never be exposed client-side; it's what proves an incoming webhook actually came from Polar and wasn't spoofed by an attacker hitting your endpoint directly.
- **Rotate keys if you ever suspect exposure** (a leaked `.env` file, a compromised dev machine, an accidental git commit) — don't wait for evidence of misuse.
- **The tenant-scoped auth vulnerability already fixed in Prompt 2** (any tenant being able to view another tenant's data by editing the URL slug) is exactly the kind of issue this section exists to prevent recurring elsewhere — apply the same "never trust client-supplied identifiers for authorization" discipline to every new feature added later, not just the dashboard.
- **Recording and transcript data is sensitive** — call recordings and transcripts may contain names, phone numbers, and potentially financial or health information depending on the client's industry. Treat the Cloudflare R2 storage bucket as containing PII: restrict public access, use signed/expiring URLs for playback rather than permanently public links, and don't log full transcripts to any third-party analytics or error-tracking tool without checking what that tool retains.

## 5. Open Question to Resolve Before Outbound Calling Goes Live for Any Client

Whether Digivixo's current setup (managed-service model, agency configures and controls the calling) makes Digivixo more exposed to "initiator" liability than a pure self-serve SaaS tool would be. This isn't answerable from documentation — it depends on how a specific court would characterize the agency's role, and that's exactly the kind of question worth a real legal consultation before outbound calling is offered to a client at scale, not just informational inbound reception.
