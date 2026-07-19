import { describe, expect, it } from "vitest";

import {
  mapDirection,
  mapEndStatus,
  mapSentiment,
  mapStartStatus,
  resolveCustomerPhone,
  resolveDurationSeconds,
} from "./retell-mapping";

describe("mapStartStatus", () => {
  it("maps 'registered' to ringing", () => {
    expect(mapStartStatus("registered")).toBe("ringing");
  });

  it("maps ongoing/unknown/missing to in-progress", () => {
    expect(mapStartStatus("ongoing")).toBe("in-progress");
    expect(mapStartStatus("something_new")).toBe("in-progress");
    expect(mapStartStatus(undefined)).toBe("in-progress");
  });
});

describe("mapEndStatus", () => {
  it("maps error-shaped disconnection reasons to failed", () => {
    expect(mapEndStatus("call_transfer_error")).toBe("failed");
    expect(mapEndStatus("dial_failed")).toBe("failed");
    expect(mapEndStatus("dial_no_answer")).toBe("failed");
    expect(mapEndStatus("dial_busy")).toBe("failed");
  });

  it("maps normal hangups (and missing reason) to completed", () => {
    expect(mapEndStatus("user_hangup")).toBe("completed");
    expect(mapEndStatus("agent_hangup")).toBe("completed");
    expect(mapEndStatus(undefined)).toBe("completed");
  });
});

describe("mapSentiment", () => {
  it("maps Retell's sentiment labels case-insensitively", () => {
    expect(mapSentiment("Positive")).toBe("positive");
    expect(mapSentiment("NEUTRAL")).toBe("neutral");
    expect(mapSentiment("negative")).toBe("negative");
    expect(mapSentiment("Inquisitive")).toBe("inquisitive");
  });

  it("returns null for unknown values instead of guessing", () => {
    // The DB enum would reject a bad value — null keeps the row insertable.
    expect(mapSentiment("Unknown")).toBeNull();
    expect(mapSentiment(undefined)).toBeNull();
  });
});

describe("mapDirection", () => {
  it("only 'outbound' maps to outbound; everything else is inbound", () => {
    expect(mapDirection("outbound")).toBe("outbound");
    expect(mapDirection("inbound")).toBe("inbound");
    expect(mapDirection(undefined)).toBe("inbound");
  });
});

describe("resolveCustomerPhone", () => {
  it("uses the caller's number for inbound calls", () => {
    expect(
      resolveCustomerPhone({
        direction: "inbound",
        from_number: "+15551234567",
        to_number: "+15559990000",
      }),
    ).toBe("+15551234567");
  });

  it("uses the callee's number for outbound calls", () => {
    expect(
      resolveCustomerPhone({
        direction: "outbound",
        from_number: "+15559990000",
        to_number: "+15551234567",
      }),
    ).toBe("+15551234567");
  });

  it("degrades to 'unknown' rather than failing the insert", () => {
    expect(resolveCustomerPhone({ direction: "inbound" })).toBe("unknown");
  });
});

describe("resolveDurationSeconds", () => {
  it("prefers duration_ms, rounded to whole seconds", () => {
    expect(resolveDurationSeconds({ duration_ms: 61_400 })).toBe(61);
  });

  it("falls back to the start/end timestamps", () => {
    expect(
      resolveDurationSeconds({
        start_timestamp: 1_700_000_000_000,
        end_timestamp: 1_700_000_090_000,
      }),
    ).toBe(90);
  });

  it("returns null when nothing usable is present", () => {
    expect(resolveDurationSeconds({})).toBeNull();
    expect(
      resolveDurationSeconds({
        start_timestamp: 2,
        end_timestamp: 1, // nonsensical ordering
      }),
    ).toBeNull();
  });
});
