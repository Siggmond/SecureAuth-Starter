"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, MailCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { apiFetch, ApiError, rememberCsrfToken } from "../lib/api";

type Mode = "login" | "register";

type LoginResponse = {
  csrfToken: string;
};

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const response = await apiFetch<LoginResponse>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        rememberCsrfToken(response.csrfToken);
        router.push("/dashboard");
        return;
      }

      const response = await apiFetch<{ message: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, name, password })
      });
      setStatus(response.message);
      setPassword("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Request failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-panel" aria-label="Authentication">
      <div className="segmented" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
        >
          <LogIn aria-hidden="true" size={18} />
          Login
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={mode === "register" ? "active" : ""}
          onClick={() => setMode("register")}
        >
          <UserPlus aria-hidden="true" size={18} />
          Register
        </button>
      </div>

      <form onSubmit={submit} className="form-stack">
        <h2>{mode === "login" ? "Welcome back" : "Create account"}</h2>
        {mode === "register" ? (
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
          </label>
        ) : null}
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={12}
            required
          />
        </label>
        {error ? <p className="notice error">{error}</p> : null}
        {status ? <p className="notice success">{status}</p> : null}
        <button className="primary-action" type="submit" disabled={isSubmitting}>
          {mode === "login" ? <LogIn aria-hidden="true" size={18} /> : <MailCheck aria-hidden="true" size={18} />}
          {isSubmitting ? "Working..." : mode === "login" ? "Login" : "Register"}
        </button>
      </form>

      <div className="link-row">
        <Link href="/forgot-password">Reset password</Link>
        <Link href="/dev-mailbox">Dev mailbox</Link>
      </div>
    </section>
  );
}
