import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";

import { activateTenantFromPayment } from "@/lib/activation";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Minimal structural view of the webhook payloads we act on. Polar's SDK
 * types the full payload, but we read defensively: a missing field degrades
 * to a null, never a crash — and event names were confirmed against Polar's
 * current docs (order.paid, subscription.active, subscription.past_due,
 * subscription.canceled, subscription.revoked).
 */
type ActivationishPayload = {
  metadata?: Record<string, unknown> | null;
  customer?: { id?: string; externalId?: string | null } | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  subscription?: { id?: string } | null;
  id?: string;
  currentPeriodStart?: string | Date | null;
  currentPeriodEnd?: string | Date | null;
};

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function extractReference(data: ActivationishPayload): string | null {
  const fromMetadata = data.metadata?.["polarCustomerReference"];
  if (typeof fromMetadata === "string" && fromMetadata.length > 0) {
    return fromMetadata;
  }
  const fromExternalId = data.customer?.externalId;
  return typeof fromExternalId === "string" && fromExternalId.length > 0
    ? fromExternalId
    : null;
}

export async function POST(req: Request): Promise<Response> {
  // Raw body FIRST — the signature covers the exact bytes. Nothing is parsed
  // or processed before verification succeeds.
  const body = await req.text();

  let event: { type: string; data: unknown };
  try {
    event = validateEvent(
      body,
      Object.fromEntries(req.headers.entries()),
      serverEnv("POLAR_WEBHOOK_SECRET"),
    ) as { type: string; data: unknown };
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return new Response("Invalid webhook signature", { status: 403 });
    }
    throw error;
  }

  switch (event.type) {
    case "order.paid":
    case "subscription.active": {
      const data = event.data as ActivationishPayload;
      const reference = extractReference(data);

      if (!reference) {
        // Signed, real Polar event, but not attributable to a tenant (e.g. a
        // checkout created outside the admin panel). Log loudly, ack with 200
        // — retrying can never make it matchable.
        console.warn(
          `[polar-webhook] ${event.type} carried no polarCustomerReference/externalId — ignored`,
        );
        return Response.json({ received: true, matched: false });
      }

      const subscriptionId =
        event.type === "subscription.active"
          ? (data.id ?? null)
          : (data.subscriptionId ?? data.subscription?.id ?? null);

      const result = await activateTenantFromPayment({
        polarCustomerReference: reference,
        polarCustomerId: data.customer?.id ?? data.customerId ?? null,
        polarSubscriptionId: subscriptionId,
        currentPeriodStart: asDate(data.currentPeriodStart),
        currentPeriodEnd: asDate(data.currentPeriodEnd),
      });

      if (result.outcome === "tenant_not_found") {
        console.warn(
          `[polar-webhook] ${event.type} reference "${reference}" matched no tenant`,
        );
      }

      return Response.json({ received: true, outcome: result.outcome });
    }

    default:
      // subscription.past_due / canceled / revoked, renewal orders, etc. are
      // Prompt 6's scope — acknowledge so Polar doesn't retry them forever.
      return Response.json({ received: true, handled: false });
  }
}
