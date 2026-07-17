"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("Invalid email or password.");
      setPending(false);
      return;
    }
    // Non-admin credentials land on /admin and get a 404 from the guard —
    // the panel's existence is never confirmed to them.
    router.push("/admin");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        width: 360,
        padding: 32,
        background: "#FFFFFF",
        borderRadius: 6,
        fontFamily:
          "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: "#161B22",
      }}
    >
      <h1 style={{ fontSize: 20, margin: "0 0 24px" }}>Digivixo Admin</h1>
      <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
        Email
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        style={inputStyle}
      />
      <label style={{ display: "block", fontSize: 13, margin: "16px 0 4px" }}>
        Password
      </label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
        style={inputStyle}
      />
      {error ? (
        <p style={{ color: "#B3542C", fontSize: 13, marginTop: 12 }}>{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        style={{
          marginTop: 24,
          width: "100%",
          padding: "10px 0",
          background: "#161B22",
          color: "#FAFAF8",
          border: "none",
          borderRadius: 6,
          fontSize: 14,
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #C9C9C4",
  borderRadius: 6,
  fontSize: 14,
  boxSizing: "border-box",
};
