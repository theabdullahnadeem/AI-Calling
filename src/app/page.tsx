import type { Metadata } from "next";

import { HomeContent } from "./home-content";

export const metadata: Metadata = {
  title: "Digivixo — an AI receptionist that answers every call",
  description:
    "A managed AI voice agent that answers your business line, captures booking and intake details, and shows you exactly what happened on every call. Setup and tuning included.",
};

/**
 * Marketing homepage. This server component owns metadata; the visual/animated
 * content lives in HomeContent (a client component) so it can run GSAP.
 *
 * Content honours docs/03 §5: the only figures published are the one verified
 * client's measured results (32%→5% missed calls, +13% revenue), stated as one
 * client — no projected or industry-average numbers, no invented testimonials.
 * Pricing renders from TIER_PRICING (the same constant billing uses) so the
 * page can never advertise a number the system doesn't charge.
 */
export default function HomePage() {
  return <HomeContent />;
}
