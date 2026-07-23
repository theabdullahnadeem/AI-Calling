"use client";

import { useActionState } from "react";

import type { ActionState } from "../../actions";
import {
  removeStaffAction,
  resendStaffInviteAction,
} from "../../staff-actions";

const initialState: ActionState = { ok: false };

export function StaffRowActions({
  staffId,
  email,
  isActive,
}: {
  staffId: string;
  email: string;
  isActive: boolean;
}) {
  const [resendState, resendAction, resendPending] = useActionState(
    resendStaffInviteAction,
    initialState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeStaffAction,
    initialState,
  );

  const error = resendState.error ?? removeState.error;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <form action={resendAction} style={{ display: "inline" }}>
        <input type="hidden" name="staffId" value={staffId} />
        <button
          type="submit"
          disabled={resendPending}
          title={
            isActive
              ? "Sends a set-password link that replaces their current password when used"
              : "Sends a fresh invite link (invalidates the previous one)"
          }
          style={{
            padding: "6px 12px",
            background: "var(--card)",
            color: "var(--signal)",
            border: "1px solid var(--signal)",
            borderRadius: 6,
            fontSize: 12,
            cursor: resendPending ? "default" : "pointer",
            opacity: resendPending ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {resendPending
            ? "Sending…"
            : isActive
              ? "Send reset link"
              : "Resend invite"}
        </button>
      </form>
      <form
        action={removeAction}
        style={{ display: "inline" }}
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Remove staff account ${email}? They lose panel access immediately.`,
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="staffId" value={staffId} />
        <button
          type="submit"
          disabled={removePending}
          style={{
            padding: "6px 12px",
            background: "var(--card)",
            color: "var(--alert)",
            border: "1px solid var(--alert)",
            borderRadius: 6,
            fontSize: 12,
            cursor: removePending ? "default" : "pointer",
            opacity: removePending ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {removePending ? "Removing…" : "Remove"}
        </button>
      </form>
      {error ? (
        <span style={{ color: "var(--alert)", fontSize: 11 }}>{error}</span>
      ) : null}
    </span>
  );
}
