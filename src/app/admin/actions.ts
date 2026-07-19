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
  // Optional at creation — the Retell agent is usually configured after
  // payment (docs/02 §9); the per-row action below sets it later.
  retellAgentId: z
    .string()
    .trim()
    .max(128)
    .optional()
    .transform((v) => (v ? v : null)),
  // Prompt 8 item 2: how this tenant states they obtain calling consent —
  // captured at onboarding, free text, creates a documented record.
  consentBasis: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v ? v : null)),
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
    retellAgentId: formData.get("retellAgentId") ?? undefined,
    consentBasis: formData.get("consentBasis") ?? undefined,
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
      retellAgentId: parsed.data.retellAgentId,
      consentBasis: parsed.data.consentBasis,
      // Prompt 8: outbound calling is NEVER enabled at creation — it requires
      // the explicit compliance conversation, then the toggle on the manage
      // page.
      outboundCallingEnabled: false,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: "That Retell agent ID is already mapped to another tenant.",
      };
    }
    throw error;
  }

  revalidatePath("/admin");
  return { ok: true };
}

/** Postgres unique_violation (SQLSTATE 23505), surfaced through the driver. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

const setAgentIdSchema = z.object({
  tenantId: z.string().min(1).max(64),
  retellAgentId: z
    .string()
    .trim()
    .max(128)
    .transform((v) => (v ? v : null)),
});

export async function setRetellAgentIdAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminAction();

  const parsed = setAgentIdSchema.safeParse({
    tenantId: formData.get("tenantId"),
    retellAgentId: formData.get("retellAgentId") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid agent ID." };
  }

  try {
    const updated = await db
      .update(tenants)
      .set({ retellAgentId: parsed.data.retellAgentId })
      .where(eq(tenants.id, parsed.data.tenantId))
      .returning({ id: tenants.id });
    if (updated.length === 0) {
      return { ok: false, error: "Tenant not found." };
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: "That Retell agent ID is already mapped to another tenant.",
      };
    }
    throw error;
  }

  revalidatePath("/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Prompt 8 — compliance controls (outbound opt-in, consent basis, suppression)
// ---------------------------------------------------------------------------

const complianceSchema = z.object({
  tenantId: z.string().min(1).max(64),
  outboundCallingEnabled: z.literal("on").nullable(),
  consentBasis: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v ? v : null)),
});

export async function updateComplianceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminAction();

  const parsed = complianceSchema.safeParse({
    tenantId: formData.get("tenantId"),
    outboundCallingEnabled: formData.get("outboundCallingEnabled") ?? null,
    consentBasis: formData.get("consentBasis") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const enableOutbound = parsed.data.outboundCallingEnabled === "on";
  // Guard rail: outbound cannot be switched on for a tenant with no recorded
  // consent basis — the compliance conversation has to have happened first
  // (docs/04 §3).
  if (enableOutbound && !parsed.data.consentBasis) {
    return {
      ok: false,
      error:
        "Record the tenant's consent basis before enabling outbound calling.",
    };
  }

  const updated = await db
    .update(tenants)
    .set({
      outboundCallingEnabled: enableOutbound,
      consentBasis: parsed.data.consentBasis,
    })
    .where(eq(tenants.id, parsed.data.tenantId))
    .returning({ id: tenants.id });
  if (updated.length === 0) {
    return { ok: false, error: "Tenant not found." };
  }

  revalidatePath(`/admin/tenants/${parsed.data.tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}

const suppressNumberSchema = z.object({
  tenantId: z.string().min(1).max(64),
  phoneNumber: z.string().trim().min(7).max(32),
});

export async function addSuppressedNumberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminAction();

  const parsed = suppressNumberSchema.safeParse({
    tenantId: formData.get("tenantId"),
    phoneNumber: formData.get("phoneNumber"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid phone number." };
  }

  const { normalizePhoneNumber } = await import("@/lib/phone");
  const normalized = normalizePhoneNumber(parsed.data.phoneNumber);
  if (!normalized) {
    return {
      ok: false,
      error: "Couldn't parse that as a phone number — use digits with country code.",
    };
  }

  const { suppressedNumbers } = await import("@/db");
  await db
    .insert(suppressedNumbers)
    .values({ tenantId: parsed.data.tenantId, phoneNumber: normalized })
    .onConflictDoNothing();

  revalidatePath(`/admin/tenants/${parsed.data.tenantId}`);
  return { ok: true };
}

export async function removeSuppressedNumberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminAction();

  const id = z.string().min(1).max(64).safeParse(formData.get("id"));
  const tenantId = z.string().min(1).max(64).safeParse(formData.get("tenantId"));
  if (!id.success || !tenantId.success) {
    return { ok: false, error: "Invalid entry." };
  }

  const { suppressedNumbers } = await import("@/db");
  const { and } = await import("drizzle-orm");
  await db
    .delete(suppressedNumbers)
    .where(
      and(
        eq(suppressedNumbers.id, id.data),
        eq(suppressedNumbers.tenantId, tenantId.data),
      ),
    );

  revalidatePath(`/admin/tenants/${tenantId.data}`);
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
