"use client";

import { useActionState } from "react";

import { createTenantAction, type ActionState } from "../actions";

const INTAKE_SCHEMA_PLACEHOLDER = JSON.stringify(
  {
    fields: [
      { key: "party_size", label: "Party size", type: "number" },
      { key: "order_items", label: "Order items", type: "text" },
    ],
    bookingIntentField: "is_booking_confirmed",
  },
  null,
  2,
);

const initialState: ActionState = { ok: false };

// Two label sets for the tier picker: staff admins never see dollar amounts
// (tier names + minute caps stay visible — that's the boundary the
// staff_admin role draws).
const TIER_LABELS_WITH_PRICING = {
  pilot: "Pilot — $1,000/mo · 3,000 min",
  standard: "Standard — $1,700/mo · 5,600 min",
  pro: "Pro — $2,500/mo · 8,150 min",
} as const;

const TIER_LABELS_WITHOUT_PRICING = {
  pilot: "Pilot — 3,000 min/mo",
  standard: "Standard — 5,600 min/mo",
  pro: "Pro — 8,150 min/mo",
} as const;

export function CreateTenantForm({ showPricing }: { showPricing: boolean }) {
  const tierLabels = showPricing
    ? TIER_LABELS_WITH_PRICING
    : TIER_LABELS_WITHOUT_PRICING;
  const [state, formAction, pending] = useActionState(
    createTenantAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        padding: 24,
        maxWidth: 620,
        fontSize: 13,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <label>
          Business name
          <input name="name" required maxLength={256} style={inputStyle} />
        </label>
        <label>
          Owner email
          <input
            name="ownerEmail"
            type="email"
            required
            maxLength={256}
            style={inputStyle}
          />
        </label>
        <label>
          Business type (snake_case)
          <input
            name="businessType"
            required
            placeholder="restaurant, cpa_firm…"
            pattern="[a-z0-9_]{1,64}"
            style={inputStyle}
          />
        </label>
        <label>
          Tier
          <select name="selectedTier" required style={inputStyle}>
            <option value="pilot">{tierLabels.pilot}</option>
            <option value="standard">{tierLabels.standard}</option>
            <option value="pro">{tierLabels.pro}</option>
          </select>
        </label>
        <label>
          Retell agent ID (optional — set later once the agent exists)
          <input
            name="retellAgentId"
            maxLength={128}
            placeholder="agent_…"
            style={{ ...inputStyle, fontFamily: "monospace" }}
          />
        </label>
      </div>
      <label style={{ display: "block", marginTop: 16 }}>
        Consent basis (optional — how this tenant obtains calling consent;
        required before outbound calling can ever be enabled)
        <textarea
          name="consentBasis"
          rows={2}
          maxLength={2000}
          placeholder='e.g. "Customers opt in to follow-up calls on the booking form."'
          style={inputStyle}
        />
      </label>
      <label style={{ display: "block", marginTop: 16 }}>
        Intake schema (JSON — defines this tenant&apos;s booking fields)
        <textarea
          name="intakeSchema"
          required
          rows={8}
          defaultValue={INTAKE_SCHEMA_PLACEHOLDER}
          style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12 }}
        />
      </label>
      {state.error ? (
        <p style={{ color: "var(--alert)", marginTop: 12 }}>{state.error}</p>
      ) : null}
      {state.ok ? (
        <p style={{ color: "var(--signal)", marginTop: 12 }}>
          Tenant created with status pending_payment.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        style={{
          marginTop: 16,
          padding: "10px 24px",
          background: "var(--signal)",
          color: "var(--on-accent)",
          border: "none",
          borderRadius: 6,
          fontSize: 14,
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Creating…" : "Create tenant"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "8px 10px",
  border: "1px solid var(--input-border)",
  borderRadius: 6,
  fontSize: 13,
  boxSizing: "border-box",
  background: "var(--input-bg)",
  color: "var(--ink)",
};
