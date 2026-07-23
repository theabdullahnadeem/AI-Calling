import "server-only";

import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { db, partners, users, type Partner } from "@/db";

/**
 * Guards for the /partner panel, mirroring admin-guard.ts: sessions are
 * 7-day JWTs, so every gate re-verifies the users row (and its partner
 * scope) against the database — a removed partner account locks out
 * instantly, stale cookie or not. The partner row rides along because every
 * caller needs it anyway.
 */

async function verifyPartnerSession(
  session: Session,
): Promise<Partner | null> {
  const [row] = await db
    .select({ role: users.role, partnerId: users.partnerId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row || row.role !== "partner_admin" || !row.partnerId) return null;

  const [partner] = await db
    .select()
    .from(partners)
    .where(eq(partners.id, row.partnerId))
    .limit(1);
  return partner ?? null;
}

/**
 * Page-level gate. Unauthenticated → the shared login. Anyone else → 404,
 * same no-existence-leak stance as the admin panel.
 */
export async function requirePartnerPage(): Promise<{
  session: Session;
  partner: Partner;
}> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "partner_admin") notFound();
  const partner = await verifyPartnerSession(session);
  if (!partner) notFound();
  return { session, partner };
}

/**
 * Action-level gate — server actions are directly invokable endpoints, so
 * each one re-checks for itself, never trusting the page that rendered it.
 */
export async function requirePartnerAction(): Promise<{
  session: Session;
  partner: Partner;
}> {
  const session = await auth();
  if (!session?.user || session.user.role !== "partner_admin") {
    throw new Error("Unauthorized");
  }
  const partner = await verifyPartnerSession(session);
  if (!partner) throw new Error("Unauthorized");
  return { session, partner };
}
