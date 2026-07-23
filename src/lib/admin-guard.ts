import "server-only";

import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { db, users } from "@/db";

type AdminRole = "admin" | "staff_admin";

/**
 * Sessions are JWTs, so a deleted staff account would otherwise keep a
 * working cookie for up to 7 days. Every admin gate therefore re-verifies
 * the users row and authorizes on the CURRENT database role, not the JWT
 * claim — removing a staff account locks the panel instantly.
 */
async function currentDbRole(session: Session): Promise<AdminRole | null> {
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!row) return null;
  return row.role === "admin" || row.role === "staff_admin" ? row.role : null;
}

function isAdminSide(role: string): role is AdminRole {
  return role === "admin" || role === "staff_admin";
}

/**
 * Page-level admin gate: super-admin AND staff_admin. Unauthenticated → the
 * admin login. Anyone else → 404, not 403: a tenant user (or anyone probing)
 * gets no confirmation that an admin panel exists at this path.
 */
export async function requireAdminPage(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (!isAdminSide(session.user.role)) notFound();
  const dbRole = await currentDbRole(session);
  if (!dbRole) notFound();
  // Trust the database over a possibly-stale JWT claim — callers branch on
  // this role for what they render (e.g. pricing is super-admin-only).
  session.user.role = dbRole;
  return session;
}

/**
 * Page-level SUPER-ADMIN gate (staff management, anything money-related).
 * A staff_admin probing gets the same 404 an outsider would.
 */
export async function requireSuperAdminPage(): Promise<Session> {
  const session = await requireAdminPage();
  if (session.user.role !== "admin") notFound();
  return session;
}

/**
 * Action-level admin gate (both admin-side roles). Every server action
 * re-checks the session itself — layout guards protect rendering, not RPC:
 * server actions are directly invokable endpoints regardless of what UI
 * called them.
 */
export async function requireAdminAction(): Promise<Session> {
  const session = await auth();
  if (!session?.user || !isAdminSide(session.user.role)) {
    throw new Error("Unauthorized");
  }
  const dbRole = await currentDbRole(session);
  if (!dbRole) throw new Error("Unauthorized");
  session.user.role = dbRole;
  return session;
}

/** Action-level SUPER-ADMIN gate — staff management actions only. */
export async function requireSuperAdminAction(): Promise<Session> {
  const session = await requireAdminAction();
  if (session.user.role !== "admin") throw new Error("Unauthorized");
  return session;
}
