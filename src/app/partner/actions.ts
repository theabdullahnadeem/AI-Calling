"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db, subscriptions, tenants } from "@/db";
import { isUniqueViolation } from "@/lib/db-errors";
import { appUrl } from "@/lib/env";
import { requirePartnerAction } from "@/lib/partner-guard";
import { createCheckoutForTenant, PolarConfigError } from "@/lib/polar";
import { ensureUniqueSlug } from "@/lib/slug";

export type ActionState = { ok: boolean; error?: string };

// ---------------------------------------------------------------------------
// Partner panel actions. EVERY query here pins tenants.partnerId to the
// session's partner — a partner can never read or touch another partner's
// (or a direct) tenant, exactly the way tenant-scoped tRPC pins tenantId.
// ---------------------------------------------------------------------------

const createClientSchema = z.object({
  name: z.string().trim().min(1).max(256),
  ownerEmail: z.string().trim().toLowerCase().email().max(256),
  businessType: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{1,64}$/, "Use snake_case, e.g. cpa_firm"),
  selectedTier: z.enum(["pilot", "standard", "pro"]),
  intakeSchema: z.string().min(2),
});

export async function createClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { partner } = await requirePartnerAction();

  const parsed = createClientSchema.safeParse({
    name: formData.get("name"),
    ownerEmail: formData.get("ownerEmail"),
    businessType: formData.get("businessType"),
    selectedTier: formData.get("selectedTier"),
    intakeSchema: formData.get("intakeSchema"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  let intakeSchemaJson: unknown;
  try {
    intakeSchemaJson = JSON.parse(parsed.data.intakeSchema);
  } catch {
    return { ok: false, error: "Intake schema is not valid JSON." };
  }
  if (
    typeof intakeSchemaJson !== "object" ||
    intakeSchemaJson === null ||
    Array.isArray(intakeSchemaJson)
  ) {
    return { ok: false, error: "Intake schema must be a JSON object." };
  }

  const slug = await ensureUniqueSlug(parsed.data.name);

  // Same invariants as admin tenant creation: pending_payment, no users row,
  // outbound OFF (compliance stays with the platform, not the partner).
  // Retell agent mapping is also ours — done from /admin after creation.
  try {
    await db.insert(tenants).values({
      id: randomUUID(),
      slug,
      name: parsed.data.name,
      ownerEmail: parsed.data.ownerEmail,
      businessType: parsed.data.businessType,
      intakeSchema: intakeSchemaJson,
      status: "pending_payment",
      selectedTier: parsed.data.selectedTier,
      polarCustomerReference: `dvx_${randomUUID()}`,
      partnerId: partner.id,
      retellAgentId: null,
      outboundCallingEnabled: false,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "Something collided — try again." };
    }
    throw error;
  }

  revalidatePath("/partner");
  return { ok: true };
}

const tenantIdSchema = z.string().min(1).max(64);

/**
 * Pay-to-activate: creates the Polar checkout with the PARTNER as payer and
 * redirects the partner's browser straight to it. Activation then flows
 * through the same webhook as every other tenant — the no-activation-
 * without-payment invariant is untouched.
 */
export async function payForClientAction(formData: FormData): Promise<void> {
  const { partner } = await requirePartnerAction();

  const parsed = tenantIdSchema.safeParse(formData.get("tenantId"));
  if (!parsed.success) redirect("/partner?error=invalid");

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(
      and(eq(tenants.id, parsed.data), eq(tenants.partnerId, partner.id)),
    )
    .limit(1);
  if (!tenant) redirect("/partner?error=notfound");
  if (tenant.status !== "pending_payment") redirect("/partner?error=paid");

  let checkoutUrl: string;
  try {
    checkoutUrl = await createCheckoutForTenant(tenant, {
      payerEmail: partner.billingEmail,
      successUrl: `${appUrl()}/partner?paid=1`,
    });
  } catch (error) {
    console.error("[partner] checkout creation failed:", error);
    // Config details are for OUR admins, not partners — generic message.
    redirect(
      `/partner?error=${error instanceof PolarConfigError ? "config" : "checkout"}`,
    );
  }

  redirect(checkoutUrl);
}

/**
 * A payment_overdue client: send the partner to Polar's hosted customer
 * portal (their customer — card update + retry live there). The portal
 * session is minted on click because the links are short-lived.
 */
export async function resolvePaymentAction(formData: FormData): Promise<void> {
  const { partner } = await requirePartnerAction();

  const parsed = tenantIdSchema.safeParse(formData.get("tenantId"));
  if (!parsed.success) redirect("/partner?error=invalid");

  const [row] = await db
    .select({ sub: subscriptions })
    .from(subscriptions)
    .innerJoin(tenants, eq(subscriptions.tenantId, tenants.id))
    .where(
      and(eq(tenants.id, parsed.data), eq(tenants.partnerId, partner.id)),
    )
    .limit(1);
  if (!row?.sub.polarCustomerId) redirect("/partner?error=notfound");

  let portalUrl: string;
  try {
    const { polarClient } = await import("@/lib/polar");
    const session = await polarClient().customerSessions.create({
      customerId: row.sub.polarCustomerId,
    });
    portalUrl = session.customerPortalUrl;
  } catch (error) {
    console.error("[partner] portal session failed:", error);
    redirect("/partner?error=portal");
  }

  redirect(portalUrl);
}
