/**
 * Pure URL-authorization logic for the edge middleware — kept free of any
 * framework/database imports so the cross-tenant rejection behavior is
 * directly unit-testable (see org-access.test.ts, the Prompt 2 required test).
 *
 * This is the FAST check (JWT claims vs URL). It is defense-in-depth, not the
 * authority: the /org layout re-verifies against the database, and every
 * tenant-scoped tRPC procedure derives the tenant from the session server-side.
 * The URL slug is routing convenience, never an authorization input.
 */

export type SessionInfo = {
  role: "tenant_owner" | "admin" | "staff_admin";
  tenantSlug: string | null;
} | null;

export type AccessDecision =
  | "allow"
  | "login" // unauthenticated → tenant login
  | "admin-login" // unauthenticated → admin login
  | "forbidden" // authenticated, wrong tenant → 403, no slug-existence leak
  | "not-found"; // authenticated non-admin probing /admin → 404, panel stays hidden

export function evaluateOrgAccess(
  session: SessionInfo,
  pathname: string,
): AccessDecision {
  // Admin login page must stay reachable to log in at all.
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return "allow";
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!session) return "admin-login";
    // The super-admin sees everything, including /admin/staff.
    if (session.role === "admin") return "allow";
    // Staff admins run day-to-day onboarding but never staff management —
    // for them /admin/staff 404s exactly like the panel does for outsiders.
    if (session.role === "staff_admin") {
      const isStaffMgmt =
        pathname === "/admin/staff" || pathname.startsWith("/admin/staff/");
      return isStaffMgmt ? "not-found" : "allow";
    }
    // Non-admins get a 404, not a 403 — no confirmation the panel exists.
    return "not-found";
  }

  if (pathname === "/org" || pathname.startsWith("/org/")) {
    const slug = pathname.split("/")[2] ?? "";
    if (!session) return "login";
    if (!slug) return "login";
    // Admins manage tenants in /admin; they don't browse tenant dashboards.
    if (session.role !== "tenant_owner") return "forbidden";
    // The hard rule this file exists for: a session may only ever reach ITS
    // OWN slug. Any mismatch is 403 — never a redirect, never a hint whether
    // the requested slug exists.
    if (!session.tenantSlug || session.tenantSlug !== slug) return "forbidden";
    return "allow";
  }

  return "allow";
}
