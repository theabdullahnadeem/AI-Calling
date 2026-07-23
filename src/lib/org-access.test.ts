import { describe, expect, it } from "vitest";

import { evaluateOrgAccess, type SessionInfo } from "./org-access";

const tenantB: SessionInfo = { role: "tenant_owner", tenantSlug: "tenant-b" };
const admin: SessionInfo = { role: "admin", tenantSlug: null };
const staff: SessionInfo = { role: "staff_admin", tenantSlug: null };
const partner: SessionInfo = { role: "partner_admin", tenantSlug: null };

describe("evaluateOrgAccess — /org tenant scoping", () => {
  // The Prompt 2 required test: authenticated as tenant-b, requesting
  // tenant-a's dashboard → rejected with 403 (not redirected).
  it("rejects a tenant-b user requesting /org/tenant-a/dashboard", () => {
    expect(evaluateOrgAccess(tenantB, "/org/tenant-a/dashboard")).toBe(
      "forbidden",
    );
  });

  it("gives the same 403 whether or not the requested slug exists", () => {
    // Both a real other tenant and a nonsense slug produce the identical
    // decision — no existence oracle.
    expect(evaluateOrgAccess(tenantB, "/org/tenant-a/dashboard")).toBe(
      evaluateOrgAccess(tenantB, "/org/no-such-tenant-xyz/dashboard"),
    );
  });

  it("allows a tenant into its own dashboard", () => {
    expect(evaluateOrgAccess(tenantB, "/org/tenant-b/dashboard")).toBe(
      "allow",
    );
  });

  it("rejects nested paths under another tenant's slug", () => {
    expect(
      evaluateOrgAccess(tenantB, "/org/tenant-a/dashboard/calls/123"),
    ).toBe("forbidden");
  });

  it("sends unauthenticated visitors to login", () => {
    expect(evaluateOrgAccess(null, "/org/tenant-a/dashboard")).toBe("login");
  });

  it("rejects an admin browsing tenant dashboards", () => {
    expect(evaluateOrgAccess(admin, "/org/tenant-a/dashboard")).toBe(
      "forbidden",
    );
  });

  it("rejects a staff admin browsing tenant dashboards", () => {
    expect(evaluateOrgAccess(staff, "/org/tenant-a/dashboard")).toBe(
      "forbidden",
    );
  });

  it("rejects a session with no slug claim", () => {
    const broken: SessionInfo = { role: "tenant_owner", tenantSlug: null };
    expect(evaluateOrgAccess(broken, "/org/tenant-a/dashboard")).toBe(
      "forbidden",
    );
  });
});

describe("evaluateOrgAccess — /admin", () => {
  it("404s a tenant user probing /admin (no panel-existence leak)", () => {
    expect(evaluateOrgAccess(tenantB, "/admin")).toBe("not-found");
  });

  it("sends unauthenticated visitors to the admin login", () => {
    expect(evaluateOrgAccess(null, "/admin")).toBe("admin-login");
  });

  it("keeps /admin/login reachable when logged out", () => {
    expect(evaluateOrgAccess(null, "/admin/login")).toBe("allow");
  });

  it("allows the admin in", () => {
    expect(evaluateOrgAccess(admin, "/admin")).toBe("allow");
  });

  it("allows the admin into staff management", () => {
    expect(evaluateOrgAccess(admin, "/admin/staff")).toBe("allow");
  });
});

describe("evaluateOrgAccess — /partner", () => {
  it("allows a partner admin into the partner panel", () => {
    expect(evaluateOrgAccess(partner, "/partner")).toBe("allow");
    expect(evaluateOrgAccess(partner, "/partner/clients/abc")).toBe("allow");
  });

  it("sends unauthenticated visitors to the shared login", () => {
    expect(evaluateOrgAccess(null, "/partner")).toBe("login");
  });

  it("404s every non-partner role probing /partner", () => {
    expect(evaluateOrgAccess(tenantB, "/partner")).toBe("not-found");
    expect(evaluateOrgAccess(admin, "/partner")).toBe("not-found");
    expect(evaluateOrgAccess(staff, "/partner")).toBe("not-found");
  });

  it("keeps partner admins out of /org and /admin", () => {
    expect(evaluateOrgAccess(partner, "/org/tenant-a/dashboard")).toBe(
      "forbidden",
    );
    expect(evaluateOrgAccess(partner, "/admin")).toBe("not-found");
  });
});

describe("evaluateOrgAccess — staff_admin", () => {
  it("allows staff into the panel and tenant management", () => {
    expect(evaluateOrgAccess(staff, "/admin")).toBe("allow");
    expect(evaluateOrgAccess(staff, "/admin/tenants/abc123")).toBe("allow");
  });

  it("404s staff probing staff management (same as an outsider)", () => {
    expect(evaluateOrgAccess(staff, "/admin/staff")).toBe("not-found");
    expect(evaluateOrgAccess(staff, "/admin/staff/anything")).toBe(
      "not-found",
    );
    // Identical decision to a tenant user probing /admin — no existence leak.
    expect(evaluateOrgAccess(tenantB, "/admin")).toBe("not-found");
  });
});
