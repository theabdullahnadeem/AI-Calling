import { describe, expect, it } from "vitest";

import { isForeignKeyViolation, isUniqueViolation } from "./db-errors";

/** The shape Drizzle actually throws: a wrapper with the pg error on `cause`. */
function drizzleWrapped(sqlState: string): Error {
  const pgError = Object.assign(new Error("duplicate key value violates ..."), {
    code: sqlState,
    constraint: "tenants_retell_agent_id_idx",
  });
  return Object.assign(new Error("Failed query: update \"tenants\" ..."), {
    cause: pgError,
  });
}

describe("isUniqueViolation", () => {
  // The regression this exists for: checking only error.code missed every
  // Drizzle-wrapped violation, so the admin panel 500'd instead of showing
  // "already mapped to another tenant".
  it("detects 23505 nested on cause (how Drizzle throws it)", () => {
    expect(isUniqueViolation(drizzleWrapped("23505"))).toBe(true);
  });

  it("detects 23505 on the error itself (raw driver error)", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("ignores unrelated database errors", () => {
    expect(isUniqueViolation(drizzleWrapped("23503"))).toBe(false);
    expect(isUniqueViolation(new Error("connection refused"))).toBe(false);
  });

  it("survives non-error inputs without throwing", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("boom")).toBe(false);
  });

  it("terminates on a self-referential cause chain", () => {
    const looped: { cause?: unknown } = {};
    looped.cause = looped;
    expect(isUniqueViolation(looped)).toBe(false);
  });
});

describe("isForeignKeyViolation", () => {
  it("detects 23503 nested on cause", () => {
    expect(isForeignKeyViolation(drizzleWrapped("23503"))).toBe(true);
  });

  it("does not confuse it with a unique violation", () => {
    expect(isForeignKeyViolation(drizzleWrapped("23505"))).toBe(false);
  });
});
