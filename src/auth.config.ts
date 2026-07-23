import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe NextAuth config: no database, bcrypt, or Node-only imports here.
 * The middleware (Prompt 2) imports THIS file to read/verify the session JWT
 * at the edge; the full config in src/auth.ts adds the Credentials provider.
 *
 * Session strategy is JWT (signed + encrypted with AUTH_SECRET). Revocation
 * is handled by the server-side checks every tenant-scoped procedure runs
 * against the database (tenant status, user existence) — a stolen cookie for
 * a suspended tenant gets nothing.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on sign-in — persist our custom claims once.
      if (user) {
        token.uid = user.id!;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantSlug = user.tenantSlug;
        token.partnerId = user.partnerId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid;
      session.user.role = token.role;
      session.user.tenantId = token.tenantId;
      session.user.tenantSlug = token.tenantSlug;
      session.user.partnerId = token.partnerId;
      return session;
    },
  },
} satisfies NextAuthConfig;
