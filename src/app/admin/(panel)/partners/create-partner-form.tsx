"use client";

import { useActionState } from "react";

import type { ActionState } from "../../actions";
import { createPartnerAction } from "../../partner-actions";

const initialState: ActionState = { ok: false };

export function CreatePartnerForm() {
  const [state, formAction, pending] = useActionState(
    createPartnerAction,
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
          Brand name (what their clients see)
          <input name="name" required maxLength={256} style={inputStyle} />
        </label>
        <label>
          Accent color (optional, hex)
          <input
            name="accentColor"
            maxLength={7}
            placeholder="#1F6F5C"
            pattern="#[0-9a-fA-F]{6}"
            style={{ ...inputStyle, fontFamily: "monospace" }}
          />
        </label>
        <label>
          Support email (shown to their clients)
          <input
            name="supportEmail"
            type="email"
            required
            maxLength={256}
            style={inputStyle}
          />
        </label>
        <label>
          Billing email (receives Polar receipts)
          <input
            name="billingEmail"
            type="email"
            required
            maxLength={256}
            style={inputStyle}
          />
        </label>
      </div>
      {state.error ? (
        <p style={{ color: "var(--alert)", marginTop: 12 }}>{state.error}</p>
      ) : null}
      {state.ok ? (
        <p style={{ color: "var(--signal)", marginTop: 12 }}>
          Partner created — open Manage to upload a logo and invite their
          admin.
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
        {pending ? "Creating…" : "Create partner"}
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
