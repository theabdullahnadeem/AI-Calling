import "dotenv/config";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db, users } from "../src/db";

/**
 * One-time admin bootstrap: creates (or re-passwords) the single admin user.
 *
 * Usage: set ADMIN_EMAIL and ADMIN_PASSWORD in .env, then `npm run seed:admin`.
 * The password is bcrypt-hashed before storage; consider clearing
 * ADMIN_PASSWORD from .env after a successful run.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    if (existing.role !== "admin") {
      // Never silently escalate a tenant account to admin.
      throw new Error(
        `A non-admin user already exists for ${email} — refusing to modify it.`,
      );
    }
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, existing.id));
    console.log(`Updated password for existing admin ${email}.`);
  } else {
    await db.insert(users).values({
      email,
      passwordHash,
      role: "admin",
      tenantId: null,
    });
    console.log(`Created admin user ${email}.`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
