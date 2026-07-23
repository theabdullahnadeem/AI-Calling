"use client";

import { signOut } from "next-auth/react";

export function PartnerSignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      style={{
        background: "none",
        border: "1px solid var(--rail-fg-muted)",
        color: "var(--rail-fg)",
        borderRadius: 6,
        padding: "6px 14px",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
