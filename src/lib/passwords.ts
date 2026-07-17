import "server-only";

import bcrypt from "bcryptjs";

// Library hashing per spec — never hand-rolled. Cost 12 keeps a single
// verify ~250ms: slow enough to make offline cracking expensive, fast enough
// for interactive login.
const BCRYPT_COST = 12;

// A real hash of random throwaway bytes. verifyPassword runs against this
// when the user doesn't exist (or has no password yet) so a login attempt
// takes the same time whether or not the email is registered — no timing
// oracle for account enumeration.
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-dummy-value", BCRYPT_COST);

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export async function verifyPassword(
  plaintext: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (!storedHash) {
    await bcrypt.compare(plaintext, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(plaintext, storedHash);
}
