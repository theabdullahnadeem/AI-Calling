import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";

import { activateTenantFromPayment } from "@/lib/activation";
import { serverEnv } from "@/lib/env";
import {
  extractPolarReference,
  handleCancellation,
  handleOrderPaid,
  handlePastDue,
  handleSubscriptionActive,
  type PolarOrderPayload,
  type PolarSubscriptionPayload,
} from "@/lib/polar-sync";

export const runtime = "nodejs";

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Polar webhook receiver (Prompts 2.5 + 6). Event names confirmed against
 * Polar's docs: order.paid, subscription.active, subscription.past_due,
 * subscription.canceled, subscription.revoked. Signature (Standard Webhooks)
 * is verified over the raw bytes before ANY processing.
 *
 * First payment for a tenant → the activation path in activation.ts (the
 * ONLY code allowed to flip tenants.status to 'active'). Every later event
 * is a cache sync in polar-sync.ts. Both are idempotent per delivery.
 */
export async function POST(req: Request): Promise<Response> {
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
    case "order.paid": {
      const order = event.data as PolarOrderPayload;
      const reference = extractPolarReference(order);

      // Try activation first — it no-ops ("already_active") for anything but
      // a pending_payment tenant's first payment.
      if (reference) {
        const result = await activateTenantFromPayment({
          polarCustomerReference: reference,
          polarCustomerId: order.customer?.id ?? null,
          polarSubscriptionId:
            order.subscriptionId ?? order.subscription?.id ?? null,
          currentPeriodStart: asDate(order.subscription?.currentPeriodStart),
          currentPeriodEnd: asDate(order.subscription?.currentPeriodEnd),
        });
        if (result.outcome === "activated") {
          // Log the first invoice too, then done.
          await handleOrderPaid(order);
          return Response.json({ received: true, outcome: "activated" });
        }
      }

      // Renewal / already-active path: invoice + cycle reset.
      await handleOrderPaid(order);
      return Response.json({ received: true, outcome: "synced" });
    }

    case "subscription.active": {
      const payload = event.data as PolarSubscriptionPayload;
      const reference = extractPolarReference(payload);

      if (reference) {
        const result = await activateTenantFromPayment({
          polarCustomerReference: reference,
          polarCustomerId: payload.customer?.id ?? null,
          polarSubscriptionId: payload.id ?? null,
          currentPeriodStart: asDate(payload.currentPeriodStart),
          currentPeriodEnd: asDate(payload.currentPeriodEnd),
        });
        if (result.outcome === "activated") {
          return Response.json({ received: true, outcome: "activated" });
        }
      }

      // Already active → id/period sync + past_due recovery.
      await handleSubscriptionActive(payload);
      return Response.json({ received: true, outcome: "synced" });
    }

    case "subscription.past_due": {
      await handlePastDue(event.data as PolarSubscriptionPayload);
      return Response.json({ received: true, outcome: "past_due" });
    }

    case "subscription.canceled":
    case "subscription.revoked": {
      await handleCancellation(event.data as PolarSubscriptionPayload);
      return Response.json({ received: true, outcome: "cancelled" });
    }

    default:
      // Signed, real, just not one we act on (subscription.updated,
      // order.created, …). Ack so Polar doesn't retry.
      return Response.json({ received: true, handled: false });
  }
}
