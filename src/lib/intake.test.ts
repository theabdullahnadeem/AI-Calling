import { describe, expect, it } from "vitest";

import {
  buildIntakeSummary,
  extractCustomerContact,
  extractIntakeData,
  isBookingIntent,
  parseIntakeSchema,
} from "./intake";

const restaurantSchema = parseIntakeSchema({
  bookingIntentField: "is_booking_confirmed",
  fields: [
    { key: "party_size", label: "Party size", type: "number" },
    { key: "order_items", label: "Order items", type: "text" },
  ],
});

describe("parseIntakeSchema", () => {
  it("degrades malformed schemas to {} instead of throwing", () => {
    expect(parseIntakeSchema("not an object")).toEqual({});
    expect(parseIntakeSchema(null)).toEqual({});
    expect(parseIntakeSchema({ fields: "wrong type" })).toEqual({});
  });

  it("keeps the configured intent field and fields", () => {
    expect(restaurantSchema.bookingIntentField).toBe("is_booking_confirmed");
    expect(restaurantSchema.fields).toHaveLength(2);
  });
});

describe("isBookingIntent", () => {
  it("accepts the documented truthy spellings", () => {
    expect(isBookingIntent(true)).toBe(true);
    expect(isBookingIntent("true")).toBe(true);
    expect(isBookingIntent("Yes")).toBe(true);
    expect(isBookingIntent("1")).toBe(true);
    expect(isBookingIntent(1)).toBe(true);
    expect(isBookingIntent("confirmed")).toBe(true);
  });

  it("treats everything else as no intent", () => {
    expect(isBookingIntent(false)).toBe(false);
    expect(isBookingIntent("no")).toBe(false);
    expect(isBookingIntent("maybe later")).toBe(false);
    expect(isBookingIntent(undefined)).toBe(false);
    expect(isBookingIntent(null)).toBe(false);
    expect(isBookingIntent({})).toBe(false);
  });
});

describe("extractCustomerContact", () => {
  it("uses conventional keys by default", () => {
    const contact = extractCustomerContact(
      {
        customer_name: "Jordan Li",
        customer_email: "jordan@example.com",
        customer_phone: "+15551234567",
      },
      restaurantSchema,
    );
    expect(contact).toEqual({
      name: "Jordan Li",
      email: "jordan@example.com",
      phone: "+15551234567",
    });
  });

  it("respects a tenant's customerFieldMap overrides", () => {
    const config = parseIntakeSchema({
      customerFieldMap: { name: "caller", email: "caller_mail" },
    });
    const contact = extractCustomerContact(
      { caller: "Sam", caller_mail: "sam@example.com" },
      config,
    );
    expect(contact.name).toBe("Sam");
    expect(contact.email).toBe("sam@example.com");
  });

  it("nulls everything missing — voice data must not break inserts", () => {
    expect(extractCustomerContact({}, restaurantSchema)).toEqual({
      name: null,
      email: null,
      phone: null,
    });
  });

  it("rejects non-email strings captured into the email field", () => {
    const contact = extractCustomerContact(
      { customer_email: "did not give an email" },
      restaurantSchema,
    );
    expect(contact.email).toBeNull();
  });
});

describe("extractIntakeData", () => {
  it("picks only the tenant's configured fields", () => {
    const data = extractIntakeData(
      {
        party_size: 4,
        order_items: ["salmon", "risotto"],
        internal_debug: "noise",
      },
      restaurantSchema,
    );
    expect(data).toEqual({
      party_size: 4,
      order_items: ["salmon", "risotto"],
    });
  });

  it("keeps everything when no fields are configured", () => {
    const data = extractIntakeData({ a: 1, b: 2 }, parseIntakeSchema({}));
    expect(data).toEqual({ a: 1, b: 2 });
  });
});

describe("buildIntakeSummary", () => {
  it("renders labels from the schema and stringifies values", () => {
    const summary = buildIntakeSummary(
      { party_size: 4, order_items: ["salmon", "risotto"] },
      restaurantSchema,
    );
    expect(summary).toEqual([
      { label: "Party size", value: "4" },
      { label: "Order items", value: "salmon, risotto" },
    ]);
  });

  it("falls back to the raw key for unlabeled fields and skips nulls", () => {
    const summary = buildIntakeSummary(
      { pickup_time: "7pm", missing: null },
      parseIntakeSchema({}),
    );
    expect(summary).toEqual([{ label: "pickup_time", value: "7pm" }]);
  });
});
