"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch, type User } from "../lib/api";

type AuditLog = {
  id: string;
  action: string;
  success: boolean;
  createdAt: string;
};

export function AdminUsersView() {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function load() {
    setIsRefreshing(true);
    try {
      const [usersResponse, logsResponse] = await Promise.all([
        apiFetch<{ users: User[] }>("/api/admin/users"),
        apiFetch<{ logs: AuditLog[] }>("/api/admin/audit-logs")
      ]);
      setUsers(usersResponse.users);
      setLogs(logsResponse.logs);
      setError(null);
    } catch {
      setError("Admin access is required.");
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function updateRole(userId: string, role: User["role"]) {
    const response = await apiFetch<{ user: User }>(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role })
    });
    setUsers((current) => current.map((user) => (user.id === userId ? response.user : user)));
  }

  return (
    <main className="app-shell">
      <nav className="topbar">
        <Link href="/dashboard" className="icon-link">
          <ArrowLeft aria-hidden="true" size={18} />
          Dashboard
        </Link>
        <button className="icon-button" type="button" onClick={load} aria-label="Refresh" disabled={isRefreshing}>
          <RefreshCw aria-hidden="true" size={18} />
        </button>
      </nav>

      <section className="section-heading">
        <Shield aria-hidden="true" size={26} />
        <div>
          <h1>User management</h1>
          <p>Role changes are recorded in the audit log.</p>
        </div>
      </section>

      {error ? <p className="notice error">{error}</p> : null}

      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.emailVerifiedAt ? "Verified" : "Pending"}</td>
                <td>
                  <select value={user.role} onChange={(event) => void updateRole(user.id, event.target.value as User["role"])}>
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="audit-list" aria-label="Recent audit events">
        <h2>Recent audit events</h2>
        {logs.slice(0, 8).map((log) => (
          <article key={log.id} className="audit-item">
            <span>{log.action}</span>
            <strong>{log.success ? "success" : "failed"}</strong>
            <time>{new Date(log.createdAt).toLocaleString()}</time>
          </article>
        ))}
      </section>
    </main>
  );
}
