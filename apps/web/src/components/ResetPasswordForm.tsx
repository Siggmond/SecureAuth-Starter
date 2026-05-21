"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, KeyRound } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "../lib/api";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const response = await apiFetch<{ message: string }>("/api/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, password })
      });
      setMessage(response.message);
    } catch {
      setError("Reset link is invalid or expired.");
    }
  }

  return (
    <main className="form-page">
      <Link className="icon-link" href="/">
        <ArrowLeft aria-hidden="true" size={18} />
        Back
      </Link>
      <form className="auth-panel form-stack" onSubmit={submit}>
        <h1>Choose new password</h1>
        <label>
          New password
          <input value={password} type="password" minLength={12} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {message ? <p className="notice success">{message}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
        <button className="primary-action" type="submit" disabled={!token}>
          <KeyRound aria-hidden="true" size={18} />
          Update password
        </button>
      </form>
    </main>
  );
}
