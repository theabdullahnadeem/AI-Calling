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
    <form onSubmit={handleSubmit} className="ui-card">
      <h1 className="ui-title">Digivixo Admin</h1>
      <label className="ui-label">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        className="ui-input"
      />
      <label className="ui-label">Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
        className="ui-input"
      />
      {error ? <p className="ui-error">{error}</p> : null}
      <button type="submit" disabled={pending} className="ui-btn-primary">
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
