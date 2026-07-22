# Intake Schema Reference

**A practical reference for onboarding — not part of the original numbered
spec (files 01–06).** Use this when creating a tenant in `/admin` to decide
what goes in the "intake schema" field.

---

## What the intake schema is, in one line

The other fields on the create-tenant form describe **the business**. The
intake schema describes **what the AI agent should write down during that
business's calls** — and it becomes the columns on that client's booking
table in the dashboard.

Same platform, different clipboard: a restaurant's clipboard has *party
size* and *order items*; a CPA firm's has *service requested* and *urgency*.

## The shape

```json
{
  "bookingIntentField": "is_booking_confirmed",
  "fields": [
    { "key": "party_size", "label": "Party size", "type": "number" },
    { "key": "order_items", "label": "Order items", "type": "text" }
  ],
  "customerFieldMap": {
    "name": "customer_name",
    "email": "customer_email",
    "phone": "customer_phone"
  }
}
```

- **`bookingIntentField`** — the name of the yes/no field that answers "did
  this caller actually book?". When the agent fills it truthy, a booking row
  is created. Truthy values recognised: `true`, `"true"`, `"yes"`, `"y"`,
  `"1"`, `1`, `"confirmed"`.
- **`fields`** — one entry per thing to capture. `key` is the internal name,
  `label` is the column heading the client sees, `type` is a hint
  (`text` / `number`) for display.
- **`customerFieldMap`** — *optional*. Maps the caller's contact details to
  the field names your agent uses. Omit it entirely if your agent uses the
  conventional `customer_name` / `customer_email` / `customer_phone`.

## The one rule that trips people up

**Every `key` (and the `bookingIntentField` name) must be spelled *exactly*
the same as the corresponding field you create in the Retell agent's
post-call analysis.** That spelling is the wire between what the AI wrote
down and what shows on the dashboard. A mismatch means the column renders
empty — no error, just blank.

For every agent, in Retell's post-call analysis, always add these three
standard contact fields as well (the app reads them for the booking's
customer details):

- `customer_name`
- `customer_email`
- `customer_phone`

---

## Ready-to-use schemas by business type

Copy the JSON straight into the admin form. Adjust fields to taste.

### Restaurant
```json
{
  "bookingIntentField": "is_booking_confirmed",
  "fields": [
    { "key": "party_size", "label": "Party size", "type": "number" },
    { "key": "reservation_time", "label": "Date & time", "type": "text" },
    { "key": "order_items", "label": "Order items", "type": "text" },
    { "key": "pickup_or_delivery", "label": "Pickup / delivery / dine-in", "type": "text" },
    { "key": "special_requests", "label": "Special requests", "type": "text" }
  ]
}
```

### CPA / accounting firm
```json
{
  "bookingIntentField": "consultation_requested",
  "fields": [
    { "key": "service_requested", "label": "Service requested", "type": "text" },
    { "key": "entity_type", "label": "Individual / business", "type": "text" },
    { "key": "urgency", "label": "Urgency / deadline", "type": "text" },
    { "key": "preferred_time", "label": "Preferred appointment", "type": "text" }
  ]
}
```

### Dental / medical clinic
```json
{
  "bookingIntentField": "appointment_requested",
  "fields": [
    { "key": "reason_for_visit", "label": "Reason for visit", "type": "text" },
    { "key": "new_or_returning", "label": "New / returning patient", "type": "text" },
    { "key": "insurance_provider", "label": "Insurance", "type": "text" },
    { "key": "preferred_time", "label": "Preferred appointment", "type": "text" }
  ]
}
```

### Salon / spa
```json
{
  "bookingIntentField": "appointment_requested",
  "fields": [
    { "key": "service_requested", "label": "Service", "type": "text" },
    { "key": "stylist_preference", "label": "Stylist preference", "type": "text" },
    { "key": "preferred_time", "label": "Preferred date & time", "type": "text" }
  ]
}
```

### Law firm
```json
{
  "bookingIntentField": "consultation_requested",
  "fields": [
    { "key": "matter_type", "label": "Matter type", "type": "text" },
    { "key": "case_summary", "label": "Brief summary", "type": "text" },
    { "key": "urgency", "label": "Urgency", "type": "text" },
    { "key": "preferred_time", "label": "Preferred consultation", "type": "text" }
  ]
}
```

### Home services (plumbing / HVAC / electrical)
```json
{
  "bookingIntentField": "job_booked",
  "fields": [
    { "key": "service_type", "label": "Service needed", "type": "text" },
    { "key": "issue_description", "label": "Problem description", "type": "text" },
    { "key": "service_address", "label": "Service address", "type": "text" },
    { "key": "is_emergency", "label": "Emergency?", "type": "text" },
    { "key": "preferred_time", "label": "Preferred time", "type": "text" }
  ]
}
```

### Real estate
```json
{
  "bookingIntentField": "showing_requested",
  "fields": [
    { "key": "property_interest", "label": "Property / area", "type": "text" },
    { "key": "buy_or_rent", "label": "Buying / renting / selling", "type": "text" },
    { "key": "budget", "label": "Budget", "type": "text" },
    { "key": "preferred_time", "label": "Preferred viewing", "type": "text" }
  ]
}
```

### Auto repair / dealership service
```json
{
  "bookingIntentField": "service_booked",
  "fields": [
    { "key": "vehicle", "label": "Vehicle (make / model / year)", "type": "text" },
    { "key": "service_type", "label": "Service needed", "type": "text" },
    { "key": "issue_description", "label": "Symptoms / description", "type": "text" },
    { "key": "preferred_time", "label": "Preferred drop-off", "type": "text" }
  ]
}
```

### Fitness studio / gym
```json
{
  "bookingIntentField": "trial_or_class_booked",
  "fields": [
    { "key": "interest", "label": "Membership / class / personal training", "type": "text" },
    { "key": "experience_level", "label": "Experience level", "type": "text" },
    { "key": "preferred_time", "label": "Preferred time", "type": "text" }
  ]
}
```

---

## Building a schema for any other vertical

1. Ask: *"When this business books someone, what 3–6 things do they write
   down?"* Make each one a field.
2. Keep it lean. Voice calls capture fewer details reliably than a web form —
   five focused fields beat twelve half-filled ones.
3. Always include a booking-intent flag as `bookingIntentField`.
4. Whatever field `key`s you choose, create matching fields (same spelling)
   in the Retell agent's post-call analysis, plus the three standard
   `customer_*` contact fields.

If a vertical is unusual, start from the closest example above and rename the
fields — the structure is always the same.
