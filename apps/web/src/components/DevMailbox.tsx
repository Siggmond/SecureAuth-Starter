"use client";

import Link from "next/link";
import { ArrowLeft, Mail, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch, type DevEmail } from "../lib/api";

function localMailHref(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export function DevMailbox() {
  const [emails, setEmails] = useState<DevEmail[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const response = await apiFetch<{ emails: DevEmail[] }>("/api/dev/emails");
      setEmails(response.emails);
      setError(null);
    } catch {
      setError("The dev mailbox is unavailable.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="app-shell">
      <nav className="topbar">
        <Link className="icon-link" href="/">
          <ArrowLeft aria-hidden="true" size={18} />
          Login
        </Link>
        <button className="icon-button" type="button" onClick={load} aria-label="Refresh mailbox">
          <RefreshCw aria-hidden="true" size={18} />
        </button>
      </nav>

      <section className="section-heading">
        <Mail aria-hidden="true" size={26} />
        <div>
          <h1>Dev mailbox</h1>
          <p>Local delivery for verification and reset flows.</p>
        </div>
      </section>

      {error ? <p className="notice error">{error}</p> : null}
      <div className="mail-list">
        {emails.map((email) => (
          <article className="mail-item" key={email.id}>
            <div>
              <strong>{email.subject}</strong>
              <span>{email.to}</span>
            </div>
            <a className="primary-link" href={localMailHref(email.url)}>
              Open
            </a>
          </article>
        ))}
      </div>
    </main>
  );
}
