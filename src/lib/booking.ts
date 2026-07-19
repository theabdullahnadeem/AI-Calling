import "server-only";

import { and, eq, lt, sql } from "drizzle-orm";

import { bookings, db, tenants, type Booking, type Tenant } from "@/db";
import { sendBookingCustomerEmail, sendBookingOwnerEmail } from "./email";
import {
  buildIntakeSummary,
  extractCustomerContact,
  extractIntakeData,
  isBookingIntent,
  parseIntakeSchema,
} from "./intake";

/** Initial send + 3 retries (spec, Prompt 5 item 5), then permanent give-up. */
export const BOOKING_EMAIL_MAX_ATTEMPTS = 4;

/**
 * Booking detection for the call_analyzed webhook (spec, Prompt 5 items 1-2).
 * Which custom_analysis_data field signals intent comes from the tenant's
 * intakeSchema — never a hardcoded name. Returns the new booking's id, or
 * null when nothing was (or should be) created.
 */
export async function detectAndCreateBooking(params: {
  tenant: Tenant;
  callId: string;
  customData: Record<string, unknown>;
}): Promise<string | null> {
  const { tenant, callId, customData } = params;
  const config = parseIntakeSchema(tenant.intakeSchema);

  if (!config.bookingIntentField) {
    // Tenant not configured for booking capture — not an error.
    return null;
  }
  if (!isBookingIntent(customData[config.bookingIntentField])) {
    return null;
  }

  // One booking per call: webhook idempotency already guards duplicates
  // within the Redis TTL; this guards replays beyond it (dead-letter replay,
  // TTL expiry).
  const [existing] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.callId, callId))
    .limit(1);
  if (existing) return null;

  const contact = extractCustomerContact(customData, config);
  const [created] = await db
    .insert(bookings)
    .values({
      tenantId: tenant.id,
      callId,
      customerName: contact.name,
      customerEmail: contact.email,
      customerPhone: contact.phone,
      intakeData: extractIntakeData(customData, config),
      emailSentStatus: "pending",
    })
    .returning({ id: bookings.id });

  return created?.id ?? null;
}

/**
 * One email attempt for a booking (spec, items 3-4): the tenant owner is
 * always notified; the customer only when an email was captured — and
 * emailSentStatus reflects only what was actually attempted. Any failure
 * marks 'failed' (never left 'pending' forever) for the retry worker.
 */
async function attemptBookingEmails(
  booking: Booking,
  tenant: Tenant,
): Promise<void> {
  const config = parseIntakeSchema(tenant.intakeSchema);
  const intakeSummary = buildIntakeSummary(
    (booking.intakeData ?? {}) as Record<string, unknown>,
    config,
  );

  let allSucceeded = true;

  try {
    await sendBookingOwnerEmail({
      to: tenant.ownerEmail,
      tenantName: tenant.name,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      intakeSummary,
    });
  } catch (error) {
    allSucceeded = false;
    console.error(
      `[booking] owner email failed for booking ${booking.id}:`,
      error instanceof Error ? error.message : error,
    );
  }

  if (booking.customerEmail) {
    try {
      await sendBookingCustomerEmail({
        to: booking.customerEmail,
        tenantName: tenant.name,
        customerName: booking.customerName,
        intakeSummary,
      });
    } catch (error) {
      allSucceeded = false;
      console.error(
        `[booking] customer email failed for booking ${booking.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  await db
    .update(bookings)
    .set({
      emailSentStatus: allSucceeded ? "sent" : "failed",
      emailAttempts: sql`${bookings.emailAttempts} + 1`,
    })
    .where(eq(bookings.id, booking.id));
}

/** First send, dispatched post-response from the webhook via after(). */
export async function sendBookingEmailsAndRecord(
  bookingId: string,
): Promise<void> {
  const [row] = await db
    .select({ booking: bookings, tenant: tenants })
    .from(bookings)
    .innerJoin(tenants, eq(bookings.tenantId, tenants.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) {
    console.error(`[booking] ${bookingId} vanished before email dispatch`);
    return;
  }
  await attemptBookingEmails(row.booking, row.tenant);
}

/**
 * The retry worker (spec, item 5) — invoked by the scheduled route. Picks up
 * failed sends that still have attempts left; anything at the cap stays
 * 'failed' permanently and needs manual attention.
 */
export async function retryFailedBookingEmails(
  batchSize = 25,
): Promise<{ retried: number }> {
  const rows = await db
    .select({ booking: bookings, tenant: tenants })
    .from(bookings)
    .innerJoin(tenants, eq(bookings.tenantId, tenants.id))
    .where(
      and(
        eq(bookings.emailSentStatus, "failed"),
        lt(bookings.emailAttempts, BOOKING_EMAIL_MAX_ATTEMPTS),
      ),
    )
    .limit(batchSize);

  for (const row of rows) {
    await attemptBookingEmails(row.booking, row.tenant);
  }
  return { retried: rows.length };
}
