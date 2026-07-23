import "server-only";

import { Polar } from "@polar-sh/sdk";

import type { Tenant } from "@/db/schema";
import { appUrl, serverEnv } from "./env";

export function polarClient(): Polar {
  return new Polar({
    accessToken: serverEnv("POLAR_ACCESS_TOKEN"),
    server:
      serverEnv("POLAR_ENVIRONMENT") === "production"
        ? "production"
        : "sandbox",
  });
}

const TIER_PRODUCT_ENV = {
  pilot: "POLAR_PRODUCT_ID_PILOT",
  standard: "POLAR_PRODUCT_ID_STANDARD",
  pro: "POLAR_PRODUCT_ID_PRO",
} as const;

/**
 * Thrown for misconfiguration the admin can actually fix (as opposed to a
 * transient API failure). The admin panel surfaces the message verbatim, so
 * keep these worded as instructions.
 */
export class PolarConfigError extends Error {}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Creates a Polar hosted-checkout session for the tenant's selected tier.
 *
 * Direct tenants: polarCustomerReference travels on BOTH channels Polar
 * echoes back in webhooks — checkout metadata and the customer's externalId —
 * so the activation handler can match the payment to the exact tenant row
 * without relying on email matching alone.
 *
 * Partner-paid tenants (white-label v1): the PARTNER is the payer, at the
 * same retail tier prices. Their billing email becomes the customer, and
 * externalCustomerId is deliberately OMITTED — it maps 1:1 to a Polar
 * customer, and one partner pays for many tenants. Matching rides solely on
 * checkout metadata (which Polar copies onto the order and subscription);
 * after activation every event matches by the stored polarSubscriptionId.
 */
export async function createCheckoutForTenant(
  tenant: Tenant,
  options?: {
    /** Set for partner-paid checkouts: the partner's billing email. */
    payerEmail?: string;
    /** Where Polar returns the payer after success (default /checkout/success). */
    successUrl?: string;
  },
): Promise<string> {
  if (!tenant.selectedTier) {
    throw new Error(`Tenant ${tenant.id} has no selectedTier`);
  }
  if (!tenant.polarCustomerReference) {
    throw new Error(`Tenant ${tenant.id} has no polarCustomerReference`);
  }

  // Catch the classic "the .env.example placeholder is still in there" case
  // before calling Polar, so the admin sees what to fix instead of a 422
  // buried in the server logs.
  const productEnvKey = TIER_PRODUCT_ENV[tenant.selectedTier];
  const productId = serverEnv(productEnvKey);
  if (!UUID_PATTERN.test(productId)) {
    throw new PolarConfigError(
      `${productEnvKey} is not a Polar product ID (currently "${productId}"). Copy the product's UUID from the Polar dashboard into this environment variable, then redeploy.`,
    );
  }

  const checkout = await polarClient().checkouts.create({
    products: [productId],
    customerEmail: options?.payerEmail ?? tenant.ownerEmail,
    ...(options?.payerEmail
      ? {}
      : { externalCustomerId: tenant.polarCustomerReference }),
    metadata: {
      polarCustomerReference: tenant.polarCustomerReference,
    },
    successUrl: options?.successUrl ?? `${appUrl()}/checkout/success`,
  });

  return checkout.url;
}
