import "server-only";

import { createHash, randomBytes } from "crypto";

export const SET_PASSWORD_TOKEN_TTL_HOURS = 48;

/**
 * 256-bit single-use token for the set-password email link.
 *
 * The RAW token goes into the emailed link and is never persisted; only its
 * SHA-256 digest is stored in users.setPasswordToken. Lookup is by digest, so
 * neither a database dump nor a DB-read compromise yields a usable link.
 */
export function generateSetPasswordToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = randomBytes(32).toString("base64url");
  return {
    rawToken,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(
      Date.now() + SET_PASSWORD_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    ),
  };
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
