/**
 * Tier pricing per the product overview doc. The minute caps are DERIVED
 * numbers — (price − Polar 5% + $0.50 fee) × 40% margin floor ÷ $0.155/min
 * Retell cost — not arbitrary constants. If the Retell rate or Polar's fee
 * structure changes, these must be recalculated (docs/02, section 10).
 */
export const TIER_PRICING = {
  pilot: { monthlyPriceUsd: "800.00", minuteCap: 2940 },
  standard: { monthlyPriceUsd: "1500.00", minuteCap: 5514 },
  pro: { monthlyPriceUsd: "2200.00", minuteCap: 8088 },
} as const;

export type Tier = keyof typeof TIER_PRICING;

/**
 * Display/reference value only. The rate that actually bills is configured
 * on Polar's metered price for the call_minutes meter — Polar applies it
 * automatically once a cycle's credits are exhausted; our app never
 * calculates overage charges.
 */
export const OVERAGE_RATE_PER_MINUTE_USD = "0.27";
