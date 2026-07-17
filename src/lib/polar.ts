import "server-only";

import { Polar } from "@polar-sh/sdk";

import type { Tenant } from "@/db/schema";
import { serverEnv } from "./env";

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
 * Creates a Polar hosted-checkout session for the tenant's selected tier.
 *
 * polarCustomerReference travels on BOTH channels Polar echoes back in
 * webhooks — checkout metadata and the customer's externalId — so the
 * activation handler can match the payment to the exact tenant row without
 * relying on email matching alone.
 */
export async function createCheckoutForTenant(tenant: Tenant): Promise<string> {
  if (!tenant.selectedTier) {
    throw new Error(`Tenant ${tenant.id} has no selectedTier`);
  }
  if (!tenant.polarCustomerReference) {
    throw new Error(`Tenant ${tenant.id} has no polarCustomerReference`);
  }

  const checkout = await polarClient().checkouts.create({
    products: [serverEnv(TIER_PRODUCT_ENV[tenant.selectedTier])],
    customerEmail: tenant.ownerEmail,
    externalCustomerId: tenant.polarCustomerReference,
    metadata: {
      polarCustomerReference: tenant.polarCustomerReference,
    },
    successUrl: `${serverEnv("APP_URL")}/checkout/success`,
  });

  return checkout.url;
}
