import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";

import { db, users } from "@/db";
import { hashPassword } from "@/lib/passwords";
import { setPasswordRateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/tokens";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(20).max(128),
  password: z.string().min(12).max(128),
});

// One generic failure message for every reason (bad token, expired token,
// already-used token) — a probing client learns nothing about which it hit.
const GENERIC_ERROR =
  "This link is invalid or has expired. Contact us for a fresh one.";

export async function POST(req: Request): Promise<Response> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = await setPasswordRateLimit(ip);
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.some((i) =>
      i.path.includes("password"),
    );
    return Response.json(
      {
        error: passwordIssue
          ? "Password must be 12–128 characters."
          : GENERIC_ERROR,
      },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);

  // Single atomic UPDATE: matches only an unexpired, still-present token and
  // consumes it in the same statement. Two racing submissions can't both
  // succeed, and a used token can never be replayed.
  const claimed = await db
    .update(users)
    .set({
      passwordHash,
      setPasswordToken: null,
      setPasswordTokenExpiresAt: null,
    })
    .where(
      and(
        eq(users.setPasswordToken, hashToken(parsed.data.token)),
        gt(users.setPasswordTokenExpiresAt, sql`now()`),
      ),
    )
    .returning({ email: users.email });

  if (claimed.length === 0) {
    return Response.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // The email lets the client sign the user straight in with their new
  // password; anyone holding a valid single-use token already controls the
  // account, so this reveals nothing extra.
  return Response.json({ ok: true, email: claimed[0].email });
}
