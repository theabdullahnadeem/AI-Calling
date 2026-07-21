import { createHmac } from "crypto";

import Retell from "retell-sdk";
import { describe, expect, it } from "vitest";

/**
 * Guards the comma-separated RETELL_API_KEY behaviour. Retell signs webhooks
 * with one specific key and an account may hold several, so verification has
 * to succeed when ANY listed key matches — otherwise every delivery 401s and
 * leaves no trace, which is exactly the failure this was written for.
 *
 * Mirrors the route's parsing rather than importing it: the route module is
 * server-only and pulls in the database on import.
 */
function parseKeys(raw: string): string[] {
  return raw
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

function isValid(rawKeys: string, body: string, signature: string): boolean {
  return parseKeys(rawKeys).some((key) => Retell.verify(body, key, signature));
}

const BODY = JSON.stringify({ event: "call_ended", call: { call_id: "c1" } });
const REAL_KEY = "key_the_one_retell_signs_with";
const OTHER_KEY = "key_a_different_api_key";

describe("Retell signature verification with multiple candidate keys", () => {
  it("accepts a signature made with the only configured key", () => {
    const signature = Retell.sign(BODY, REAL_KEY);
    expect(isValid(REAL_KEY, BODY, signature)).toBe(true);
  });

  it("accepts when the signing key is one of several listed", () => {
    const signature = Retell.sign(BODY, REAL_KEY);
    expect(isValid(`${OTHER_KEY},${REAL_KEY}`, BODY, signature)).toBe(true);
  });

  it("tolerates whitespace around the keys", () => {
    const signature = Retell.sign(BODY, REAL_KEY);
    expect(isValid(` ${OTHER_KEY} , ${REAL_KEY}\n`, BODY, signature)).toBe(true);
  });

  it("rejects when none of the listed keys signed it", () => {
    const signature = Retell.sign(BODY, "key_not_configured_anywhere");
    expect(isValid(`${OTHER_KEY},${REAL_KEY}`, BODY, signature)).toBe(false);
  });

  it("rejects a tampered body even with the right key", () => {
    const signature = Retell.sign(BODY, REAL_KEY);
    const tampered = JSON.stringify({ event: "call_ended", call: { call_id: "c2" } });
    expect(isValid(REAL_KEY, tampered, signature)).toBe(false);
  });

  it("rejects a malformed signature header", () => {
    expect(isValid(REAL_KEY, BODY, "not-a-signature")).toBe(false);
  });

  it("rejects a signature older than Retell's 5-minute window", () => {
    // Retell.sign() always stamps "now", so build the header by hand in its
    // documented `v=<unix-ms>,d=<hmac over body+timestamp>` form.
    const timestamp = Date.now() - 6 * 60 * 1000;
    const digest = createHmac("sha256", REAL_KEY)
      .update(BODY + timestamp)
      .digest("hex");
    expect(isValid(REAL_KEY, BODY, `v=${timestamp},d=${digest}`)).toBe(false);
  });
});
