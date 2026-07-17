"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

export function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    setPending(true);
    const response = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      email?: string;
      error?: string;
    };

    if (!response.ok || !data.ok || !data.email) {
      setError(data.error ?? "Something went wrong. Try again.");
      setPending(false);
      return;
    }

    // Token is now consumed and the password stored — sign in with it.
    const result = await signIn("credentials", {
      email: data.email,
      password,
      redirect: false,
    });
    if (result?.error) {
      // Password is set; the session just didn't start. Send them to login.
      router.push("/login");
      return;
    }
    router.push("/post-login");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        width: 360,
        padding: 32,
        background: "#FFFFFF",
        border: "1px solid #E4E4E0",
        borderRadius: 6,
        color: "#161B22",
      }}
    >
      <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Set your password</h1>
      <p style={{ fontSize: 13, color: "#5B6472", margin: "0 0 24px" }}>
        At least 12 characters. A password manager's suggestion works well.
      </p>
      <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>
        New password
      </label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={12}
        maxLength={128}
        autoComplete="new-password"
        style={inputStyle}
      />
      <label style={{ display: "block", fontSize: 13, margin: "16px 0 4px" }}>
        Confirm password
      </label>
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
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
          background: "#1F6F5C",
          color: "#FAFAF8",
          border: "none",
          borderRadius: 6,
          fontSize: 14,
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Saving…" : "Save password and log in"}
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
