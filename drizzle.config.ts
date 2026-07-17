import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only used by db:migrate / db:studio — db:generate never connects.
    url: process.env.DATABASE_URL ?? "",
  },
});
