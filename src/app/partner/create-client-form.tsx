"use client";

import { useActionState } from "react";

import { createClientAction, type ActionState } from "./actions";

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

export function CreateClientForm() {
  const [state, formAction, pending] = useActionState(
    createClientAction,
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
          Owner email (gets the dashboard login)
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
          Plan (what you pay monthly)
          <select name="selectedTier" required style={inputStyle}>
            <option value="pilot">Pilot — $1,000/mo · 3,000 min</option>
            <option value="standard">Standard — $1,700/mo · 5,600 min</option>
            <option value="pro">Pro — $2,500/mo · 8,150 min</option>
          </select>
        </label>
      </div>
      <label style={{ display: "block", marginTop: 16 }}>
        Intake schema (JSON — defines this client&apos;s booking fields)
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
          Client created — use Pay &amp; activate in the list above to turn it
          on.
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
        {pending ? "Creating…" : "Create client"}
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
