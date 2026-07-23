"use client";

import { useActionState } from "react";

import type { ActionState } from "../../../actions";
import {
  invitePartnerAdminAction,
  removePartnerAdminAction,
  resendPartnerInviteAction,
} from "../../../partner-actions";

const initialState: ActionState = { ok: false };

export function PartnerAdmins({
  partnerId,
  admins,
}: {
  partnerId: string;
  admins: Array<{
    id: string;
    email: string;
    active: boolean;
    createdAt: string;
  }>;
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(
    invitePartnerAdminAction,
    initialState,
  );

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        padding: 24,
        fontSize: 13,
      }}
    >
      {admins.length === 0 ? (
        <p style={{ color: "var(--slate)", margin: "0 0 16px" }}>
          No partner admins yet — invite the first one below.
        </p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: 16,
          }}
        >
          <tbody>
            {admins.map((admin) => (
              <AdminRow key={admin.id} partnerId={partnerId} admin={admin} />
            ))}
          </tbody>
        </table>
      )}

      <form
        action={inviteAction}
        style={{ display: "flex", gap: 12, alignItems: "flex-end" }}
      >
        <input type="hidden" name="partnerId" value={partnerId} />
        <label style={{ flex: 1 }}>
          Invite partner admin
          <input
            name="email"
            type="email"
            required
            maxLength={256}
            placeholder="owner@partnerbrand.com"
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
        <button
          type="submit"
          disabled={invitePending}
          style={{
            padding: "8px 20px",
            background: "var(--signal)",
            color: "var(--on-accent)",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            cursor: invitePending ? "default" : "pointer",
            opacity: invitePending ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {invitePending ? "Inviting…" : "Send invite"}
        </button>
      </form>
      {inviteState.error ? (
        <p style={{ color: "var(--alert)", margin: "12px 0 0" }}>
          {inviteState.error}
        </p>
      ) : null}
      {inviteState.ok ? (
        <p style={{ color: "var(--signal)", margin: "12px 0 0" }}>
          Invite sent.
        </p>
      ) : null}
    </div>
  );
}

function AdminRow({
  partnerId,
  admin,
}: {
  partnerId: string;
  admin: { id: string; email: string; active: boolean; createdAt: string };
}) {
  const [resendState, resendAction, resendPending] = useActionState(
    resendPartnerInviteAction,
    initialState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removePartnerAdminAction,
    initialState,
  );
  const error = resendState.error ?? removeState.error;

  return (
    <tr style={{ borderBottom: "1px solid var(--line-soft)" }}>
      <td style={{ padding: "8px 12px 8px 0", fontWeight: 500 }}>
        {admin.email}
      </td>
      <td style={{ padding: "8px 12px" }}>
        <span
          style={{
            color: admin.active ? "var(--signal)" : "var(--slate)",
            fontWeight: 600,
          }}
        >
          {admin.active ? "active" : "invite pending"}
        </span>
      </td>
      <td
        style={{
          padding: "8px 12px",
          color: "var(--slate)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {admin.createdAt}
      </td>
      <td style={{ padding: "8px 0", whiteSpace: "nowrap", textAlign: "right" }}>
        <form action={resendAction} style={{ display: "inline" }}>
          <input type="hidden" name="partnerId" value={partnerId} />
          <input type="hidden" name="userId" value={admin.id} />
          <button
            type="submit"
            disabled={resendPending}
            style={{
              padding: "6px 12px",
              background: "var(--card)",
              color: "var(--signal)",
              border: "1px solid var(--signal)",
              borderRadius: 6,
              fontSize: 12,
              cursor: resendPending ? "default" : "pointer",
              opacity: resendPending ? 0.6 : 1,
              marginRight: 8,
            }}
          >
            {resendPending
              ? "Sending…"
              : admin.active
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
                `Remove partner admin ${admin.email}? They lose panel access immediately.`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="partnerId" value={partnerId} />
          <input type="hidden" name="userId" value={admin.id} />
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
            }}
          >
            {removePending ? "Removing…" : "Remove"}
          </button>
        </form>
        {error ? (
          <span
            style={{ color: "var(--alert)", fontSize: 11, marginLeft: 8 }}
          >
            {error}
          </span>
        ) : null}
      </td>
    </tr>
  );
}
