"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

export function VerifyEmailView() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    void apiFetch("/api/auth/email-verification/confirm", {
      method: "POST",
      body: JSON.stringify({ token })
    })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <main className="app-shell centered">
      <section className="empty-state">
        {status === "success" ? <CheckCircle2 aria-hidden="true" size={34} /> : <XCircle aria-hidden="true" size={34} />}
        <h1>{status === "loading" ? "Verifying email" : status === "success" ? "Email verified" : "Verification failed"}</h1>
        <Link className="primary-link" href="/">
          Go to login
        </Link>
      </section>
    </main>
  );
}
