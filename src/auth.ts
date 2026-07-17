import NextAuth from "next-auth";
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

        if (!loginRateLimit(clientIp(request), email).allowed) {
          return null;
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

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          tenantSlug,
        };
      },
    }),
  ],
});
