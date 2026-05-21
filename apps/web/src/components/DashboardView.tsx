"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch, clearCsrfToken, type User } from "../lib/api";

type DashboardResponse = {
  profile: User;
  security: {
    sessionIdleTimeoutMinutes: number;
    absoluteSessionExpirationHours: number;
  };
};

export function DashboardView() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiFetch<DashboardResponse>("/api/dashboard")
      .then((response) => {
        if (active) {
          setData(response);
        }
      })
      .catch(() => {
        if (active) {
          setError("Please login to continue.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    await apiFetch<void>("/api/auth/logout", { method: "POST" });
    clearCsrfToken();
    router.push("/");
  }

  if (error) {
    return (
      <main className="app-shell centered">
        <section className="empty-state">
          <h1>{error}</h1>
          <Link className="primary-link" href="/">
            Go to login
          </Link>
        </section>
      </main>
    );
  }

  if (!data) {
    return <main className="app-shell centered">Loading dashboard...</main>;
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <Link href="/dashboard" className="wordmark">
          SecureAuth
        </Link>
        <div className="topbar-actions">
          {data.profile.role === "ADMIN" ? (
            <Link className="icon-link" href="/admin/users">
              <Users aria-hidden="true" size={18} />
              Users
            </Link>
          ) : null}
          <button className="icon-button" type="button" onClick={logout} aria-label="Logout">
            <LogOut aria-hidden="true" size={18} />
          </button>
        </div>
      </nav>

      <section className="dashboard-grid">
        <div className="profile-panel">
          <ShieldCheck aria-hidden="true" size={30} />
          <h1>{data.profile.name}</h1>
          <p>{data.profile.email}</p>
          <span className="role-pill">{data.profile.role.toLowerCase()}</span>
        </div>

        <div className="metrics-grid">
          <div className="metric">
            <span>Idle timeout</span>
            <strong>{data.security.sessionIdleTimeoutMinutes}m</strong>
          </div>
          <div className="metric">
            <span>Absolute expiry</span>
            <strong>{data.security.absoluteSessionExpirationHours}h</strong>
          </div>
          <div className="metric">
            <span>Email status</span>
            <strong>{data.profile.emailVerifiedAt ? "Verified" : "Pending"}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
