import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

// Neon's serverless HTTP driver — safe for Next.js serverless functions,
// which would exhaust direct Postgres connections under load. DATABASE_URL
// must be Neon's pooled connection string (see docs/02, section 2).
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

export const db = drizzle(neon(databaseUrl), { schema });

export * from "./schema";
