"use client";

import { useActionState } from "react";

import type { ActionState } from "../../actions";
import { createStaffAction } from "../../staff-actions";

const initialState: ActionState = { ok: false };

export function CreateStaffForm() {
  const [state, formAction, pending] = useActionState(
    createStaffAction,
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
        maxWidth: 480,
        fontSize: 13,
      }}
    >
      <label>
        Email
        <input
          name="email"
          type="email"
          required
          maxLength={256}
          placeholder="teammate@example.com"
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
      <p style={{ color: "var(--slate)", fontSize: 12, margin: "8px 0 0" }}>
        They&apos;ll get a set-password link by email — valid 48 hours, single
        use.
      </p>
      {state.error ? (
        <p style={{ color: "var(--alert)", marginTop: 12 }}>{state.error}</p>
      ) : null}
      {state.ok ? (
        <p style={{ color: "var(--signal)", marginTop: 12 }}>
          Invite sent.
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
        {pending ? "Inviting…" : "Send invite"}
      </button>
    </form>
  );
}
