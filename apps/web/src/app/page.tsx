import { AuthPanel } from "../components/AuthPanel";

export default function HomePage() {
  return (
    <main className="auth-shell">
      <section className="brand-pane" aria-label="SecureAuth Starter overview">
        <div className="brand-mark">SA</div>
        <h1>SecureAuth Starter</h1>
        <p>Cookie sessions, CSRF protection, Argon2id passwords, audit trails, and role-aware access in one working starter.</p>
        <div className="signal-grid" aria-label="Security controls">
          <span>HttpOnly cookies</span>
          <span>Argon2id</span>
          <span>Redis limits</span>
          <span>Prisma RBAC</span>
        </div>
      </section>
      <AuthPanel />
    </main>
  );
}
