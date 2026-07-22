"use client";

import { gsap } from "gsap";
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
    const q = (sel: string) =>
      Array.from(scope.querySelectorAll<HTMLElement>(sel));

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // Sticky nav border toggle on scroll
    const header = q(".mk-header")[0];
    const onScroll = () =>
      header?.classList.toggle("mk-header--scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const reveals = q(".reveal");
    const counters = q("[data-count-to]");

    const runCounter = (node: HTMLElement) => {
      if (node.dataset.counted) return;
      node.dataset.counted = "1";
      const to = Number(node.dataset.countTo);
      const from = Number(node.dataset.countFrom ?? "0");
      const prefix = node.dataset.countPrefix ?? "";
      const suffix = node.dataset.countSuffix ?? "";
      const start = performance.now();
      const dur = 1800;
      const frame = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(2, -10 * p); // easeOutExpo
        node.textContent = `${prefix}${Math.round(from + (to - from) * eased)}${suffix}`;
        if (p < 1) requestAnimationFrame(frame);
      };
      if (document.hidden) node.textContent = `${prefix}${to}${suffix}`;
      else requestAnimationFrame(frame);
    };

    // Hold counters at start value until they scroll into view
    counters.forEach((node) => {
      const prefix = node.dataset.countPrefix ?? "";
      const suffix = node.dataset.countSuffix ?? "";
      node.textContent = `${prefix}${node.dataset.countFrom ?? "0"}${suffix}`;
    });

    const ctx = gsap.context(() => {
      if (!reduce) {
        // Hero Eyebrow entrance
        gsap.fromTo(
          q(".mk-eyebrow"),
          { opacity: 0, x: -24, filter: "blur(4px)" },
          { opacity: 1, x: 0, filter: "blur(0px)", duration: 0.8, ease: "power3.out" },
        );

        // 3D Perspective Kinetic Word Rise & Blur Unfurl
        gsap.fromTo(
          q(".mk-hero-word"),
          {
            y: 70,
            opacity: 0,
            rotateX: -60,
            scale: 0.82,
            filter: "blur(10px)",
            transformPerspective: 800,
          },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 1.25,
            ease: "power4.out",
            stagger: 0.08,
            delay: 0.08,
          },
        );

        // Hero subtext entrance
        gsap.fromTo(
          q(".mk-lede"),
          { opacity: 0, y: 28, filter: "blur(4px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, delay: 0.35, ease: "power3.out" },
        );

        // Hero CTA buttons spring pop
        gsap.fromTo(
          q(".mk-hero-actions a"),
          { opacity: 0, y: 24, scale: 0.92 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            delay: 0.45,
            stagger: 0.12,
            ease: "back.out(1.6)",
          },
        );

        // Interactive 3D Parallax Mouse movement over Hero Graphic
        const heroVisual = q(".mk-hero-visual")[0];
        if (heroVisual) {
          const xTo = gsap.quickTo(heroVisual, "rotateY", { duration: 0.6, ease: "power2.out" });
          const yTo = gsap.quickTo(heroVisual, "rotateX", { duration: 0.6, ease: "power2.out" });
          const handleMouseMove = (e: MouseEvent) => {
            const rect = scope.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width - 0.5;
            const relY = (e.clientY - rect.top) / rect.height - 0.5;
            xTo(relX * 14);
            yTo(-relY * 14);
          };
          scope.addEventListener("mousemove", handleMouseMove);
        }
      }

      // Multi-Wave Spectral Audio Equalizer Animation
      q(".mk-eq span").forEach((bar, i) => {
        const basePhase = (i / 20) * Math.PI * 2;
        gsap.to(bar, {
          scaleY: 0.18 + Math.abs(Math.sin(basePhase)) * 0.72 + (i % 4) * 0.08,
          opacity: 0.7 + Math.abs(Math.cos(basePhase)) * 0.3,
          transformOrigin: "bottom center",
          duration: 0.4 + (i % 5) * 0.1,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          delay: (i % 7) * 0.06,
        });
      });

      // Interactive Card Hover Physics
      q(".mk-card, .mk-price, .mk-stat").forEach((card) => {
        card.addEventListener("mouseenter", () => {
          gsap.to(card, {
            y: -6,
            scale: 1.015,
            duration: 0.25,
            ease: "power2.out",
          });
        });
        card.addEventListener("mouseleave", () => {
          gsap.to(card, {
            y: 0,
            scale: 1,
            duration: 0.3,
            ease: "power2.out",
          });
        });
      });
    }, scope);

    // Staggered 3D Scroll Reveal Observer
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          el.classList.add("is-in");
          if (!reduce) {
            if (
              el.classList.contains("mk-grid") ||
              el.classList.contains("mk-steps") ||
              el.classList.contains("mk-prices") ||
              el.classList.contains("mk-stats")
            ) {
              gsap.fromTo(
                el.children,
                {
                  y: 44,
                  opacity: 0,
                  scale: 0.94,
                  rotateY: -8,
                  transformPerspective: 800,
                },
                {
                  y: 0,
                  opacity: 1,
                  scale: 1,
                  rotateY: 0,
                  duration: 0.85,
                  stagger: 0.14,
                  ease: "power3.out",
                },
              );
            } else if (el.classList.contains("mk-preview")) {
              gsap.fromTo(
                el,
                { y: 36, opacity: 0, scale: 0.96 },
                { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: "power3.out" },
              );
              gsap.fromTo(
                el.querySelectorAll(".mk-preview-row"),
                { x: -20, opacity: 0 },
                {
                  x: 0,
                  opacity: 1,
                  duration: 0.6,
                  stagger: 0.1,
                  delay: 0.3,
                  ease: "power2.out",
                },
              );
            } else {
              gsap.fromTo(
                el,
                { y: 36, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
              );
            }
          }
          if (el.dataset.countTo) runCounter(el);
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -50px 0px" },
    );

    reveals.forEach((el) => io.observe(el));
    counters.forEach((el) => {
      if (!el.classList.contains("reveal")) io.observe(el);
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
      ctx.revert();
    };
  }, []);

  return (
    <div className="mk min-h-screen overflow-x-clip bg-paper text-ink" ref={root}>
      <noscript>
        <style>{`.reveal,.mk-hero-word{opacity:1!important;transform:none!important}`}</style>
      </noscript>

      {/* Sticky Full-Width Header */}
      <header className="mk-header sticky top-0 z-50 w-full backdrop-blur-md bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] border-b border-transparent transition-all duration-200">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="mk-nav flex items-center justify-between py-3.5">
            <a className="mk-wordmark font-display font-bold text-xl tracking-tight text-ink no-underline" href="/">
              Digi<span className="text-signal">vixo</span>
            </a>
            <div className="mk-nav-actions flex items-center gap-6 text-sm">
              <a className="mk-link text-slate hover:text-ink transition-colors duration-150 no-underline hidden sm:inline-block" href="#how">
                How it works
              </a>
              <a className="mk-link text-slate hover:text-ink transition-colors duration-150 no-underline hidden sm:inline-block" href="#pricing">
                Pricing
              </a>
              <a className="mk-link text-slate hover:text-ink transition-colors duration-150 no-underline" href="/login">
                Client log in
              </a>
              <a className="mk-btn mk-btn--primary inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-full no-underline bg-signal border border-signal text-on-accent hover:brightness-95 transition-all duration-150" href={mailto("Digivixo enquiry")}>
                Talk to us
              </a>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative isolate max-w-6xl mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] items-center gap-12">
        <div
          className="mk-glow absolute rounded-full bg-signal filter blur-[100px] opacity-20 pointer-events-none -z-10"
          style={{ width: 560, height: 560, top: -160, right: -140 }}
          aria-hidden
        />
        <div className="mk-hero-copy relative z-10">
          <p className="mk-eyebrow inline-flex items-center gap-2 text-signal text-xs font-semibold tracking-wider uppercase mb-5 before:content-[''] before:w-2 before:h-2 before:rounded-full before:bg-signal">
            Managed voice AI
          </p>
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-none mb-6 max-w-xl">
            {HERO_WORDS.map((word, i) => (
              <span key={i} className="mk-hero-word inline-block mr-2">
                <span className={i === ACCENT_WORD_INDEX ? "text-signal" : undefined}>
                  {word}
                </span>
              </span>
            ))}
          </h1>
          <p className="mk-lede reveal text-slate text-base sm:text-lg lg:text-xl leading-relaxed mb-8 max-w-xl">
            Digivixo answers your business line with an AI agent that handles the
            conversation, captures every booking, and shows you exactly what
            happened on every call — while you never touch a setting. We build
            and run the whole thing for you.
          </p>
          <div className="mk-hero-actions reveal flex flex-wrap gap-4">
            <a className="mk-btn mk-btn--primary mk-btn--lg inline-flex items-center gap-2 text-base font-medium px-7 py-3.5 rounded-full no-underline bg-signal border border-signal text-on-accent hover:brightness-95 transition-all duration-150 shadow-sm" href={mailto("Digivixo enquiry")}>
              Talk to us
            </a>
            <a className="mk-btn mk-btn--lg inline-flex items-center gap-2 text-base font-medium px-7 py-3.5 rounded-full no-underline bg-card border border-line text-ink hover:border-ink transition-all duration-150" href="#how">
              See how it works
            </a>
          </div>
        </div>
        <div className="mk-hero-visual relative z-10 hidden lg:flex items-center justify-center min-h-[260px]" aria-hidden>
          <div className="mk-eq flex items-center gap-2 h-48">
            {EQ_BARS.map((h, i) => (
              <span key={i} className="block w-2.5 rounded-full bg-signal origin-center" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </section>

      {/* Marquee Section */}
      <div className="mk-marquee overflow-hidden border-y border-line py-5 my-8" aria-hidden>
        <div className="mk-marquee-track inline-flex gap-12 whitespace-nowrap animate-[mk-marquee_32s_linear_infinite]">
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i} className="mk-marquee-item font-display text-xl font-semibold text-slate inline-flex items-center gap-12 after:content-[''] after:w-2 after:h-2 after:rounded-full after:bg-signal">
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Section 1: The Problem */}
      <section className="relative isolate max-w-6xl mx-auto px-6 py-12 lg:py-14 border-t border-line-soft">
        <div className="mk-section-head reveal max-w-2xl mb-8 lg:mb-10">
          <p className="mk-kicker text-signal text-xs font-semibold tracking-wider uppercase mb-2">The problem</p>
          <h2 className="mk-h2 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">A missed call is a missed customer.</h2>
          <p className="mk-section-lede text-slate text-base sm:text-lg leading-relaxed mt-4">
            Every unanswered call during business hours is a lead someone else
            gets. After hours, it&apos;s usually a lead who never calls back.
            Reception staff are expensive and don&apos;t flex when volume
            spikes — and a press-1-for-hours menu just annoys the caller.
          </p>
        </div>
        <div className="mk-grid grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <div className="mk-card reveal bg-card border border-line rounded-2xl p-6 lg:p-8 hover:-translate-y-1 transition-all duration-200 shadow-sm hover:border-signal/40" key={f.title}>
              <div className="mk-card-mark w-10 h-10 rounded-xl bg-signal/15 text-signal flex items-center justify-center mb-5">
                <Icon d={f.icon} />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2.5">{f.title}</h3>
              <p className="text-slate text-sm sm:text-base leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 2: How it works */}
      <section id="how" className="relative isolate max-w-6xl mx-auto px-6 py-12 lg:py-14 border-t border-line-soft">
        <div className="mk-section-head reveal max-w-2xl mb-8 lg:mb-10">
          <p className="mk-kicker text-signal text-xs font-semibold tracking-wider uppercase mb-2">How it works</p>
          <h2 className="mk-h2 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">Set up once. Runs itself after.</h2>
          <p className="mk-section-lede text-slate text-base sm:text-lg leading-relaxed mt-4">
            We configure the agent around your business before it takes a single
            call. From then on everything it does appears on your dashboard as
            it happens.
          </p>
        </div>
        <div className="mk-steps grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <div className="mk-step reveal border-t-2 border-signal pt-5" key={s.title}>
              <h3 className="font-display text-xl font-semibold mb-2">{s.title}</h3>
              <p className="text-slate text-sm sm:text-base leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Your Dashboard */}
      <section className="relative isolate max-w-6xl mx-auto px-6 py-12 lg:py-14 border-t border-line-soft">
        <div className="mk-section-head reveal max-w-2xl mb-8 lg:mb-10">
          <p className="mk-kicker text-signal text-xs font-semibold tracking-wider uppercase mb-2">Your dashboard</p>
          <h2 className="mk-h2 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">Built around your business, not a template.</h2>
          <p className="mk-section-lede text-slate text-base sm:text-lg leading-relaxed mt-4">
            What gets captured is configured per client. A restaurant needs
            party size and order items; an accounting firm needs the service
            requested and how urgent it is. Same platform, different clipboard.
          </p>
        </div>
        <div className="mk-preview reveal bg-card border border-line rounded-2xl overflow-hidden shadow-sm">
          <div className="mk-preview-bar flex items-center justify-between px-5 py-3 border-b border-line text-xs text-slate">
            <div className="mk-preview-dots flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-line" />
              <span className="w-2.5 h-2.5 rounded-full bg-line" />
              <span className="w-2.5 h-2.5 rounded-full bg-line" />
            </div>
            <span>Standard · Active</span>
          </div>
          <div className="mk-preview-body p-5 lg:p-6 grid gap-5">
            <div className="mk-preview-cards grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="mk-preview-card mk-preview-card--live relative border border-line rounded-xl p-4 overflow-hidden before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-0.5 before:bg-signal">
                <div className="mk-preview-value font-display text-2xl sm:text-3xl font-bold tabular-nums">128</div>
                <div className="mk-preview-label text-slate text-xs flex items-center gap-1.5 mt-1">
                  Calls received
                  <span className="dv-live-dot w-2 h-2 rounded-full bg-signal animate-pulse" aria-hidden />
                </div>
              </div>
              <div className="mk-preview-card border border-line rounded-xl p-4 overflow-hidden">
                <div className="mk-preview-value font-display text-2xl sm:text-3xl font-bold tabular-nums">31</div>
                <div className="mk-preview-label text-slate text-xs mt-1">Outbound follow-ups</div>
              </div>
              <div className="mk-preview-card border border-line rounded-xl p-4 overflow-hidden">
                <div className="mk-preview-value font-display text-2xl sm:text-3xl font-bold tabular-nums">74</div>
                <div className="mk-preview-label text-slate text-xs mt-1">Bookings secured</div>
              </div>
            </div>
            <div className="mk-preview-rows border border-line rounded-xl text-xs overflow-hidden">
              <div className="mk-preview-row mk-preview-row--head grid grid-cols-[1.4fr_0.8fr_1fr_1fr] gap-2.5 px-4 py-3 bg-paper text-slate font-medium border-b border-line-soft">
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
                <div className="mk-preview-row grid grid-cols-[1.4fr_0.8fr_1fr_1fr] gap-2.5 px-4 py-3 border-b border-line-soft last:border-b-0 tabular-nums items-center" key={r[0]}>
                  <span className="font-mono text-ink">{r[0]}</span>
                  <span className="text-slate">{r[1]}</span>
                  <span className="flex items-center gap-1.5 text-ink">
                    <span className={r[2] === "Positive" ? "w-2 h-2 rounded-full bg-signal" : "w-2 h-2 rounded-full bg-slate"} />
                    {r[2]}
                  </span>
                  <span className="text-ink font-medium">{r[3]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Real Numbers */}
      <section className="relative isolate max-w-6xl mx-auto px-6 py-12 lg:py-14 border-t border-line-soft">
        <div
          className="mk-glow absolute rounded-full bg-signal filter blur-[100px] opacity-20 pointer-events-none -z-10"
          style={{ width: 520, height: 520, top: -40, right: -180 }}
          aria-hidden
        />
        <div className="mk-section-head reveal max-w-2xl mb-8 lg:mb-10">
          <p className="mk-kicker text-signal text-xs font-semibold tracking-wider uppercase mb-2">What we&apos;ve measured</p>
          <h2 className="mk-h2 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">Real numbers, from a real deployment.</h2>
          <p className="mk-section-lede text-slate text-base sm:text-lg leading-relaxed mt-4">
            From one client, referenced anonymously with their permission, over
            a 60-day measurement period.
          </p>
        </div>
        <div className="mk-stats grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="mk-stat reveal border border-line rounded-2xl p-6 lg:p-8 bg-card">
            <div
              className="mk-stat-value font-display text-5xl sm:text-6xl font-bold text-signal tracking-tight leading-none tabular-nums"
              data-count-to="5"
              data-count-from="32"
              data-count-suffix="%"
            >
              5%
            </div>
            <div className="mk-stat-label text-slate text-sm sm:text-base leading-relaxed mt-4">
              Missed-call rate, down from 32% before the agent went live.
            </div>
          </div>
          <div className="mk-stat reveal border border-line rounded-2xl p-6 lg:p-8 bg-card">
            <div
              className="mk-stat-value font-display text-5xl sm:text-6xl font-bold text-signal tracking-tight leading-none tabular-nums"
              data-count-to="13"
              data-count-from="0"
              data-count-prefix="+"
              data-count-suffix="%"
            >
              +13%
            </div>
            <div className="mk-stat-label text-slate text-sm sm:text-base leading-relaxed mt-4">
              Revenue, attributed to calls that would previously have gone
              unanswered.
            </div>
          </div>
        </div>
        <p className="mk-caveat reveal text-slate text-xs sm:text-sm leading-relaxed max-w-2xl mt-6">
          That&apos;s one client, and we say so. We don&apos;t publish
          industry-average or projected figures — we can&apos;t show you the
          methodology behind numbers we didn&apos;t measure ourselves. As more
          clients come online this section gets more data points, not bigger
          claims.
        </p>
      </section>

      {/* Section 5: Pricing */}
      <section id="pricing" className="relative isolate max-w-6xl mx-auto px-6 py-12 lg:py-14 border-t border-line-soft">
        <div className="mk-section-head reveal max-w-2xl mb-8 lg:mb-10">
          <p className="mk-kicker text-signal text-xs font-semibold tracking-wider uppercase mb-2">Pricing</p>
          <h2 className="mk-h2 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">One monthly plan. No setup fee.</h2>
          <p className="mk-section-lede text-slate text-base sm:text-lg leading-relaxed mt-4">
            Included minutes cover the calls your agent handles; beyond that
            it&apos;s{" "}
            <strong className="text-ink font-semibold">
              ${OVERAGE_RATE_PER_MINUTE_USD} per minute
            </strong>
            , shown on your dashboard as you use it. Setup, agent configuration
            and ongoing tuning are included.
          </p>
        </div>
        <div className="mk-prices grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map((tier) => {
            const pricing = TIER_PRICING[tier.key];
            return (
              <div
                key={tier.key}
                className={`mk-price reveal bg-card border rounded-2xl p-6 lg:p-8 flex flex-col justify-between ${
                  tier.tag ? "border-signal ring-1 ring-signal shadow-sm" : "border-line"
                }`}
              >
                <div>
                  <div className="mk-price-name flex items-center justify-between font-display text-lg font-semibold mb-3">
                    {tier.name}
                    {tier.tag ? (
                      <span className="mk-price-tag text-xs font-semibold uppercase tracking-wider text-on-accent bg-signal px-2.5 py-1 rounded-full">
                        {tier.tag}
                      </span>
                    ) : null}
                  </div>
                  <div className="mk-price-amount font-display text-4xl font-bold tracking-tight leading-none mb-4 tabular-nums">
                    {currency.format(Number(pricing.monthlyPriceUsd))}
                    <span className="mk-price-period text-slate text-base font-normal font-sans"> / month</span>
                  </div>
                </div>
                <p className="mk-price-detail text-slate text-sm leading-relaxed border-t border-line-soft pt-4 mt-4">
                  <strong className="text-ink font-semibold">{number.format(pricing.minuteCap)} minutes</strong>{" "}
                  included each month.
                  <br />
                  {tier.fit}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Section 6: Straight Answers (What this is not) */}
      <section className="relative isolate max-w-6xl mx-auto px-6 py-12 lg:py-14 border-t border-line-soft">
        <div className="mk-section-head reveal max-w-2xl mb-8 lg:mb-10">
          <p className="mk-kicker text-signal text-xs font-semibold tracking-wider uppercase mb-2">Straight answers</p>
          <h2 className="mk-h2 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight">What this is not.</h2>
        </div>
        <ul className="mk-list divide-y divide-line border-y border-line max-w-3xl pl-0 list-none my-0">
          <li className="reveal text-slate text-base sm:text-lg leading-relaxed py-5 pl-8 relative before:content-['—'] before:absolute before:left-0 before:text-signal before:font-bold">
            <strong className="text-ink font-semibold">Not a tool you have to run.</strong> You never write a
            prompt, pick a voice, or configure telephony. That stays our job.
          </li>
          <li className="reveal text-slate text-base sm:text-lg leading-relaxed py-5 pl-8 relative before:content-['—'] before:absolute before:left-0 before:text-signal before:font-bold">
            <strong className="text-ink font-semibold">Not one-size-fits-all.</strong> What the agent captures is
            set up around your business at onboarding.
          </li>
          <li className="reveal text-slate text-base sm:text-lg leading-relaxed py-5 pl-8 relative before:content-['—'] before:absolute before:left-0 before:text-signal before:font-bold">
            <strong className="text-ink font-semibold">Not a payment processor.</strong> We handle calls and
            bookings. Your customer payments stay wherever they are today.
          </li>
          <li className="reveal text-slate text-base sm:text-lg leading-relaxed py-5 pl-8 relative before:content-['—'] before:absolute before:left-0 before:text-signal before:font-bold">
            <strong className="text-ink font-semibold">Not self-serve.</strong> We onboard clients personally, and
            outbound follow-up calls are enabled only after we discuss how you
            obtain consent to call your customers.
          </li>
        </ul>
      </section>

      {/* Section 7: Closing CTA */}
      <section className="relative isolate max-w-6xl mx-auto px-6 py-16 lg:py-20 text-center border-t border-line overflow-hidden">
        <div
          className="mk-glow absolute rounded-full bg-signal filter blur-[120px] opacity-20 pointer-events-none -z-10 left-1/2 -translate-x-1/2"
          style={{
            width: 640,
            height: 640,
            bottom: -260,
          }}
          aria-hidden
        />
        <h2 className="reveal font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-none mb-4">See it answer your phone.</h2>
        <p className="reveal text-slate text-base sm:text-lg leading-relaxed max-w-lg mx-auto mb-8">
          Tell us about your business and the calls you&apos;re missing. We&apos;ll
          show you what the agent would do with them.
        </p>
        <div className="reveal">
          <a
            className="mk-btn mk-btn--primary mk-btn--lg inline-flex items-center gap-2 text-base font-medium px-8 py-3.5 rounded-full no-underline bg-signal border border-signal text-on-accent hover:brightness-95 transition-all duration-150 shadow-sm"
            href={mailto("Digivixo enquiry")}
          >
            Talk to us
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-line flex flex-wrap justify-between items-center gap-4 text-slate text-xs sm:text-sm">
        <span>© {new Date().getFullYear()} Digivixo</span>
        <a className="text-slate hover:text-ink transition-colors duration-150 no-underline" href={`mailto:${SUPPORT_EMAIL}`}>
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
