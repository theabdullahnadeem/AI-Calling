import type { Metadata } from "next";

import { OVERAGE_RATE_PER_MINUTE_USD, TIER_PRICING } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata: Metadata = {
  title: "Digivixo — an AI receptionist that answers every call",
  description:
    "A managed AI voice agent that answers your business line, captures booking and intake details, and shows you exactly what happened on every call.",
};

/**
 * Marketing homepage.
 *
 * Two constraints shape the content, both from the project docs:
 *
 * 1. docs/05 — same visual system as the dashboard (five named colours, 6px
 *    radius, restraint). Explicitly NOT: a gradient hero, numbered step
 *    markers, motion, or forced enthusiasm in the copy.
 * 2. docs/03 §5 — only the ONE verified client's measured results may be
 *    published. No projected or industry-average ROI figures, no invented
 *    testimonials or logos. The honesty is stated on the page rather than
 *    hidden, because a buyer who asks for methodology should find one.
 *
 * Pricing renders from TIER_PRICING — the same constant that writes each
 * subscription row — so the page can never advertise a number the billing
 * system doesn't charge.
 */

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("en-US");

const TIERS = [
  {
    key: "pilot" as const,
    name: "Pilot",
    tag: null,
    fit: "For a single location testing the waters on one busy line.",
  },
  {
    key: "standard" as const,
    name: "Standard",
    tag: "Most common",
    fit: "For an established business where the phone rings all day.",
  },
  {
    key: "pro" as const,
    name: "Pro",
    tag: null,
    fit: "For multi-location or high-volume operations.",
  },
];

