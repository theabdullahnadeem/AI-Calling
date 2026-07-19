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
          border: "1px solid #C9C9C4",
          borderRadius: 6,
          fontSize: 12,
          fontFamily: "monospace",
        }}
      />
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: "4px 10px",
          background: "#FFFFFF",
          color: "#161B22",
          border: "1px solid #C9C9C4",
          borderRadius: 6,
          fontSize: 12,
          cursor: pending ? "default" : "pointer",
        }}
      >
        {pending ? "…" : "Save"}
      </button>
      {state.error ? (
        <span style={{ color: "#B3542C", fontSize: 11, alignSelf: "center" }}>
          {state.error}
        </span>
      ) : null}
      {state.ok ? (
        <span style={{ color: "#1F6F5C", fontSize: 11, alignSelf: "center" }}>
          Saved
        </span>
      ) : null}
    </form>
  );
}
