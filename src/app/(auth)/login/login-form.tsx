"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginForm() {
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
      // One message for every failure cause — including "this tenant hasn't
      // paid yet, so no account exists". No account enumeration. The single
      // exception is the rate limit, which would otherwise masquerade as a
      // wrong password and send a legitimate user hunting for a typo.
      setError(
        result.code === "rate_limited"
          ? "Too many attempts — wait a few minutes, then try again."
          : "Invalid email or password.",
      );
      setPending(false);
      return;
    }
    router.push("/post-login");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="ui-card">
      <h1 className="ui-title">Log in to Digivixo</h1>
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
