import "server-only";

import { and, eq } from "drizzle-orm";

import { db, invoices, subscriptions, tenants, type Subscription } from "@/db";

/**
 * Sync handlers for Polar webhook events beyond first activation (Prompt 6).
 * Polar OWNS subscription lifecycle state — everything here is a local cache
 * update read from verified webhook payloads, never business logic that
 * second-guesses Polar. Amounts arrive in cents; we store dollars.
 */

function centsToUsd(cents: number | null | undefined): string | null {
  if (typeof cents !== "number" || Number.isNaN(cents)) return null;
  return (cents / 100).toFixed(2);
}

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Payload views — parsed defensively; a missing field degrades, never crashes. */
export type PolarOrderPayload = {
  id?: string;
  billingReason?: string;
  totalAmount?: number;
  subscriptionId?: string | null;
  subscription?: {
    id?: string;
    currentPeriodStart?: string | Date | null;
    currentPeriodEnd?: string | Date | null;
  } | null;
  customer?: { id?: string; externalId?: string | null } | null;
  metadata?: Record<string, unknown> | null;
  items?: Array<{
    label?: string | null;
    amount?: number;
    productPrice?: { amountType?: string } | null;
  }> | null;
};

export type PolarSubscriptionPayload = {
  id?: string;
  status?: string;
  currentPeriodStart?: string | Date | null;
  currentPeriodEnd?: string | Date | null;
  customer?: { id?: string; externalId?: string | null } | null;
  metadata?: Record<string, unknown> | null;
};

export function extractPolarReference(data: {
  metadata?: Record<string, unknown> | null;
  customer?: { externalId?: string | null } | null;
}): string | null {
  const fromMetadata = data.metadata?.["polarCustomerReference"];
  if (typeof fromMetadata === "string" && fromMetadata.length > 0) {
    return fromMetadata;
  }
  const fromExternalId = data.customer?.externalId;
  return typeof fromExternalId === "string" && fromExternalId.length > 0
    ? fromExternalId
    : null;
}

/** Locate our subscription row: by Polar's subscription id, else by tenant reference. */
export async function findSubscription(params: {
  polarSubscriptionId?: string | null;
  polarCustomerReference?: string | null;
}): Promise<Subscription | null> {
  if (params.polarSubscriptionId) {
    const [byId] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.polarSubscriptionId, params.polarSubscriptionId))
      .limit(1);
    if (byId) return byId;
  }
  if (params.polarCustomerReference) {
    const [tenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.polarCustomerReference, params.polarCustomerReference))
      .limit(1);
    if (tenant) {
      const [byTenant] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, tenant.id))
        .limit(1);
      if (byTenant) return byTenant;
    }
  }
  return null;
}

/**
 * Idempotent invoice logging for the dashboard's billing history — amounts
 * and overage are READ from Polar's payload, never recalculated (Prompt 6
 * item 7 / Prompt 1 invoices notes).
 */
async function recordPaidInvoice(
  sub: Subscription,
  order: PolarOrderPayload,
): Promise<void> {
  const polarOrderId = order.id ?? null;
  if (polarOrderId) {
    const [existing] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.polarOrderId, polarOrderId))
      .limit(1);
    if (existing) return; // duplicate webhook delivery
  }

  // Overage = the metered line item Polar attached from the call_minutes
  // meter. Minutes shown on the dashboard are derived from that charge at
  // the configured rate — display only, never billed by us.
  const meteredCents = (order.items ?? [])
    .filter((item) => item.productPrice?.amountType === "metered")
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const overageChargeUsd = centsToUsd(meteredCents) ?? "0";
  const rate = Number(sub.overageRatePerMinuteUsd);
  const overageMinutes =
    meteredCents > 0 && rate > 0 ? Math.round(meteredCents / 100 / rate) : 0;

  await db.insert(invoices).values({
    tenantId: sub.tenantId,
    subscriptionId: sub.id,
    amountUsd: centsToUsd(order.totalAmount) ?? sub.monthlyPriceUsd,
    overageMinutes,
    overageChargeUsd,
    polarOrderId,
    status: "paid",
    paidAt: new Date(),
  });
}

