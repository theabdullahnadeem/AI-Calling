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
    <form onSubmit={handleSubmit} className="ui-card">
      <h1 className="ui-title" style={{ marginBottom: 8 }}>
        Set your password
      </h1>
      <p className="ui-hint">
        At least 12 characters. A password manager&apos;s suggestion works
        well.
      </p>
      <label className="ui-label">New password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={12}
        maxLength={128}
        autoComplete="new-password"
        className="ui-input"
      />
      <label className="ui-label">Confirm password</label>
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
        className="ui-input"
      />
      {error ? <p className="ui-error">{error}</p> : null}
      <button type="submit" disabled={pending} className="ui-btn-primary">
        {pending ? "Saving…" : "Save password and log in"}
      </button>
    </form>
  );
}
