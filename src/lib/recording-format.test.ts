import { describe, expect, it } from "vitest";

import {
  extensionFromContentType,
  recordingObjectKey,
  RETRY_DELAYS_MS,
} from "./recording-format";

describe("extensionFromContentType", () => {
  it("maps common audio content types", () => {
    expect(extensionFromContentType("audio/mpeg")).toBe("mp3");
    expect(extensionFromContentType("audio/mp3")).toBe("mp3");
    expect(extensionFromContentType("audio/ogg")).toBe("ogg");
    expect(extensionFromContentType("audio/webm")).toBe("webm");
    expect(extensionFromContentType("audio/wav")).toBe("wav");
  });

  it("ignores charset/parameter suffixes and casing", () => {
    expect(extensionFromContentType("Audio/MPEG; charset=binary")).toBe("mp3");
  });

  it("defaults to wav for unknown or missing types", () => {
    expect(extensionFromContentType("application/octet-stream")).toBe("wav");
    expect(extensionFromContentType(null)).toBe("wav");
  });
});

describe("recordingObjectKey", () => {
  it("namespaces objects by tenant, then call", () => {
    expect(recordingObjectKey("tenant-1", "call_abc", "wav")).toBe(
      "recordings/tenant-1/call_abc.wav",
    );
  });
});

describe("RETRY_DELAYS_MS", () => {
  it("defines exactly 3 retries with growing backoff", () => {
    expect(RETRY_DELAYS_MS).toHaveLength(3);
    for (let i = 1; i < RETRY_DELAYS_MS.length; i++) {
      expect(RETRY_DELAYS_MS[i]).toBeGreaterThan(RETRY_DELAYS_MS[i - 1]);
    }
  });
});
