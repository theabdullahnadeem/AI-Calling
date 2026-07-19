import { describe, expect, it } from "vitest";

import { normalizePhoneNumber } from "./phone";

describe("normalizePhoneNumber", () => {
  it("normalizes formatted NANP numbers to +1 form", () => {
    expect(normalizePhoneNumber("(555) 123-4567")).toBe("+15551234567");
    expect(normalizePhoneNumber("555.123.4567")).toBe("+15551234567");
  });

  it("keeps international numbers, stripping formatting", () => {
    expect(normalizePhoneNumber("+92 300 1234567")).toBe("+923001234567");
    expect(normalizePhoneNumber("+1 555 123 4567")).toBe("+15551234567");
  });

  it("suppression writer and outbound guard agree on the same form", () => {
    // The property that matters: two spellings of one number normalize
    // identically, so a suppressed number can't be dialed via reformatting.
    expect(normalizePhoneNumber("(555) 123-4567")).toBe(
      normalizePhoneNumber("+1-555-123-4567"),
    );
  });

  it("rejects garbage rather than guessing", () => {
    expect(normalizePhoneNumber("not a number")).toBeNull();
    expect(normalizePhoneNumber("12345")).toBeNull();
    expect(normalizePhoneNumber("")).toBeNull();
  });
});
