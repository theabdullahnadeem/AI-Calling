/**
 * Pure mapping helpers between Retell webhook payloads and our schema enums.
 * Framework-free so they're directly unit-testable; every unknown input maps
 * to a safe value rather than throwing — the DB's enum constraints are the
 * final guard, these keep well-formed-but-unexpected payloads from 500ing.
 */

export type CallStatus = "ringing" | "in-progress" | "completed" | "failed";
export type CallSentiment =
  | "positive"
  | "neutral"
  | "negative"
  | "inquisitive";
export type CallDirection = "inbound" | "outbound";

/** call_started: Retell's 'registered' means not yet connected → ringing. */
export function mapStartStatus(callStatus: string | undefined): CallStatus {
  return callStatus === "registered" ? "ringing" : "in-progress";
}

/**
 * call_ended: error-shaped disconnection reasons mean the call failed;
 * everything else (hangup, agent_hangup, voicemail, transfer, …) completed.
 */
export function mapEndStatus(
  disconnectionReason: string | undefined,
): CallStatus {
  if (!disconnectionReason) return "completed";
  const reason = disconnectionReason.toLowerCase();
  return reason.includes("error") ||
    reason === "dial_failed" ||
    reason === "dial_no_answer" ||
    reason === "dial_busy" ||
    reason === "concurrency_limit_reached" ||
    reason === "no_valid_payment"
    ? "failed"
    : "completed";
}

/** Retell sends 'Positive' / 'Neutral' / 'Negative' / 'Unknown' (and custom values). */
export function mapSentiment(
  userSentiment: string | undefined,
): CallSentiment | null {
  switch (userSentiment?.toLowerCase()) {
    case "positive":
      return "positive";
    case "neutral":
      return "neutral";
    case "negative":
      return "negative";
    case "inquisitive":
      return "inquisitive";
    default:
      return null;
  }
}

export function mapDirection(
  direction: string | undefined,
): CallDirection {
  return direction === "outbound" ? "outbound" : "inbound";
}

/**
 * The customer's number: the caller for inbound, the callee for outbound.
 * calls.phoneNumber is NOT NULL — degrade to "unknown" rather than dropping
 * the whole call record over a missing field.
 */
export function resolveCustomerPhone(call: {
  direction?: string;
  from_number?: string;
  to_number?: string;
}): string {
  const number =
    mapDirection(call.direction) === "inbound"
      ? call.from_number
      : call.to_number;
  return number || "unknown";
}

/** Duration in whole seconds from duration_ms, falling back to timestamps. */
export function resolveDurationSeconds(call: {
  duration_ms?: number;
  start_timestamp?: number;
  end_timestamp?: number;
}): number | null {
  if (typeof call.duration_ms === "number" && call.duration_ms >= 0) {
    return Math.round(call.duration_ms / 1000);
  }
  if (
    typeof call.start_timestamp === "number" &&
    typeof call.end_timestamp === "number" &&
    call.end_timestamp >= call.start_timestamp
  ) {
    return Math.round((call.end_timestamp - call.start_timestamp) / 1000);
  }
  return null;
}
