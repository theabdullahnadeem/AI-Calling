import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "./schema";

// WebSocket-based Pool (not the stateless HTTP driver): the Polar activation
// webhook needs interactive transactions with SELECT ... FOR UPDATE so a
// retried webhook can never double-activate a tenant. DATABASE_URL must be
// Neon's pooled connection string (see docs/02, section 2).
neonConfig.webSocketConstructor = ws;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({ connectionString: databaseUrl });

export const db = drizzle(pool, { schema });

export type Database = typeof db;

export * from "./schema";
