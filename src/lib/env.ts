import "server-only";

/**
 * Central accessor for server-side environment variables.
 *
 * Every third-party credential in this app flows through here, which keeps
 * the Prompt 8 audit trivial: nothing in this file (or anything importing it)
 * can ever reach the client bundle — the "server-only" import makes that a
 * build error, not a code-review hope. Never create NEXT_PUBLIC_ variants of
 * any of these.
 */

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "APP_URL",
  "REDIS_URL",
  "RETELL_SIGNING_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "POLAR_ACCESS_TOKEN",
  "POLAR_WEBHOOK_SECRET",
  "POLAR_ENVIRONMENT",
  "POLAR_PRODUCT_ID_PILOT",
  "POLAR_PRODUCT_ID_STANDARD",
  "POLAR_PRODUCT_ID_PRO",
] as const;

type RequiredKey = (typeof REQUIRED_KEYS)[number];

/**
 * Lazy, call-time lookup (not module-load) so `next build` succeeds without a
 * fully populated environment; a missing key fails loudly on first use.
 */
export function serverEnv(key: RequiredKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
