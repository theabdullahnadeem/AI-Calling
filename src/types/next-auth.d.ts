import type { DefaultSession } from "next-auth";
// This import is what registers the "next-auth/jwt" module for augmentation —
// without it the JWT interface merge below silently doesn't apply.
import type {} from "next-auth/jwt";

export type SessionRole =
  | "tenant_owner"
  | "admin"
  | "staff_admin"
  | "partner_admin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: SessionRole;
      tenantId: string | null;
      tenantSlug: string | null;
      partnerId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: SessionRole;
    tenantId: string | null;
    tenantSlug: string | null;
    partnerId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: SessionRole;
    tenantId: string | null;
    tenantSlug: string | null;
    partnerId: string | null;
  }
}
