import "server-only";

import { notFound, redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";

/**
 * Page-level admin gate. Unauthenticated → the admin login. Authenticated but
 * not admin → 404, not 403: a tenant user (or anyone probing) gets no
 * confirmation that an admin panel exists at this path.
 */
export async function requireAdminPage(): Promise<Session> {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "admin") notFound();
  return session;
}

/**
 * Action-level admin gate. Every server action re-checks the session itself —
 * layout guards protect rendering, not RPC: server actions are directly
 * invokable endpoints regardless of what UI called them.
 */
export async function requireAdminAction(): Promise<Session> {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session;
}
