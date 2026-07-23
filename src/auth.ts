import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { authConfig } from "./auth.config";
import { db, tenants, users } from "./db";
import { verifyPassword } from "./lib/passwords";
import { loginRateLimit } from "./lib/rate-limit";

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(256),
  password: z.string().min(1).max(128),
});

function clientIp(request: Request | undefined): string {
  // Behind Vercel/a proxy the left-most x-forwarded-for entry is the caller.
  const forwarded = request?.headers?.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

/**
 * Thrown (not returned as null) when the login rate limit trips, so the
 * form can say "too many attempts" instead of the misleading "invalid email
 * or password". The code travels to the client — it reveals only that
 * rate-limiting exists, never whether the account does: the limit applies
 * per (ip, email) whether or not that email has a users row.
 */
class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      // Every failure path returns null — the UI shows one generic "invalid
      // credentials" message. No signal distinguishes "no such account"
      // (including pending_payment tenants, which have NO users row at all)
      // from "wrong password": same response, and verifyPassword burns a
      // bcrypt compare against a dummy hash on unknown emails so timing
      // doesn't leak it either.
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const limit = await loginRateLimit(clientIp(request), email);
        if (!limit.allowed) {
          throw new RateLimitedError();
        }

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        const passwordOk = await verifyPassword(
          password,
          user?.passwordHash,
        );
        if (!user || !passwordOk) return null;

        let tenantSlug: string | null = null;
        if (user.role === "tenant_owner") {
          if (!user.tenantId) return null;
          const [tenant] = await db
            .select({ slug: tenants.slug })
            .from(tenants)
            .where(eq(tenants.id, user.tenantId))
            .limit(1);
          if (!tenant) return null;
          tenantSlug = tenant.slug;
        }

        // A partner_admin row must carry its partner scope — a row without
        // one can't be authorized anywhere, so fail the login outright.
        if (user.role === "partner_admin" && !user.partnerId) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          tenantSlug,
          partnerId: user.partnerId,
        };
      },
    }),
  ],
});
