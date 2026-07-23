"use client";

import { useActionState } from "react";

import type { ActionState } from "../../../actions";
import { updatePartnerAction } from "../../../partner-actions";

const initialState: ActionState = { ok: false };

export function PartnerBrandingForm({
  partnerId,
  name,
  supportEmail,
  billingEmail,
  accentColor,
}: {
  partnerId: string;
  name: string;
  supportEmail: string;
  billingEmail: string;
  accentColor: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updatePartnerAction,
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
        fontSize: 13,
      }}
    >
      <input type="hidden" name="partnerId" value={partnerId} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <label>
          Brand name
          <input
            name="name"
            required
            maxLength={256}
            defaultValue={name}
            style={inputStyle}
          />
        </label>
        <label>
          Accent color (hex, blank for default)
          <input
            name="accentColor"
            maxLength={7}
            defaultValue={accentColor ?? ""}
            placeholder="#1F6F5C"
            pattern="#[0-9a-fA-F]{6}"
            style={{ ...inputStyle, fontFamily: "monospace" }}
          />
        </label>
        <label>
          Support email
          <input
            name="supportEmail"
            type="email"
            required
            maxLength={256}
            defaultValue={supportEmail}
            style={inputStyle}
          />
        </label>
        <label>
          Billing email
          <input
            name="billingEmail"
            type="email"
            required
            maxLength={256}
            defaultValue={billingEmail}
            style={inputStyle}
          />
        </label>
      </div>
      {state.error ? (
        <p style={{ color: "var(--alert)", marginTop: 12 }}>{state.error}</p>
      ) : null}
      {state.ok ? (
        <p style={{ color: "var(--signal)", marginTop: 12 }}>Saved.</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        style={{
          marginTop: 16,
          padding: "8px 20px",
          background: "var(--signal)",
          color: "var(--on-accent)",
          border: "none",
          borderRadius: 6,
          fontSize: 13,
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Saving…" : "Save branding"}
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
