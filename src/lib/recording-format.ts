/**
 * Pure helpers for recording archival — no framework, env, or IO imports so
 * they're directly unit-testable (recording.ts owns the side effects).
 */

// Retry after 0.5s, then 1.5s, then 3s — 3 retries per spec, kept short
// enough for a serverless execution window.
export const RETRY_DELAYS_MS = [500, 1500, 3000] as const;

export function extensionFromContentType(contentType: string | null): string {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  switch (normalized) {
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/webm":
      return "webm";
    case "audio/x-wav":
    case "audio/wave":
    case "audio/wav":
    default:
      return "wav"; // Retell recordings are WAV unless stated otherwise
  }
}

/** Namespaced per tenant so bucket-level tooling can reason about ownership. */
export function recordingObjectKey(
  tenantId: string,
  callId: string,
  extension: string,
): string {
  return `recordings/${tenantId}/${callId}.${extension}`;
}
