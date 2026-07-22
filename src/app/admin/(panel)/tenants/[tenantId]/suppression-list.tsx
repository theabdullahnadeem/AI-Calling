"use client";

import { useActionState } from "react";

import {
  addSuppressedNumberAction,
  removeSuppressedNumberAction,
  type ActionState,
} from "../../../actions";

const initialState: ActionState = { ok: false };

export function SuppressionList({
  tenantId,
  entries,
}: {
  tenantId: string;
  entries: Array<{ id: string; phoneNumber: string; addedAt: string }>;
}) {
  const [addState, addAction, addPending] = useActionState(
    addSuppressedNumberAction,
    initialState,
  );
  const [, removeAction, removePending] = useActionState(
    removeSuppressedNumberAction,
    initialState,
  );

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        padding: 20,
        fontSize: 13,
      }}
    >
      <form action={addAction} style={{ display: "flex", gap: 8 }}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <input
          name="phoneNumber"
          placeholder="+15551234567"
          required
          style={{
            flex: 1,
            padding: "8px 10px",
            border: "1px solid var(--input-border)",
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "monospace",
            background: "var(--input-bg)",
            color: "var(--ink)",
          }}
        />
        <button
          type="submit"
          disabled={addPending}
          style={{
            padding: "8px 16px",
            background: "var(--ink)",
            color: "var(--on-accent)",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            cursor: addPending ? "default" : "pointer",
          }}
        >
          {addPending ? "Adding…" : "Add number"}
        </button>
      </form>
      {addState.error ? (
        <p style={{ color: "var(--alert)", marginTop: 10, marginBottom: 0 }}>
          {addState.error}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p style={{ color: "var(--slate)", marginTop: 16, marginBottom: 0 }}>
          No suppressed numbers for this tenant yet.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                <td
                  style={{
                    padding: "8px 0",
                    fontFamily: "monospace",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {entry.phoneNumber}
                </td>
                <td style={{ padding: "8px 0", color: "var(--slate)" }}>
                  added {entry.addedAt.slice(0, 10)}
                </td>
                <td style={{ padding: "8px 0", textAlign: "right" }}>
                  <form action={removeAction} style={{ display: "inline" }}>
                    <input type="hidden" name="tenantId" value={tenantId} />
                    <input type="hidden" name="id" value={entry.id} />
                    <button
                      type="submit"
                      disabled={removePending}
                      style={{
                        padding: "4px 12px",
                        background: "var(--card)",
                        color: "var(--alert)",
                        border: "1px solid var(--line)",
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: removePending ? "default" : "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
