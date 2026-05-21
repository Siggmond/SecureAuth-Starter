"use client";

import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "../lib/api";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await apiFetch<{ message: string }>("/api/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    setMessage(response.message);
  }

  return (
    <main className="form-page">
      <Link className="icon-link" href="/">
        <ArrowLeft aria-hidden="true" size={18} />
        Back
      </Link>
      <form className="auth-panel form-stack" onSubmit={submit}>
        <h1>Reset password</h1>
        <label>
          Email
          <input value={email} type="email" onChange={(event) => setEmail(event.target.value)} required />
        </label>
        {message ? <p className="notice success">{message}</p> : null}
        <button className="primary-action" type="submit">
          <Send aria-hidden="true" size={18} />
          Send reset
        </button>
      </form>
    </main>
  );
}
