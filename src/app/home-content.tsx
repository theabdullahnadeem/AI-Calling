"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

import { OVERAGE_RATE_PER_MINUTE_USD, TIER_PRICING } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/support";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("en-US");

const HERO_WORDS = ["Never", "miss", "a", "call", "again."];
const ACCENT_WORD_INDEX = 3; // "call"

// Static base heights (percent) for the hero equalizer bars — they read as a
// waveform even before GSAP animates them, and if motion never runs.
const EQ_BARS = [
  34, 58, 44, 78, 92, 64, 48, 84, 100, 72, 52, 88, 62, 40, 70, 54, 82, 46, 60,
  36,
];

const MARQUEE = [
  "Restaurants",
  "Dental clinics",
  "Law firms",
  "Salons",
  "Home services",
  "Accounting firms",
  "Real estate",
  "Auto repair",
];

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

const mailto = (subject: string) =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;

export function HomeContent() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = root.current;
    if (!scope) return;

    // Reduced motion: CSS already keeps everything visible and the counters
    // already show their final values in the DOM. Do nothing.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const q = (sel: string) =>
        Array.from(scope.querySelectorAll<HTMLElement>(sel));

      // Hero headline — word-by-word rise (runs on load, no scroll trigger).
      gsap.fromTo(
        q(".mk-hero-word"),
        { yPercent: 60, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.08,
          delay: 0.1,
        },
      );

      // Scroll-revealed blocks.
      q(".reveal").forEach((node) => {
        gsap.fromTo(
          node,
          { y: 28, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: { trigger: node, start: "top 90%", once: true },
          },
        );
      });

      // Count-up stats.
      q("[data-count-to]").forEach((node) => {
        const to = Number(node.dataset.countTo);
        const from = Number(node.dataset.countFrom ?? "0");
        const prefix = node.dataset.countPrefix ?? "";
        const suffix = node.dataset.countSuffix ?? "";
        const obj = { v: from };
        node.textContent = `${prefix}${Math.round(from)}${suffix}`;
        gsap.to(obj, {
          v: to,
          duration: 1.4,
          ease: "power2.out",
          scrollTrigger: { trigger: node, start: "top 90%", once: true },
          onUpdate: () => {
            node.textContent = `${prefix}${Math.round(obj.v)}${suffix}`;
          },
        });
      });

      // Hero equalizer — each bar breathes on its own loop, like live audio.
      q(".mk-eq span").forEach((bar, i) => {
        gsap.to(bar, {
          scaleY: 0.35 + ((i * 7) % 5) * 0.09,
          transformOrigin: "center",
          duration: 0.5 + ((i * 3) % 4) * 0.18,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: (i % 6) * 0.08,
        });
      });

      // Nav border once scrolled off the top.
      const nav = q(".mk-nav")[0];
      if (nav) {
        ScrollTrigger.create({
          trigger: document.body,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (s) =>
            nav.classList.toggle("mk-nav--scrolled", s.scroll() > 8),
        });
      }
    }, scope);

    // Positions may be measured before fonts/layout settle; recompute after
    // the first painted frame so above-the-fold triggers fire correctly.
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(raf);
      ctx.revert();
    };
  }, []);

  return (
    <div className="mk" ref={root}>
      {/* No-JS / crawler safety: unhide anything the reveal styles hid. */}
      <noscript>
        <style>{`.reveal,.mk-hero-word{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      <div className="mk-wrap">
        <nav className="mk-nav">
          <a className="mk-wordmark" href="/">
            Digi<span>vixo</span>
          </a>
          <div className="mk-nav-actions">
            <a className="mk-link" href="#how">
              How it works
            </a>
            <a className="mk-link" href="#pricing">
              Pricing
            </a>
            <a className="mk-link" href="/login">
              Client log in
            </a>
            <a className="mk-btn mk-btn--primary" href={mailto("Digivixo enquiry")}>
              Talk to us
            </a>
          </div>
        </nav>
      </div>

      <header className="mk-wrap mk-hero">
        <div
          className="mk-glow"
          style={{ width: 560, height: 560, top: -160, right: -140 }}
          aria-hidden
        />
        <div className="mk-hero-copy">
          <p className="mk-eyebrow">Managed voice AI</p>
          <h1>
          {HERO_WORDS.map((word, i) => (
            <span key={i} className="mk-hero-word">
              <span className={i === ACCENT_WORD_INDEX ? "mk-accent" : undefined}>
                {word}
              </span>
              {i < HERO_WORDS.length - 1 ? " " : null}
            </span>
          ))}
        </h1>
        <p className="mk-lede reveal">
          Digivixo answers your business line with an AI agent that handles the
          conversation, captures every booking, and shows you exactly what
          happened on every call — while you never touch a setting. We build
          and run the whole thing for you.
        </p>
        <div className="mk-hero-actions reveal">
          <a className="mk-btn mk-btn--primary mk-btn--lg" href={mailto("Digivixo enquiry")}>
            Talk to us
          </a>
          <a className="mk-btn mk-btn--lg" href="#how">
            See how it works
          </a>
        </div>
        </div>
        <div className="mk-hero-visual" aria-hidden>
          <div className="mk-eq">
            {EQ_BARS.map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </header>

      <div className="mk-marquee" aria-hidden>
        <div className="mk-marquee-track">
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i} className="mk-marquee-item">
              {item}
            </span>
          ))}
        </div>
      </div>

      <section className="mk-wrap mk-section">
        <div className="mk-section-head reveal">
          <p className="mk-kicker">The problem</p>
          <h2 className="mk-h2">A missed call is a missed customer.</h2>
          <p className="mk-section-lede">
            Every unanswered call during business hours is a lead someone else
            gets. After hours, it&apos;s usually a lead who never calls back.
            Reception staff are expensive and don&apos;t flex when volume
            spikes — and a press-1-for-hours menu just annoys the caller.
          </p>
        </div>
        <div className="mk-grid">
          {[
            {
              title: "Answers on the first ring",
              body: "Every call, any hour, however many at once. Nobody waits on hold and nobody reaches a machine telling them to call back.",
              icon: "M4 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 3 4a1 1 0 0 1 1-1",
            },
            {
              title: "Handles the conversation",
              body: "It knows your hours, services, pricing and policies, answers the routine questions, and speaks naturally — not a menu tree.",
              icon: "M4 5h16v10H8l-4 4z",
            },
            {
              title: "Writes down what matters",
              body: "When a caller books, orders or enquires, the details land as structured information — not a voicemail for someone to transcribe.",
              icon: "M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h5",
            },
          ].map((f) => (
            <div className="mk-card reveal" key={f.title}>
              <div className="mk-card-mark">
                <Icon d={f.icon} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mk-wrap mk-section">
        <div className="mk-section-head reveal">
          <p className="mk-kicker">How it works</p>
          <h2 className="mk-h2">Set up once. Runs itself after.</h2>
          <p className="mk-section-lede">
            We configure the agent around your business before it takes a single
            call. From then on everything it does appears on your dashboard as
            it happens.
          </p>
        </div>
        <div className="mk-steps">
          {[
            {
              title: "The call comes in",
              body: "Your existing number routes to the agent. It greets the caller, answers questions, and works out what they need.",
            },
            {
              title: "The booking is captured",
              body: "Intake details land on your dashboard in real time, and a confirmation email goes to the customer and to you — automatically.",
            },
            {
              title: "You see everything",
              body: "Recording, synced transcript and a sentiment tag on every call, so you can check any conversation without hearing them all.",
            },
          ].map((s) => (
            <div className="mk-step reveal" key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-wrap mk-section">
        <div className="mk-section-head reveal">
          <p className="mk-kicker">Your dashboard</p>
          <h2 className="mk-h2">Built around your business, not a template.</h2>
          <p className="mk-section-lede">
            What gets captured is configured per client. A restaurant needs
            party size and order items; an accounting firm needs the service
            requested and how urgent it is. Same platform, different clipboard.
          </p>
        </div>
        <div className="mk-preview reveal">
          <div className="mk-preview-bar">
            <div className="mk-preview-dots">
              <span />
              <span />
              <span />
            </div>
            <span>Standard · Active</span>
          </div>
          <div className="mk-preview-body">
            <div className="mk-preview-cards">
              <div className="mk-preview-card mk-preview-card--live">
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
              {[
                ["+1 555 010 8842", "2:34", "Positive", "Table for 4"],
                ["+1 555 010 3390", "1:12", "Inquisitive", "Asked hours"],
                ["+1 555 010 7715", "3:48", "Positive", "Order placed"],
              ].map((r) => (
                <div className="mk-preview-row" key={r[0]}>
                  <span>{r[0]}</span>
                  <span>{r[1]}</span>
                  <span>
                    <span
                      className={
                        r[2] === "Positive" ? "dv-dot dv-dot--signal" : "dv-dot"
                      }
                    />
                    {r[2]}
                  </span>
                  <span>{r[3]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mk-wrap mk-section">
        <div
          className="mk-glow"
          style={{ width: 520, height: 520, top: -40, right: -180 }}
          aria-hidden
        />
        <div className="mk-section-head reveal">
          <p className="mk-kicker">What we&apos;ve measured</p>
          <h2 className="mk-h2">Real numbers, from a real deployment.</h2>
          <p className="mk-section-lede">
            From one client, referenced anonymously with their permission, over
            a 60-day measurement period.
          </p>
        </div>
        <div className="mk-stats">
          <div className="mk-stat reveal">
            <div
              className="mk-stat-value"
              data-count-to="5"
              data-count-from="32"
              data-count-suffix="%"
            >
              5%
            </div>
            <div className="mk-stat-label">
              Missed-call rate, down from 32% before the agent went live.
            </div>
          </div>
          <div className="mk-stat reveal">
            <div
              className="mk-stat-value"
              data-count-to="13"
              data-count-from="0"
              data-count-prefix="+"
              data-count-suffix="%"
            >
              +13%
            </div>
            <div className="mk-stat-label">
              Revenue, attributed to calls that would previously have gone
              unanswered.
            </div>
          </div>
        </div>
        <p className="mk-caveat reveal">
          That&apos;s one client, and we say so. We don&apos;t publish
          industry-average or projected figures — we can&apos;t show you the
          methodology behind numbers we didn&apos;t measure ourselves. As more
          clients come online this section gets more data points, not bigger
          claims.
        </p>
      </section>

      <section id="pricing" className="mk-wrap mk-section">
        <div className="mk-section-head reveal">
          <p className="mk-kicker">Pricing</p>
          <h2 className="mk-h2">One monthly plan. No setup fee.</h2>
          <p className="mk-section-lede">
            Included minutes cover the calls your agent handles; beyond that
            it&apos;s{" "}
            <strong style={{ color: "var(--ink)" }}>
              ${OVERAGE_RATE_PER_MINUTE_USD} per minute
            </strong>
            , shown on your dashboard as you use it. Setup, agent configuration
            and ongoing tuning are included.
          </p>
        </div>
        <div className="mk-prices">
          {TIERS.map((tier) => {
            const pricing = TIER_PRICING[tier.key];
            return (
              <div
                key={tier.key}
                className={`mk-price reveal${tier.tag ? " mk-price--featured" : ""}`}
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
        <div className="mk-section-head reveal">
          <p className="mk-kicker">Straight answers</p>
          <h2 className="mk-h2">What this is not.</h2>
        </div>
        <ul className="mk-list">
          <li className="reveal">
            <strong>Not a tool you have to run.</strong> You never write a
            prompt, pick a voice, or configure telephony. That stays our job.
          </li>
          <li className="reveal">
            <strong>Not one-size-fits-all.</strong> What the agent captures is
            set up around your business at onboarding.
          </li>
          <li className="reveal">
            <strong>Not a payment processor.</strong> We handle calls and
            bookings. Your customer payments stay wherever they are today.
          </li>
          <li className="reveal">
            <strong>Not self-serve.</strong> We onboard clients personally, and
            outbound follow-up calls are enabled only after we discuss how you
            obtain consent to call your customers.
          </li>
        </ul>
      </section>

      <section className="mk-wrap mk-close">
        <div
          className="mk-glow"
          style={{
            width: 640,
            height: 640,
            bottom: -260,
            left: "50%",
            transform: "translateX(-50%)",
          }}
          aria-hidden
        />
        <h2 className="reveal">See it answer your phone.</h2>
        <p className="reveal">
          Tell us about your business and the calls you&apos;re missing. We&apos;ll
          show you what the agent would do with them.
        </p>
        <div className="reveal">
          <a
            className="mk-btn mk-btn--primary mk-btn--lg"
            href={mailto("Digivixo enquiry")}
          >
            Talk to us
          </a>
        </div>
      </section>

      <footer className="mk-wrap mk-footer">
        <span>© {new Date().getFullYear()} Digivixo</span>
        <a className="mk-link" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      </footer>
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
