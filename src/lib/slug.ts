import "server-only";

import { eq } from "drizzle-orm";

import { db, tenants } from "@/db";

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "tenant";
}

/** Appends -2, -3, … until the slug is free. */
export async function ensureUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  for (let suffix = 2; suffix < 100; suffix++) {
    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, candidate))
      .limit(1);
    if (!existing) return candidate;
    candidate = `${base}-${suffix}`;
  }
  throw new Error(`Could not find a free slug for "${name}"`);
}
