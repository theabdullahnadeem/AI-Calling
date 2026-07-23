import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { evaluateOrgAccess } from "@/lib/org-access";

// Edge-safe NextAuth instance: authConfig has no database or Node-only
// imports; this only reads/verifies the session JWT cookie.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const user = req.auth?.user;
  const decision = evaluateOrgAccess(
    user ? { role: user.role, tenantSlug: user.tenantSlug } : null,
    req.nextUrl.pathname,
  );

  switch (decision) {
    case "allow":
      return NextResponse.next();
    case "login":
      return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
    case "admin-login":
      return NextResponse.redirect(
        new URL("/admin/login", req.nextUrl.origin),
      );
    case "forbidden":
      // Spec (Prompt 2): 403, not a silent redirect, and nothing that leaks
      // whether the requested slug exists.
      return new NextResponse("Forbidden", { status: 403 });
    case "not-found":
      return new NextResponse("Not Found", { status: 404 });
  }
});

export const config = {
  matcher: ["/org/:path*", "/admin/:path*", "/partner/:path*"],
};
