"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="dv-rail-link"
      style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", font: "inherit" }}
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      <RailIcon path="M9 3H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h5M13 13l3-3-3-3M7 10h9" />
      Sign out
    </button>
  );
}

export function RailIcon({ path }: { path: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}