/**
 * order.paid for an already-active tenant. subscription_cycle = renewal:
 * reset the local minute counter, advance the period, log the invoice.
 * subscription_create = the activation order — just log the invoice (the
 * activation path in activation.ts already did everything else).
 */
export async function handleOrderPaid(order: PolarOrderPayload): Promise<void> {
  const sub = await findSubscription({
    polarSubscriptionId: order.subscriptionId ?? order.subscription?.id,
    polarCustomerReference: extractPolarReference(order),
  });
  if (!sub) {
    console.warn(
      `[polar-sync] order.paid ${order.id ?? "<no id>"} matched no subscription`,
    );
    return;
  }

  await recordPaidInvoice(sub, order);

  if (order.billingReason === "subscription_cycle") {
    const periodStart = asDate(order.subscription?.currentPeriodStart);
    const periodEnd = asDate(order.subscription?.currentPeriodEnd);
    await db
      .update(subscriptions)
      .set({
        minutesUsedThisCycle: 0,
        status: "active",
        overdueSince: null,
        ...(periodStart ? { currentPeriodStart: periodStart } : {}),
        ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
      })
      .where(eq(subscriptions.id, sub.id));
  }
}

/** subscription.active for an already-active tenant: sync ids/period, clear overdue (recovery). */
export async function handleSubscriptionActive(
  payload: PolarSubscriptionPayload,
): Promise<void> {
  const sub = await findSubscription({
    polarSubscriptionId: payload.id,
    polarCustomerReference: extractPolarReference(payload),
  });
  if (!sub) return;

  const periodStart = asDate(payload.currentPeriodStart);
  const periodEnd = asDate(payload.currentPeriodEnd);
  await db
    .update(subscriptions)
    .set({
      status: "active",
      overdueSince: null,
      ...(payload.id ? { polarSubscriptionId: payload.id } : {}),
      ...(payload.customer?.id ? { polarCustomerId: payload.customer.id } : {}),
      ...(periodStart ? { currentPeriodStart: periodStart } : {}),
      ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
    })
    .where(eq(subscriptions.id, sub.id));
}

/** subscription.past_due: start (don't restart) the 3-day grace window, log a failed invoice. */
export async function handlePastDue(
  payload: PolarSubscriptionPayload,
): Promise<void> {
  const sub = await findSubscription({
    polarSubscriptionId: payload.id,
    polarCustomerReference: extractPolarReference(payload),
  });
  if (!sub) {
    console.warn(
      `[polar-sync] past_due ${payload.id ?? "<no id>"} matched no subscription`,
    );
    return;
  }

  await db
    .update(subscriptions)
    .set({
      status: "payment_overdue",
      // Keep the original overdueSince on repeat deliveries — the grace
      // window must not restart with every retry notification.
      overdueSince: sub.overdueSince ?? new Date(),
    })
    .where(eq(subscriptions.id, sub.id));

  // Only one failed invoice per overdue episode.
  if (!sub.overdueSince) {
    const [openFailed] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.subscriptionId, sub.id),
          eq(invoices.status, "failed"),
        ),
      )
      .limit(1);
    if (!openFailed) {
      await db.insert(invoices).values({
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        amountUsd: sub.monthlyPriceUsd,
        status: "failed",
      });
    }
  }
}

/** subscription.canceled / revoked: local cache says cancelled. */
export async function handleCancellation(
  payload: PolarSubscriptionPayload,
): Promise<void> {
  const sub = await findSubscription({
    polarSubscriptionId: payload.id,
    polarCustomerReference: extractPolarReference(payload),
  });
  if (!sub) return;

  await db
    .update(subscriptions)
    .set({ status: "cancelled" })
    .where(eq(subscriptions.id, sub.id));
}
