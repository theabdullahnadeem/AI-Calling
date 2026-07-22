"use client";

import { useActionState } from "react";

import { updateComplianceAction, type ActionState } from "../../../actions";

const initialState: ActionState = { ok: false };

export function ComplianceForm({
  tenantId,
  outboundCallingEnabled,
  consentBasis,
}: {
  tenantId: string;
  outboundCallingEnabled: boolean;
  consentBasis: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateComplianceAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        padding: 20,
        fontSize: 13,
      }}
    >
      <input type="hidden" name="tenantId" value={tenantId} />
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          name="outboundCallingEnabled"
          defaultChecked={outboundCallingEnabled}
        />
        Outbound calling enabled for this tenant
      </label>
      <label style={{ display: "block", marginTop: 16 }}>
        Consent basis (how this tenant obtains calling consent)
        <textarea
          name="consentBasis"
          rows={3}
          defaultValue={consentBasis ?? ""}
          placeholder='e.g. "Customers opt in to follow-up calls on the booking form."'
          maxLength={2000}
          style={{
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
          }}
        />
      </label>
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
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
