import { z } from "zod";

/**
 * Pure helpers around tenants.intakeSchema — the per-tenant configuration
 * that says which custom_analysis_data field signals a booking and which
 * fields belong on the booking record. NOTHING here is hardcoded to a
 * vertical: a CPA firm's "service_requested" and a restaurant's "party_size"
 * flow through the same code (spec, Prompt 5 item 1).
 *
 * Expected intakeSchema shape (all parts optional, parsed leniently):
 * {
 *   "bookingIntentField": "is_booking_confirmed",
 *   "fields": [ { "key": "party_size", "label": "Party size", "type": "number" } ],
 *   "customerFieldMap": { "name": "customer_name", "email": "customer_email", "phone": "customer_phone" }
 * }
 */

const intakeSchemaShape = z
  .object({
    bookingIntentField: z.string().min(1).optional(),
    fields: z
      .array(
        z
          .object({
            key: z.string().min(1),
            label: z.string().optional(),
            type: z.string().optional(),
          })
          .loose(),
      )
      .optional(),
    customerFieldMap: z
      .object({
        name: z.string().min(1).optional(),
        email: z.string().min(1).optional(),
        phone: z.string().min(1).optional(),
      })
      .optional(),
  })
  .loose();

export type IntakeSchemaConfig = z.infer<typeof intakeSchemaShape>;

/** Lenient parse: a malformed intakeSchema degrades to {} instead of crashing the webhook. */
export function parseIntakeSchema(raw: unknown): IntakeSchemaConfig {
  const parsed = intakeSchemaShape.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

/**
 * Voice analysis models emit booking flags in many shapes — boolean true,
 * "true", "yes", 1 — treat the documented truthy spellings as intent and
 * everything else (including unknown strings) as no-intent.
 */
export function isBookingIntent(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    return ["true", "yes", "y", "1", "confirmed"].includes(
      value.trim().toLowerCase(),
    );
  }
  return false;
}

function stringField(
  data: Record<string, unknown>,
  key: string | undefined,
  fallbackKey: string,
): string | null {
  const value = data[key ?? fallbackKey];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Customer contact from custom_analysis_data. Keys are configurable per
 * tenant (customerFieldMap) with conventional fallbacks. All nullable by
 * design — voice-captured data is unreliable and a missing name or email
 * must never block the booking row (spec, Prompt 1).
 */
export function extractCustomerContact(
  customData: Record<string, unknown>,
  config: IntakeSchemaConfig,
): { name: string | null; email: string | null; phone: string | null } {
  const map = config.customerFieldMap;
  const email = stringField(customData, map?.email, "customer_email");
  return {
    name: stringField(customData, map?.name, "customer_name"),
    // Loose shape check only — a hallucinated "no email given" string must
    // not end up in a column we later send mail to.
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    phone: stringField(customData, map?.phone, "customer_phone"),
  };
}

/**
 * The intakeData payload for the bookings row: the fields this tenant's
 * schema defines, picked from custom_analysis_data. With no fields
 * configured, keep everything — losing captured data is worse than storing
 * extra keys in a jsonb column.
 */
export function extractIntakeData(
  customData: Record<string, unknown>,
  config: IntakeSchemaConfig,
): Record<string, unknown> {
  const keys = config.fields?.map((f) => f.key) ?? [];
  if (keys.length === 0) return { ...customData };
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in customData) picked[key] = customData[key];
  }
  return picked;
}

/** label/value pairs for email rendering, labels from the tenant's schema. */
export function buildIntakeSummary(
  intakeData: Record<string, unknown>,
  config: IntakeSchemaConfig,
): Array<{ label: string; value: string }> {
  const labelByKey = new Map(
    (config.fields ?? []).map((f) => [f.key, f.label ?? f.key]),
  );
  return Object.entries(intakeData)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => ({
      label: labelByKey.get(key) ?? key,
      value: Array.isArray(value) ? value.join(", ") : String(value),
    }));
}
