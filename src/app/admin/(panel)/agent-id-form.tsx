"use client";

import { useActionState } from "react";

import { setRetellAgentIdAction, type ActionState } from "../actions";

const initialState: ActionState = { ok: false };

/**
 * Inline per-tenant Retell agent mapping. Until this is set, that tenant's
 * webhooks land in the dead-letter list instead of the dashboard.
 */
export function AgentIdForm({
  tenantId,
  currentAgentId,
}: {
  tenantId: string;
  currentAgentId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    setRetellAgentIdAction,
    initialState,
  );

  return (
    <form action={formAction} style={{ display: "flex", gap: 6 }}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input
        name="retellAgentId"
        defaultValue={currentAgentId ?? ""}
        placeholder="agent_…"
        maxLength={128}
        style={{
          width: 150,
          padding: "4px 8px",
          border: "1px solid var(--input-border)",
          borderRadius: 6,
          fontSize: 12,
          fontFamily: "monospace",
          background: "var(--input-bg)",
          color: "var(--ink)",
        }}
      />
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: "4px 10px",
          background: "var(--card)",
          color: "var(--ink)",
          border: "1px solid var(--input-border)",
          borderRadius: 6,
          fontSize: 12,
          cursor: pending ? "default" : "pointer",
        }}
      >
        {pending ? "…" : "Save"}
      </button>
      {state.error ? (
        <span style={{ color: "var(--alert)", fontSize: 11, alignSelf: "center" }}>
          {state.error}
        </span>
      ) : null}
      {state.ok ? (
        <span style={{ color: "var(--signal)", fontSize: 11, alignSelf: "center" }}>
          Saved
        </span>
      ) : null}
    </form>
  );
}
