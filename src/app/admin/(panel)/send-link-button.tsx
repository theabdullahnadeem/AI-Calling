"use client";

import { useActionState } from "react";

import { sendPaymentLinkAction, type ActionState } from "../actions";

const initialState: ActionState = { ok: false };

export function SendLinkButton({
  tenantId,
  alreadySent,
}: {
  tenantId: string;
  alreadySent: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    sendPaymentLinkAction,
    initialState,
  );

  return (
    <form action={formAction} style={{ display: "inline" }}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <button
        type="submit"
        disabled={pending}
        title={
          alreadySent
            ? "A link was already sent — this sends a fresh one"
            : "Generate a Polar checkout link and email it"
        }
        style={{
          padding: "6px 12px",
          background: alreadySent ? "var(--card)" : "var(--signal)",
          color: alreadySent ? "var(--signal)" : "var(--paper)",
          border: "1px solid var(--signal)",
          borderRadius: 6,
          fontSize: 12,
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.6 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {pending
          ? "Sending…"
          : alreadySent
            ? "Re-send link"
            : "Send payment link"}
      </button>
      {state.error ? (
        <span style={{ color: "var(--alert)", fontSize: 11, marginLeft: 8 }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
