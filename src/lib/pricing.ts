/**
 * Tier pricing. These MUST match the products configured in Polar — the
 * numbers here are what get written onto each subscription row at activation
 * and drive the dashboard's usage bar.
 *
 * NOTE: these supersede the figures in docs/03-product-overview.md and
 * docs/02-manual-admin-steps.md (which document the earlier
 * $800/$1,500/$2,200 · 2,940/5,514/8,088 tiers). The docs are the original
 * spec and were left untouched by design; this file is the live source of
 * truth.
 *
 * Margin check at $0.155/min Retell cost and Polar's 5% + $0.50 fee — every
 * tier clears the 40% net margin floor with room to spare:
 *
 *   Pilot     $1,000 → net $949.50  − 3,000×$0.155 ($465.00)   = $484.50 (51%)
 *   Standard  $1,700 → net $1,614.50 − 5,600×$0.155 ($868.00)  = $746.50 (46%)
 *   Pro       $2,500 → net $2,374.50 − 8,150×$0.155 ($1,263.25) = $1,111.25 (47%)
 *
 * If the Retell rate or Polar's fee structure changes, recompute the caps:
 * maxMinutes = (price − (price × 0.05 + 0.50)) × 0.60 ÷ costPerMinute.
 */
export const TIER_PRICING = {
  pilot: { monthlyPriceUsd: "1000.00", minuteCap: 3000 },
  standard: { monthlyPriceUsd: "1700.00", minuteCap: 5600 },
  pro: { monthlyPriceUsd: "2500.00", minuteCap: 8150 },
} as const;

export type Tier = keyof typeof TIER_PRICING;

/**
 * Display/reference value only. The rate that actually bills is configured
 * on Polar's metered price for the call_minutes meter — Polar applies it
 * automatically once a cycle's credits are exhausted; our app never
 * calculates overage charges.
 */
export const OVERAGE_RATE_PER_MINUTE_USD = "0.27";
