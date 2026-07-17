"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, tenants } from "@/db";
import { requireAdminAction } from "@/lib/admin-guard";
import { sendPaymentLinkEmail } from "@/lib/email";
import { createCheckoutForTenant } from "@/lib/polar";
import { ensureUniqueSlug } from "@/lib/slug";

export type ActionState = { ok: boolean; error?: string };

const createTenantSchema = z.object({
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

const TIER_LABELS = {
  pilot: "Pilot",
  standard: "Standard",
  pro: "Pro",
} as const;

export async function createTenantAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Server actions are public HTTP endpoints — the guard runs here, not just
  // in the layout that renders the form.
  await requireAdminAction();

  const parsed = createTenantSchema.safeParse({
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

  // No users row is created here — a pending_payment tenant has no login,
  // and only the Polar activation webhook may create one.
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
  });

  revalidatePath("/admin");
  return { ok: true };
}

export async function sendPaymentLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminAction();

  const tenantId = z
    .string()
    .min(1)
    .max(64)
    .safeParse(formData.get("tenantId"));
  if (!tenantId.success) {
    return { ok: false, error: "Invalid tenant." };
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId.data))
    .limit(1);

  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (tenant.status !== "pending_payment") {
    return {
      ok: false,
      error: "This tenant has already paid — no link needed.",
    };
  }
  if (!tenant.selectedTier) {
    return { ok: false, error: "Tenant has no tier selected." };
  }

  let checkoutUrl: string;
  try {
    checkoutUrl = await createCheckoutForTenant(tenant);
  } catch (error) {
    console.error("[admin] Polar checkout creation failed:", error);
    return { ok: false, error: "Polar checkout creation failed — see logs." };
  }

  try {
    await sendPaymentLinkEmail({
      to: tenant.ownerEmail,
      tenantName: tenant.name,
      tierLabel: TIER_LABELS[tenant.selectedTier],
      checkoutUrl,
    });
  } catch (error) {
    console.error("[admin] payment link email failed:", error);
    return { ok: false, error: "Email send failed — see logs." };
  }

  await db
    .update(tenants)
    .set({ paymentLinkSentAt: new Date() })
    .where(eq(tenants.id, tenant.id));

  revalidatePath("/admin");
  return { ok: true };
}
