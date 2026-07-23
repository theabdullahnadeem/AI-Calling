"use client";

import { useActionState } from "react";

import type { ActionState } from "../../../actions";
import { uploadPartnerLogoAction } from "../../../partner-actions";

const initialState: ActionState = { ok: false };

export function PartnerLogoForm({ partnerId }: { partnerId: string }) {
  const [state, formAction, pending] = useActionState(
    uploadPartnerLogoAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}
    >
      <input type="hidden" name="partnerId" value={partnerId} />
      <input
        type="file"
        name="logo"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        required
        style={{ fontSize: 13, color: "var(--ink)" }}
      />
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: "8px 20px",
          background: "var(--signal)",
          color: "var(--on-accent)",
          border: "none",
          borderRadius: 6,
          fontSize: 13,
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.7 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {pending ? "Uploading…" : "Upload logo"}
      </button>
      {state.error ? (
        <span style={{ color: "var(--alert)", fontSize: 12 }}>
          {state.error}
        </span>
      ) : null}
      {state.ok ? (
        <span style={{ color: "var(--signal)", fontSize: 12 }}>Uploaded.</span>
      ) : null}
    </form>
  );
}
