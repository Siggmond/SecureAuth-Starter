# SecureAuth Starter
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white) ![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white) ![Express](https://img.shields.io/badge/Express.js-API-000000?logo=express&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-Sessions%20%26%20Rate%20Limits-DC382D?logo=redis&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white) ![Security](https://img.shields.io/badge/Security-OWASP%20Aligned-critical) ![Tests](https://img.shields.io/badge/Tests-13%20Passing-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue)
SecureAuth Starter is a security-focused full-stack authentication system built to demonstrate secure software engineering practices in a real working application.

It is not a fake login screen or UI-only portfolio project. The backend owns authentication state, validates requests, hashes passwords with Argon2id, stores sessions and rate-limit counters in Redis, writes security audit events, and protects role-based routes consumed by the Next.js frontend.

The project is designed as a practical portfolio showcase for software engineering, application security, and DevSecOps roles.

---

## Highlights

- Secure registration, login, logout, email verification, and password reset flows
- Argon2id password hashing
- HTTP-only cookie-based sessions
- Redis-backed session storage
- Redis-backed rate limiting
- CSRF protection for state-changing requests
- Role-based access control with `USER` and `ADMIN` roles
- Admin-only user management
- Audit logging for security-sensitive actions
- Zod request validation
- Prisma-backed PostgreSQL data layer
- Docker Compose local infrastructure
- Automated backend and frontend security-focused tests
- Linting, type checking, and dependency audit verification

---

## Tech Stack

### Frontend

- Next.js
- React
- TypeScript
- Credentialed API requests
- CSRF-aware form submissions

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- Zod
- Argon2id
- Redis

### Infrastructure

- PostgreSQL
- Redis
- Docker Compose
- Environment-based configuration

### Testing and Quality

- Vitest
- React Testing Library
- ESLint
- TypeScript type checking
- npm audit

---

## Project Screenshots

### Login and Registration

![Login page](apps/web/src/assets/01-login-page.png)

### Protected User Dashboard

![Protected dashboard](apps/web/src/assets/02-protected-dashboard.png)

### Admin User Management and RBAC

![Admin users RBAC](apps/web/src/assets/03-admin-users-rbac.png)

### Email Verification and Password Reset Flow

![Email verification and reset flow](apps/web/src/assets/04-email-verification-reset-flow.png)

### Automated Security Tests Passing

![Security tests passing](apps/web/src/assets/05-security-tests-passing.png)

### Quality and Security Checks

![Quality and security checks](apps/web/src/assets/06-quality-security-checks.png)

### Argon2id Password Hash Verification

![Argon2id password hash proof](apps/web/src/assets/07-argon2id-password-hash.png)

---

## Why This Project Exists

Authentication is one of the most security-critical parts of any software product. Many portfolio projects implement login as a simple database check, store tokens insecurely in the browser, or ignore abuse controls entirely.

SecureAuth Starter takes a stronger approach. It demonstrates how authentication can be designed when security matters:

- Passwords are never stored in plaintext.
- Sessions are stored server-side and invalidated on logout.
- Cookies are HTTP-only.
- User input is validated at the API boundary.
- Authentication flows reduce account enumeration risk.
- Sensitive tokens are hashed at rest.
- Admin routes enforce role-based access control.
- Security events are logged for auditability.
- Rate limits reduce brute-force and credential-stuffing risk.

---

## Architecture

```text
Browser
  |
  | HTTPS in production
  | HTTP-only SameSite cookies
  v
Next.js Web App :3000
  |
  | credentialed fetch
  | x-csrf-token for state-changing requests
  v
Express API :4000
  |
  |-- Zod request validation
  |-- CSRF protection
  |-- Redis rate limits
  |-- Redis session store
  |-- Argon2id password hashing
  |-- Prisma data access
  |-- RBAC middleware
  |-- Audit logging
  |
  +--> PostgreSQL
  |
  +--> Redis
  |
  +--> Local development mailbox
```

---

## Core Features

- User registration
- User login and logout
- Email verification flow
- Password reset flow with one-time tokens
- Server-side sessions
- HTTP-only cookie authentication
- Role-based access control
- Admin-only user management
- Protected dashboard
- Audit logging
- Redis rate limiting
- CSRF protection
- Secure environment validation

---

## Security Features

### Password Security

- Passwords are hashed with Argon2id.
- Plaintext passwords are never stored.
- Passwords are never logged.
- Optional server-side password pepper is supported.
- Password reset tokens are hashed at rest.
- Password reset tokens are single-use and expire.

### Session Security

- Sessions are stored server-side in Redis.
- The browser receives only an opaque HTTP-only cookie.
- Cookies use `SameSite=Lax`.
- Cookies use `Secure` in production.
- Session ID is rotated after login.
- Sessions are invalidated on logout.
- Password reset invalidates active sessions.
- Idle timeout and absolute session expiration are supported.

### API Security

- Request bodies are validated with Zod.
- Authentication routes use generic responses where account enumeration matters.
- Login, registration, reset, and verification flows are rate limited.
- Repeated failed login attempts trigger additional throttling.
- State-changing requests require CSRF protection.
- Error handling avoids leaking stack traces in production.
- Environment variables are validated during startup.

### Authorization

- Authenticated routes require a valid session.
- Admin routes require the `ADMIN` role.
- Normal users cannot access admin-only resources.
- User-specific access checks prevent users from reading or modifying other users' data.

### Logging and Monitoring

Audit logs are created for important security events, including:

- Registration
- Login success
- Login failure
- Logout
- Email verification
- Password reset request
- Password reset completion
- Admin role changes
- Admin user management actions

Audit logs avoid storing passwords, cookies, raw tokens, or secrets.

---

## Threat Model

### Primary Assets

- Password hashes
- Session identifiers
- CSRF tokens
- Password reset tokens
- Email verification tokens
- User roles
- Audit logs
- Environment secrets

### Key Threats and Mitigations

| Threat | Mitigation |
| --- | --- |
| Password theft | Argon2id hashing, no plaintext password storage, no password logging |
| Credential stuffing | Redis-backed rate limits and failed-login throttling |
| Session theft | HTTP-only cookies, server-side sessions, session invalidation |
| CSRF | CSRF token required for state-changing requests |
| Account enumeration | Generic responses for sensitive auth flows |
| Token replay | Reset and verification tokens are hashed and consumed once |
| Broken access control | Auth middleware, admin middleware, ownership checks |
| SQL injection | Prisma query APIs and Zod validation |
| Secret leakage | `.env` ignored, environment validation, no secret logging |
| Weak operational visibility | Audit logs for authentication and admin actions |

---

## OWASP Mapping

This project demonstrates practical controls related to the OWASP Top 10:

| OWASP Category | Project Controls |
| --- | --- |
| A01 Broken Access Control | `requireAuth`, `requireAdmin`, ownership checks |
| A02 Cryptographic Failures | Argon2id password hashing, signed cookies, hashed tokens |
| A03 Injection | Prisma ORM, Zod validation, no unsafe raw SQL |
| A04 Insecure Design | Threat model, token expiry, single-use reset tokens |
| A05 Security Misconfiguration | Helmet headers, environment validation, production cookie settings |
| A07 Identification and Authentication Failures | Rate limits, session rotation, logout invalidation |
| A09 Security Logging and Monitoring Failures | Audit logging for authentication and admin events |

---

## Repository Structure

```text
SecureAuth-Starter/
  apps/
    api/
      prisma/
        schema.prisma
        seed.ts
        migrations/
      src/
        config/
        middleware/
        routes/
        services/
        tests/
        app.ts
        server.ts
      .env.example
    web/
      src/
        app/
        assets/
        components/
        lib/
      .env.example
  docker-compose.yml
  package.json
  README.md
  .gitignore
```

---

## Local Development Setup

### Prerequisites

Install:

- Node.js 20+
- npm
- Docker Desktop
- Git

Docker Desktop must be running before starting PostgreSQL and Redis.

---

## Environment Variables

Create the API environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

On Windows PowerShell:

```powershell
Copy-Item apps\api\.env.example apps\api\.env
```

Example local API environment:

```env
DATABASE_URL="postgresql://secureauth:secureauth@localhost:5432/secureauth?schema=public"
REDIS_URL="redis://localhost:6379"
SESSION_SECRET="replace-with-a-long-random-secret"
ADMIN_EMAIL="admin@test.com"
ADMIN_PASSWORD="AdminPassword123!ChangeMe"
NODE_ENV="development"
PORT="4000"
WEB_ORIGIN="http://localhost:3000"
```

Generate a strong local session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For the web app:

```bash
cp apps/web/.env.example apps/web/.env.local
```

On Windows PowerShell:

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
```

Example local web environment:

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

Never commit real `.env` files.

---

## Running Locally

Install dependencies:

```bash
npm install
```

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

Verify containers are running:

```bash
docker ps
```

Generate Prisma client:

```bash
npm run prisma:generate
```

Run database migrations:

```bash
npm run prisma:migrate
```

Seed the admin user:

```bash
npm run prisma:seed
```

Start the API:

```bash
npm run dev -w apps/api
```

In another terminal, start the web app:

```bash
npm run dev -w apps/web
```

Open:

```text
http://localhost:3000
```

The API runs at:

```text
http://localhost:4000
```

---

## Default Local Admin

If your `.env` uses the example values, the seeded admin account is:

```text
Email: admin@test.com
Password: AdminPassword123!ChangeMe
```

Change these values before using the project outside local development.

---

## Testing

Run the test suite:

```bash
npm test
```

Run the full local verification suite:

```bash
npm run lint
npm run typecheck
npm run audit
```

Backend security tests cover:

- Successful registration
- Duplicate registration safety
- Password hashing
- Login success
- Login failure
- Login rate limiting
- Logout invalidation
- Protected route rejection
- Admin route authorization
- One-time password reset tokens
- Expired reset token rejection
- Generic reset responses

Frontend tests verify:

- CSRF-aware form submission
- Basic auth-related UI behavior

---

## Manual Security Verification

After starting the app locally, verify the main security flows:

1. Register a new user.
2. Open the development mailbox.
3. Use the email verification link.
4. Log in as the verified user.
5. Confirm the dashboard is accessible.
6. Try accessing the admin page as a normal user and confirm access is denied.
7. Log in as the seeded admin user.
8. Open the admin user management page.
9. Request a password reset.
10. Use the reset link once.
11. Try using the same reset link again and confirm it fails.
12. Attempt repeated failed logins and confirm rate limiting.
13. Inspect the database and confirm passwords are stored as Argon2id hashes.
14. Inspect audit logs and confirm sensitive values are not stored.

---

## Verifying Password Hashing

You can verify that stored passwords are hashed with Argon2id:

```bash
docker exec -it secureauth-postgres psql -U secureauth -d secureauth
```

Then run:

```sql
SELECT id, role, LEFT("passwordHash", 10) AS hash_prefix
FROM "User"
LIMIT 5;
```

Expected hash prefix:

```text
$argon2id$
```

Do not expose full password hashes, reset tokens, cookies, or secrets in screenshots.

---

## Docker Services

The local development environment uses:

- PostgreSQL on port `5432`
- Redis on port `6379`

Expected container names:

```text
secureauth-postgres
secureauth-redis
```

Stop services:

```bash
docker compose down
```

Stop and remove local volumes:

```bash
docker compose down -v
```

Use `down -v` only if you want to delete local database data.

---

## Production Hardening Notes

This project is suitable as a secure development portfolio project, but production deployment requires additional operational work.

Before production, add or verify:

- Real email provider for verification and password reset delivery
- TLS termination through a trusted provider
- `NODE_ENV=production`
- Strong production secrets
- Secret rotation process
- Hosted PostgreSQL with backups
- Hosted Redis with persistence and access controls
- Centralized logging and alerting
- Stricter Content Security Policy for final domains
- Monitoring for suspicious login and reset activity
- CAPTCHA or risk-based challenges for public authentication endpoints
- Database migration review process
- Dependency update process
- CI/CD secret scanning
- Production incident response plan

The local development mailbox must not be enabled in production.

---

## Security Limitations

No authentication system is complete without operational security. This project demonstrates secure implementation patterns, but it does not claim to solve every production security requirement.

Known limitations:

- No real email provider is configured by default.
- No MFA is implemented yet.
- No external SIEM integration is included.
- No CAPTCHA or bot protection is included.
- No cloud infrastructure module is included.
- No production backup policy is included.
- No formal third-party penetration test has been performed.

---

## Suggested Future Improvements

- Add MFA using TOTP or WebAuthn.
- Add device and session management.
- Add account lockout policy with admin unlock.
- Add suspicious login detection.
- Add IP reputation checks.
- Add email delivery provider integration.
- Add OpenTelemetry tracing.
- Add SIEM export support.
- Add Docker image signing with Sigstore Cosign.
- Add SBOM generation in CI.
- Add OpenSSF Scorecard checks.
- Add SAST and dependency scanning in CI.

---

## Portfolio Summary

SecureAuth Starter demonstrates practical secure software development skills, including:

- Secure authentication design
- Password hashing
- Session security
- CSRF protection
- Rate limiting
- RBAC
- Audit logging
- Secure environment handling
- OWASP-aligned engineering practices
- Security-focused automated testing

This project is intended to support a software engineering, application security, or DevSecOps portfolio.

---

## License

MIT License.
