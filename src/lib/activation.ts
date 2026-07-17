import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { subscriptions, tenants, users } from "@/db/schema";
import { sendSetPasswordEmail } from "./email";
import { OVERAGE_RATE_PER_MINUTE_USD, TIER_PRICING } from "./pricing";
import { generateSetPasswordToken } from "./tokens";

export type ActivationInput = {
  /** Matched against tenants.polarCustomerReference (from checkout metadata or customer.externalId). */
  polarCustomerReference: string;
  polarCustomerId: string | null;
  polarSubscriptionId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
};

export type ActivationResult =
  | { outcome: "activated"; tenantId: string }
  | { outcome: "already_active"; tenantId: string }
  | { outcome: "tenant_not_found" };

/**
 * THE single code path allowed to flip tenants.status to 'active' — called
 * only from the Polar webhook handler after signature verification. Prompt 6
 * reuses this same function rather than reimplementing activation.
 *
 * Idempotent per tenant by construction: the tenant row is locked
 * (SELECT ... FOR UPDATE) and the status checked inside one transaction, so
 * a retried or concurrent duplicate webhook sees 'active' and no-ops —
 * no second users row, no second set-password email, ever.
 */
export async function activateTenantFromPayment(
  input: ActivationInput,
): Promise<ActivationResult> {
  const token = generateSetPasswordToken();

  const result = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .select()
      .from(tenants)
      .where(eq(tenants.polarCustomerReference, input.polarCustomerReference))
      .limit(1)
      .for("update");

    if (!tenant) {
      return { outcome: "tenant_not_found" as const };
    }

    if (tenant.status !== "pending_payment") {
      // Renewal payment or duplicate delivery — activation already happened.
      return { outcome: "already_active" as const, tenantId: tenant.id };
    }

    if (!tenant.selectedTier) {
      // Data integrity violation: a payment link should never exist for a
      // tenant without a tier. Throw so the webhook 500s and Polar retries
      // after the row is fixed, instead of silently activating with no plan.
      throw new Error(
        `Tenant ${tenant.id} paid but has no selectedTier — cannot activate`,
      );
    }

    const pricing = TIER_PRICING[tenant.selectedTier];
    const now = new Date();

    await tx
      .update(tenants)
      .set({ status: "active" })
      .where(eq(tenants.id, tenant.id));

    await tx
      .insert(subscriptions)
      .values({
        tenantId: tenant.id,
        tier: tenant.selectedTier,
        monthlyPriceUsd: pricing.monthlyPriceUsd,
        minuteCap: pricing.minuteCap,
        overageRatePerMinuteUsd: OVERAGE_RATE_PER_MINUTE_USD,
        minutesUsedThisCycle: 0,
        polarCustomerId: input.polarCustomerId,
        polarSubscriptionId: input.polarSubscriptionId,
        status: "active",
        currentPeriodStart: input.currentPeriodStart ?? now,
        currentPeriodEnd:
          input.currentPeriodEnd ??
          new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      })
      // subscriptions.tenantId is unique — a lost race still can't double-insert.
      .onConflictDoNothing({ target: subscriptions.tenantId });

    const insertedUsers = await tx
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: tenant.ownerEmail.toLowerCase(),
        role: "tenant_owner",
        // Only the SHA-256 digest is persisted; the raw token lives solely in
        // the email link.
        setPasswordToken: token.tokenHash,
        setPasswordTokenExpiresAt: token.expiresAt,
      })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });

    return {
      outcome: "activated" as const,
      tenantId: tenant.id,
      tenantName: tenant.name,
      ownerEmail: tenant.ownerEmail,
      // If the email already had a users row (shouldn't happen — flagged so
      // it's visible), the token we generated was NOT stored; sending the
      // link would produce a dead URL.
      userCreated: insertedUsers.length > 0,
    };
  });

  if (result.outcome !== "activated") {
    return result;
  }

  if (!result.userCreated) {
    console.error(
      `[activation] tenant ${result.tenantId} activated but a users row already existed for its owner email — set-password email NOT sent`,
    );
    return { outcome: "activated", tenantId: result.tenantId };
  }

  // Outside the transaction on purpose: activation must not roll back because
  // the email provider hiccuped. On failure the token row is still valid; the
  // admin can trigger a fresh email later.
  try {
    await sendSetPasswordEmail({
      to: result.ownerEmail,
      tenantName: result.tenantName,
      rawToken: token.rawToken,
    });
  } catch (error) {
    console.error(
      `[activation] set-password email failed for tenant ${result.tenantId}:`,
      error,
    );
  }

  return { outcome: "activated", tenantId: result.tenantId };
}
