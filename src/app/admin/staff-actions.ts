"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db, users } from "@/db";
import { requireSuperAdminAction } from "@/lib/admin-guard";
import { isUniqueViolation } from "@/lib/db-errors";
import { sendStaffInviteEmail } from "@/lib/email";
import { generateSetPasswordToken } from "@/lib/tokens";

import type { ActionState } from "./actions";

// ---------------------------------------------------------------------------
// Staff account management — SUPER-ADMIN ONLY. Every action here uses
// requireSuperAdminAction: a staff_admin session must never be able to mint,
// re-invite, or remove staff accounts (including its own).
// ---------------------------------------------------------------------------

const emailSchema = z.string().trim().toLowerCase().email().max(256);

export async function createStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdminAction();

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const token = generateSetPasswordToken();

  // Same account model as tenant activation: the row is created with no
  // password and a hashed single-use token; only the emailed link can turn
  // it into a working login.
  try {
    await db.insert(users).values({
      tenantId: null,
      email: parsed.data,
      role: "staff_admin",
      setPasswordToken: token.tokenHash,
      setPasswordTokenExpiresAt: token.expiresAt,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "A user with that email already exists." };
    }
    throw error;
  }

  // Outside any transaction on purpose: the account must not vanish because
  // the email provider hiccuped — the token row stays valid and "Resend
  // invite" sends a fresh link.
  try {
    await sendStaffInviteEmail({ to: parsed.data, rawToken: token.rawToken });
  } catch (error) {
    console.error("[admin] staff invite email failed:", error);
    revalidatePath("/admin/staff");
    return {
      ok: false,
      error:
        "Account created, but the invite email failed — use Resend invite.",
    };
  }

  revalidatePath("/admin/staff");
  return { ok: true };
}

const staffIdSchema = z.string().min(1).max(64);

export async function resendStaffInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdminAction();

  const parsed = staffIdSchema.safeParse(formData.get("staffId"));
  if (!parsed.success) {
    return { ok: false, error: "Invalid staff account." };
  }

  const token = generateSetPasswordToken();

  // Role is part of the WHERE — this action can only ever touch staff rows,
  // never the super-admin or a tenant user.
  const updated = await db
    .update(users)
    .set({
      setPasswordToken: token.tokenHash,
      setPasswordTokenExpiresAt: token.expiresAt,
    })
    .where(and(eq(users.id, parsed.data), eq(users.role, "staff_admin")))
    .returning({ email: users.email });
  if (updated.length === 0) {
    return { ok: false, error: "Staff account not found." };
  }

  try {
    await sendStaffInviteEmail({
      to: updated[0].email,
      rawToken: token.rawToken,
    });
  } catch (error) {
    console.error("[admin] staff invite email failed:", error);
    return { ok: false, error: "Email send failed — see logs." };
  }

  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function removeStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperAdminAction();

  const parsed = staffIdSchema.safeParse(formData.get("staffId"));
  if (!parsed.success) {
    return { ok: false, error: "Invalid staff account." };
  }

  // Deleting the row is a full lockout: no users row → no login, and the
  // admin guards re-verify the row on every request, so even an unexpired
  // session JWT stops working immediately.
  const deleted = await db
    .delete(users)
    .where(and(eq(users.id, parsed.data), eq(users.role, "staff_admin")))
    .returning({ id: users.id });
  if (deleted.length === 0) {
    return { ok: false, error: "Staff account not found." };
  }

  revalidatePath("/admin/staff");
  return { ok: true };
}
