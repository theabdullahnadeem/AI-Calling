import "server-only";

import { and, eq } from "drizzle-orm";

import { db, suppressedNumbers, type Tenant } from "@/db";
import { normalizePhoneNumber } from "./phone";

/**
 * Prompt 8 item 3: the mandatory pre-flight for ANY outbound call. No code
 * path may dial out without passing this check. Fails CLOSED on every
 * uncertainty — a call we wrongly skip costs a follow-up; a call we wrongly
 * place is a TCPA exposure (docs/04).
 *
 * NOTE: no outbound-call trigger exists in the codebase yet (Retell agent
 * behavior is configured by the admin, outside this app). When one is built,
 * it must (a) call this first, (b) no-op on denial, and (c) write the
 * per-call consentBasis onto the calls row it creates.
 */

export type OutboundCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export type DncCheckStatus = "clear" | "listed" | "unavailable";

/**
 * National DNC Registry check — NOT YET IMPLEMENTED.
 *
 * Flagged during planning (docs/01 Prompt 8 item 3): the correct API/data
 * source for DNC scrubbing needs manual research (the FTC's org-facing
 * telemarketer subscription vs. a commercial scrubbing provider). Until a
 * real provider is wired in here, this returns "unavailable" and the guard
 * below fails closed — outbound calling cannot go live on an unchecked
 * number by accident.
 */
async function checkNationalDncRegistry(
  _phoneNumber: string,
): Promise<DncCheckStatus> {
  return "unavailable";
}

async function logSkip(
  tenant: Tenant,
  phoneNumber: string,
  reason: string,
): Promise<void> {
  console.warn(
    `[outbound-guard] call to ${phoneNumber} for tenant ${tenant.id} skipped: ${reason}`,
  );
  try {
    const { redis } = await import("./redis");
    await redis().lpush(
      "outbound:skips",
      JSON.stringify({
        tenantId: tenant.id,
        phoneNumber,
        reason,
        skippedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // The console line above is still the record.
  }
}

export async function checkOutboundCallAllowed(
  tenant: Tenant,
  rawPhoneNumber: string,
): Promise<OutboundCheckResult> {
  // Item 1: explicit per-tenant opt-in, checked before anything else.
  if (!tenant.outboundCallingEnabled) {
    await logSkip(tenant, rawPhoneNumber, "outbound_calling_disabled");
    return { allowed: false, reason: "outbound_calling_disabled" };
  }

  const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
  if (!phoneNumber) {
    await logSkip(tenant, rawPhoneNumber, "invalid_phone_number");
    return { allowed: false, reason: "invalid_phone_number" };
  }

  // Per-tenant suppression list.
  const [suppressed] = await db
    .select({ id: suppressedNumbers.id })
    .from(suppressedNumbers)
    .where(
      and(
        eq(suppressedNumbers.tenantId, tenant.id),
        eq(suppressedNumbers.phoneNumber, phoneNumber),
      ),
    )
    .limit(1);
  if (suppressed) {
    await logSkip(tenant, phoneNumber, "suppressed_number");
    return { allowed: false, reason: "suppressed_number" };
  }

  // National DNC Registry — unavailable counts as a failure, not a pass.
  const dnc = await checkNationalDncRegistry(phoneNumber);
  if (dnc !== "clear") {
    const reason =
      dnc === "listed" ? "dnc_registry_listed" : "dnc_check_unavailable";
    await logSkip(tenant, phoneNumber, reason);
    return { allowed: false, reason };
  }

  return { allowed: true };
}