export default function HomePage() {
  return (
    <>
      <header className="mk-wrap">
        <nav className="mk-nav">
          <span className="mk-wordmark">Digivixo</span>
          <span className="mk-nav-actions">
            <a className="mk-link" href="#pricing">
              Pricing
            </a>
            <a className="mk-link" href="/login">
              Client log in
            </a>
            <a className="mk-btn" href={`mailto:${SUPPORT_EMAIL}`}>
              Talk to us
            </a>
          </span>
        </nav>
      </header>

      <main>
        <section className="mk-wrap mk-hero">
          <p className="mk-eyebrow">Managed voice AI</p>
          <h1>Every call answered, every detail captured.</h1>
          <p className="mk-lede">
            Digivixo answers your business line with an AI agent that handles
            the conversation, writes down what the caller wants, and books it —
            then shows you exactly what happened on every call. You never touch
            a setting. We build and run the whole thing for you.
          </p>
          <div className="mk-hero-actions">
            <a
              className="mk-btn mk-btn--primary"
              href={`mailto:${SUPPORT_EMAIL}?subject=Digivixo%20enquiry`}
            >
              Talk to us
            </a>
            <a className="mk-btn" href="#how">
              See how it works
            </a>
          </div>
        </section>

        <section className="mk-wrap mk-section">
          <h2>A missed call is a missed customer</h2>
          <p className="mk-section-lede">
            Every unanswered call during business hours is a lead someone else
            gets. After hours, it is usually a lead who never calls back.
            Hiring reception staff to cover it is expensive and does not flex
            when call volume spikes — and a press-1-for-hours phone menu just
            annoys the person on the other end.
          </p>
          <div className="mk-grid">
            <div className="mk-card">
              <h3>Answers on the first ring</h3>
              <p>
                Your agent picks up every call, at any hour, however many come
                at once. Nobody waits on hold and nobody reaches a machine that
                tells them to call back later.
              </p>
            </div>
            <div className="mk-card">
              <h3>Handles the actual conversation</h3>
              <p>
                It knows your hours, services, pricing and policies, answers
                the routine questions, and speaks naturally rather than reading
                a menu tree.
              </p>
            </div>
            <div className="mk-card">
              <h3>Writes down what matters</h3>
              <p>
                When a caller wants to book, order or enquire, the details are
                captured as structured information — not a voicemail for
                someone to transcribe later.
              </p>
            </div>
          </div>
        </section>

        <section id="how" className="mk-wrap mk-section">
          <h2>How it works</h2>
          <p className="mk-section-lede">
            We configure the agent around your business before it takes a
            single call. From then on it runs itself, and everything it does
            appears on your dashboard as it happens.
          </p>
          <div className="mk-grid">
            <div className="mk-card">
              <h3>The call comes in</h3>
              <p>
                Your existing number routes to the agent. It greets the caller,
                answers questions, and works out what they need.
              </p>
            </div>
            <div className="mk-card">
              <h3>The booking is captured</h3>
              <p>
                Intake details land on your dashboard in real time, and a
                confirmation email goes to both the customer and you —
                automatically, with nothing for anyone to remember.
              </p>
            </div>
            <div className="mk-card">
              <h3>You see everything</h3>
              <p>
                Recording, synced transcript, and a sentiment tag on every
                call, so you can check any conversation without listening to
                all of them.
              </p>
            </div>
          </div>
        </section>

        <section className="mk-wrap mk-section">
          <h2>Built around your business, not a template</h2>
          <p className="mk-section-lede">
            What gets captured is configured per client. A restaurant needs
            party size, order items and pickup time. An accounting firm needs
            the service requested and how urgent it is. Same platform,
            different clipboard — so the information you get is the
            information you actually use.
          </p>

          <div className="mk-preview">
            <div className="mk-preview-bar">
              <span>Your dashboard</span>
              <span>Standard · Active</span>
            </div>
            <div className="mk-preview-body">
              <div className="mk-preview-cards">
                <div className="mk-preview-card">
                  <div className="mk-preview-value">128</div>
                  <div className="mk-preview-label">
                    Calls received
                    <span className="dv-live-dot" aria-hidden />
                  </div>
                </div>
                <div className="mk-preview-card">
                  <div className="mk-preview-value">31</div>
                  <div className="mk-preview-label">Outbound follow-ups</div>
                </div>
                <div className="mk-preview-card">
                  <div className="mk-preview-value">74</div>
                  <div className="mk-preview-label">Bookings secured</div>
                </div>
              </div>
              <div className="mk-preview-rows">
                <div className="mk-preview-row mk-preview-row--head">
                  <span>Caller</span>
                  <span>Duration</span>
                  <span>Sentiment</span>
                  <span>Outcome</span>
                </div>
                <div className="mk-preview-row">
                  <span>+1 555 010 8842</span>
                  <span>2:34</span>
                  <span>
                    <span className="dv-dot dv-dot--signal" />
                    Positive
                  </span>
                  <span>Table for 4</span>
                </div>
                <div className="mk-preview-row">
                  <span>+1 555 010 3390</span>
                  <span>1:12</span>
                  <span>
                    <span className="dv-dot" />
                    Inquisitive
                  </span>
                  <span>Asked hours</span>
                </div>
                <div className="mk-preview-row">
                  <span>+1 555 010 7715</span>
                  <span>3:48</span>
                  <span>
                    <span className="dv-dot dv-dot--signal" />
                    Positive
                  </span>
                  <span>Order placed</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mk-wrap mk-section">
          <h2>What we have measured</h2>
          <p className="mk-section-lede">
            From one client deployment, referenced anonymously with their
            permission, over a 60-day measurement period.
          </p>
          <div className="mk-stats">
            <div className="mk-stat">
              <div className="mk-stat-value">32% → 5%</div>
              <div className="mk-stat-label">
                Missed call rate, before and after
              </div>
            </div>
            <div className="mk-stat">
              <div className="mk-stat-value">+13%</div>
              <div className="mk-stat-label">
                Revenue, attributed to calls that would previously have gone
                unanswered
              </div>
            </div>
          </div>
          <p className="mk-caveat">
            That is one client, and we say so. We do not publish
            industry-average or projected figures, because we cannot show you
            the methodology behind numbers we did not measure ourselves. As
            more clients come online this section gets more data points rather
            than bigger claims.
          </p>
        </section>

        <section id="pricing" className="mk-wrap mk-section">
          <h2>Pricing</h2>
          <p className="mk-section-lede">
            Billed monthly. Included minutes cover the calls your agent
            handles; beyond that it is{" "}
            <strong>${OVERAGE_RATE_PER_MINUTE_USD} per minute</strong>, shown
            on your dashboard as you use it. Setup, agent configuration and
            ongoing tuning are included — there is no separate onboarding fee.
          </p>
          <div className="mk-prices">
            {TIERS.map((tier) => {
              const pricing = TIER_PRICING[tier.key];
              return (
                <div
                  key={tier.key}
                  className={`mk-price${tier.tag ? " mk-price--featured" : ""}`}
                >
                  <div className="mk-price-name">
                    {tier.name}
                    {tier.tag ? (
                      <span className="mk-price-tag">{tier.tag}</span>
                    ) : null}
                  </div>
                  <div className="mk-price-amount">
                    {currency.format(Number(pricing.monthlyPriceUsd))}
                    <span className="mk-price-period"> / month</span>
                  </div>
                  <p className="mk-price-detail">
                    <strong>{number.format(pricing.minuteCap)} minutes</strong>{" "}
                    included each month.
                    <br />
                    {tier.fit}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mk-wrap mk-section">
          <h2>What this is not</h2>
          <ul className="mk-list">
            <li>
              <strong>Not a tool you have to run.</strong> You never write a
              prompt, pick a voice, or configure telephony. That is our job,
              and it stays our job.
            </li>
            <li>
              <strong>Not a one-size-fits-all form.</strong> What the agent
              captures is set up around your business at onboarding.
            </li>
            <li>
              <strong>Not a payment processor.</strong> We handle calls and
              bookings. Your customer payments stay wherever they are today.
            </li>
            <li>
              <strong>Not self-serve.</strong> We onboard clients personally,
              because getting the agent right takes a conversation first.
              Outbound follow-up calls are enabled per client only after we
              have discussed how you obtain consent to call your customers.
            </li>
          </ul>
        </section>

        <section className="mk-wrap mk-close">
          <h2>See it answer your phone</h2>
          <p>
            Tell us about your business and the calls you are missing. We will
            show you what the agent would do with them.
          </p>
          <a
            className="mk-btn mk-btn--primary"
            href={`mailto:${SUPPORT_EMAIL}?subject=Digivixo%20enquiry`}
          >
            Talk to us
          </a>
        </section>
      </main>

      <footer className="mk-wrap mk-footer">
        <span>© {new Date().getFullYear()} Digivixo</span>
        <span>
          <a className="mk-link" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </span>
      </footer>
    </>
  );
}
