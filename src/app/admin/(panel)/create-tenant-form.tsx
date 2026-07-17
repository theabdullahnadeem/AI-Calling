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

export function CreateTenantForm() {
  const [state, formAction, pending] = useActionState(
    createTenantAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4E4E0",
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
            <option value="pilot">Pilot — $800/mo</option>
            <option value="standard">Standard — $1,500/mo</option>
            <option value="pro">Pro — $2,200/mo</option>
          </select>
        </label>
      </div>
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
        <p style={{ color: "#B3542C", marginTop: 12 }}>{state.error}</p>
      ) : null}
      {state.ok ? (
        <p style={{ color: "#1F6F5C", marginTop: 12 }}>
          Tenant created with status pending_payment.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        style={{
          marginTop: 16,
          padding: "10px 24px",
          background: "#1F6F5C",
          color: "#FAFAF8",
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
  border: "1px solid #C9C9C4",
  borderRadius: 6,
  fontSize: 13,
  boxSizing: "border-box",
};
