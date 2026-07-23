"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db, partners, users } from "@/db";
import { requireAdminAction } from "@/lib/admin-guard";
import { isUniqueViolation } from "@/lib/db-errors";
import { sendStaffInviteEmail } from "@/lib/email";
import { putPartnerLogoObject } from "@/lib/r2";
import { generateSetPasswordToken } from "@/lib/tokens";

import type { ActionState } from "./actions";

// ---------------------------------------------------------------------------
// White-label partner management. Staff admins CAN manage partners — the
// staff boundary hides dollar amounts and invoices only, and nothing here is
// either. (Partner-side money lives in Polar, not this panel.)
// ---------------------------------------------------------------------------

const partnerSchema = z.object({
  name: z.string().trim().min(1).max(256),
  supportEmail: z.string().trim().toLowerCase().email().max(256),
  billingEmail: z.string().trim().toLowerCase().email().max(256),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color, e.g. #1F6F5C")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export async function createPartnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminAction();

  const parsed = partnerSchema.safeParse({
    name: formData.get("name"),
    supportEmail: formData.get("supportEmail"),
    billingEmail: formData.get("billingEmail"),
    accentColor: formData.get("accentColor") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  await db.insert(partners).values({
    id: randomUUID(),
    name: parsed.data.name,
    supportEmail: parsed.data.supportEmail,
    billingEmail: parsed.data.billingEmail,
    accentColor: parsed.data.accentColor,
  });

  revalidatePath("/admin/partners");
  return { ok: true };
}

const partnerIdSchema = z.string().min(1).max(64);

export async function updatePartnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminAction();

  const partnerId = partnerIdSchema.safeParse(formData.get("partnerId"));
  const parsed = partnerSchema.safeParse({
    name: formData.get("name"),
    supportEmail: formData.get("supportEmail"),
    billingEmail: formData.get("billingEmail"),
    accentColor: formData.get("accentColor") ?? "",
  });
  if (!partnerId.success || !parsed.success) {
    return {
      ok: false,
      error: parsed.success
        ? "Invalid partner."
        : (parsed.error.issues[0]?.message ?? "Invalid input."),
    };
  }

  const updated = await db
    .update(partners)
    .set({
      name: parsed.data.name,
      supportEmail: parsed.data.supportEmail,
      billingEmail: parsed.data.billingEmail,
      accentColor: parsed.data.accentColor,
    })
    .where(eq(partners.id, partnerId.data))
    .returning({ id: partners.id });
  if (updated.length === 0) {
    return { ok: false, error: "Partner not found." };
  }

  revalidatePath(`/admin/partners/${partnerId.data}`);
  revalidatePath("/admin/partners");
  return { ok: true };
}

// Small and format-checked: logos render in an <img> from a presigned URL,
// so content sniffing risks are minimal — but only image types are accepted.
const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export async function uploadPartnerLogoAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminAction();

  const partnerId = partnerIdSchema.safeParse(formData.get("partnerId"));
  if (!partnerId.success) {
    return { ok: false, error: "Invalid partner." };
  }
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a logo file first." };
  }
  const extension = LOGO_TYPES[file.type];
  if (!extension) {
    return { ok: false, error: "Logo must be PNG, JPEG, WebP, or SVG." };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: "Logo must be under 2 MB." };
  }

  // Content-addressed-ish key: a re-upload gets a fresh key so cached
  // presigned URLs from the old logo can't linger past their expiry window.
  const objectKey = `partners/${partnerId.data}/logo-${Date.now()}.${extension}`;
  await putPartnerLogoObject({
    objectKey,
    body: new Uint8Array(await file.arrayBuffer()),
    contentType: file.type,
  });

  const updated = await db
    .update(partners)
    .set({ logoKey: objectKey })
    .where(eq(partners.id, partnerId.data))
    .returning({ id: partners.id });
  if (updated.length === 0) {
    return { ok: false, error: "Partner not found." };
  }

  revalidatePath(`/admin/partners/${partnerId.data}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Partner admin accounts — same invite machinery as staff accounts: row with
// no password + single-use hashed set-password token, emailed link.
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  partnerId: partnerIdSchema,
  email: z.string().trim().toLowerCase().email().max(256),
});

export async function invitePartnerAdminAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminAction();

  const parsed = inviteSchema.safeParse({
    partnerId: formData.get("partnerId"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.id, parsed.data.partnerId))
    .limit(1);
  if (!partner) return { ok: false, error: "Partner not found." };

  const token = generateSetPasswordToken();
  try {
    await db.insert(users).values({
      tenantId: null,
      partnerId: partner.id,
      email: parsed.data.email,
      role: "partner_admin",
      setPasswordToken: token.tokenHash,
      setPasswordTokenExpiresAt: token.expiresAt,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "A user with that email already exists." };
    }
    throw error;
  }

  try {
    await sendStaffInviteEmail({
      to: parsed.data.email,
      rawToken: token.rawToken,
      brandName: partner.name,
    });
  } catch (error) {
    console.error("[admin] partner invite email failed:", error);
    revalidatePath(`/admin/partners/${partner.id}`);
    return {
      ok: false,
      error:
        "Account created, but the invite email failed — use Resend invite.",
    };
  }

  revalidatePath(`/admin/partners/${partner.id}`);
  return { ok: true };
}

const partnerUserSchema = z.object({
  partnerId: partnerIdSchema,
  userId: z.string().min(1).max(64),
});

export async function resendPartnerInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminAction();

  const parsed = partnerUserSchema.safeParse({
    partnerId: formData.get("partnerId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid account." };

  const [partner] = await db
    .select({ id: partners.id, name: partners.name })
    .from(partners)
    .where(eq(partners.id, parsed.data.partnerId))
    .limit(1);
  if (!partner) return { ok: false, error: "Partner not found." };

  const token = generateSetPasswordToken();
  // Role AND partner scope in the WHERE — this can only ever touch this
  // partner's own admin accounts.
  const updated = await db
    .update(users)
    .set({
      setPasswordToken: token.tokenHash,
      setPasswordTokenExpiresAt: token.expiresAt,
    })
    .where(
      and(
        eq(users.id, parsed.data.userId),
        eq(users.role, "partner_admin"),
        eq(users.partnerId, partner.id),
      ),
    )
    .returning({ email: users.email });
  if (updated.length === 0) {
    return { ok: false, error: "Account not found." };
  }

  try {
    await sendStaffInviteEmail({
      to: updated[0].email,
      rawToken: token.rawToken,
      brandName: partner.name,
    });
  } catch (error) {
    console.error("[admin] partner invite email failed:", error);
    return { ok: false, error: "Email send failed — see logs." };
  }

  revalidatePath(`/admin/partners/${partner.id}`);
  return { ok: true };
}

export async function removePartnerAdminAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminAction();

  const parsed = partnerUserSchema.safeParse({
    partnerId: formData.get("partnerId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid account." };

  // Deletion is a full lockout — the partner guard re-verifies the users row
  // on every request, so even an unexpired session JWT stops working.
  const deleted = await db
    .delete(users)
    .where(
      and(
        eq(users.id, parsed.data.userId),
        eq(users.role, "partner_admin"),
        eq(users.partnerId, parsed.data.partnerId),
      ),
    )
    .returning({ id: users.id });
  if (deleted.length === 0) {
    return { ok: false, error: "Account not found." };
  }

  revalidatePath(`/admin/partners/${parsed.data.partnerId}`);
  return { ok: true };
}
