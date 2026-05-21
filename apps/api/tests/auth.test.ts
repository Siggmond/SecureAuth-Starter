import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { hashPassword } from "../src/auth/password";
import { SessionStore } from "../src/auth/session-store";
import type { AppEnv } from "../src/config/env";
import { sha256 } from "../src/lib/crypto";
import { LoginThrottle } from "../src/security/login-throttle";
import { DevEmailService } from "../src/services/email-service";
import { MemoryAuthRepository } from "../src/services/memory-auth-repository";
import { MemoryKeyValueStore } from "../src/services/key-value-store";

const testEnv: AppEnv = {
  NODE_ENV: "test",
  PORT: 4000,
  WEB_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://secureauth:secureauth@localhost:5432/secureauth",
  REDIS_URL: "redis://localhost:6379",
  SESSION_SECRET: "test-session-secret-with-more-than-32-characters",
  PASSWORD_PEPPER: "test-pepper",
  SESSION_IDLE_MINUTES: 30,
  SESSION_ABSOLUTE_HOURS: 12,
  LOGIN_RATE_LIMIT_MAX: 2,
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: 900,
  AUTH_RATE_LIMIT_MAX: 50,
  AUTH_RATE_LIMIT_WINDOW_SECONDS: 900,
  LOGIN_THROTTLE_BASE_MS: 0,
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_PASSWORD: "AdminPassword123"
};

function buildTestContext(overrides: Partial<AppEnv> = {}) {
  const env = { ...testEnv, ...overrides };
  const keyValueStore = new MemoryKeyValueStore();
  const repository = new MemoryAuthRepository();
  const emailService = new DevEmailService(env.WEB_ORIGIN);
  const sessionStore = new SessionStore(keyValueStore, env);
  const loginThrottle = new LoginThrottle(keyValueStore, env.SESSION_SECRET, env.LOGIN_THROTTLE_BASE_MS);
  const app = createApp({
    env,
    repository,
    emailService,
    sessionStore,
    rateLimitStore: keyValueStore,
    loginThrottle
  });

  return {
    app,
    env,
    repository,
    emailService
  };
}

type TestAgent = ReturnType<typeof request.agent>;

async function csrf(agent: TestAgent): Promise<string> {
  const response = await agent.get("/api/auth/csrf-token").expect(200);
  return response.body.csrfToken as string;
}

async function registerAndVerify(
  agent: TestAgent,
  emailService: DevEmailService,
  email = "user@example.com",
  password = "StrongPassword123"
) {
  let token = await csrf(agent);
  await agent
    .post("/api/auth/register")
    .set("x-csrf-token", token)
    .send({ email, name: "Secure User", password })
    .expect(202);

  const verificationEmail = emailService.list().find((message) => message.type === "email-verification" && message.to === email);
  expect(verificationEmail).toBeDefined();

  token = await csrf(agent);
  await agent
    .post("/api/auth/email-verification/confirm")
    .set("x-csrf-token", token)
    .send({ token: verificationEmail?.token })
    .expect(200);
}

async function login(agent: TestAgent, email: string, password: string): Promise<string> {
  const token = await csrf(agent);
  const response = await agent.post("/api/auth/login").set("x-csrf-token", token).send({ email, password }).expect(200);
  return response.body.csrfToken as string;
}

describe("SecureAuth API", () => {
  it("registers a user and sends a local verification email", async () => {
    const { app, repository, emailService } = buildTestContext();
    const agent = request.agent(app);
    const token = await csrf(agent);

    const response = await agent
      .post("/api/auth/register")
      .set("x-csrf-token", token)
      .send({ email: "new@example.com", name: "New User", password: "StrongPassword123" })
      .expect(202);

    expect(response.body.message).toBe("If the request can be processed, a verification message will be sent.");
    expect(await repository.findUserByEmail("new@example.com")).toBeTruthy();
    expect(emailService.list()[0]).toMatchObject({
      to: "new@example.com",
      type: "email-verification"
    });
  });

  it("returns a generic safe response for duplicate registration", async () => {
    const { app, repository } = buildTestContext();
    const agent = request.agent(app);
    const firstToken = await csrf(agent);

    const first = await agent
      .post("/api/auth/register")
      .set("x-csrf-token", firstToken)
      .send({ email: "dupe@example.com", name: "First User", password: "StrongPassword123" })
      .expect(202);

    const secondToken = await csrf(agent);
    const second = await agent
      .post("/api/auth/register")
      .set("x-csrf-token", secondToken)
      .send({ email: "dupe@example.com", name: "Second User", password: "StrongPassword123" })
      .expect(202);

    expect(second.body).toEqual(first.body);
    expect([...repository.users.values()].filter((user) => user.email === "dupe@example.com")).toHaveLength(1);
  });

  it("hashes passwords and never stores plaintext", async () => {
    const { app, repository } = buildTestContext();
    const agent = request.agent(app);
    const token = await csrf(agent);
    const plainPassword = "StrongPassword123";

    await agent
      .post("/api/auth/register")
      .set("x-csrf-token", token)
      .send({ email: "hash@example.com", name: "Hash User", password: plainPassword })
      .expect(202);

    const user = await repository.findUserByEmail("hash@example.com");
    expect(user?.passwordHash).not.toBe(plainPassword);
    expect(user?.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("logs in successfully after email verification", async () => {
    const { app, emailService } = buildTestContext();
    const agent = request.agent(app);

    await registerAndVerify(agent, emailService, "login@example.com");
    await login(agent, "login@example.com", "StrongPassword123");

    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.body.user.email).toBe("login@example.com");
  });

  it("rejects failed login with a generic credential error", async () => {
    const { app, emailService } = buildTestContext();
    const agent = request.agent(app);

    await registerAndVerify(agent, emailService, "fail@example.com");
    const token = await csrf(agent);
    const response = await agent
      .post("/api/auth/login")
      .set("x-csrf-token", token)
      .send({ email: "fail@example.com", password: "WrongPassword123" })
      .expect(401);

    expect(response.body.error.message).toBe("Invalid email or password.");
  });

  it("rate limits repeated login attempts", async () => {
    const { app, emailService } = buildTestContext();
    const agent = request.agent(app);

    await registerAndVerify(agent, emailService, "limited@example.com");

    for (let index = 0; index < 2; index += 1) {
      const token = await csrf(agent);
      await agent
        .post("/api/auth/login")
        .set("x-csrf-token", token)
        .send({ email: "limited@example.com", password: "WrongPassword123" })
        .expect(401);
    }

    const token = await csrf(agent);
    await agent
      .post("/api/auth/login")
      .set("x-csrf-token", token)
      .send({ email: "limited@example.com", password: "WrongPassword123" })
      .expect(429);
  });

  it("logout invalidates the active session", async () => {
    const { app, emailService } = buildTestContext();
    const agent = request.agent(app);

    await registerAndVerify(agent, emailService, "logout@example.com");
    const loginCsrf = await login(agent, "logout@example.com", "StrongPassword123");

    await agent.post("/api/auth/logout").set("x-csrf-token", loginCsrf).expect(204);
    await agent.get("/api/auth/me").expect(401);
  });

  it("rejects unauthenticated access to protected routes", async () => {
    const { app } = buildTestContext();
    await request(app).get("/api/dashboard").expect(401);
  });

  it("prevents normal users from accessing admin routes", async () => {
    const { app, emailService } = buildTestContext();
    const agent = request.agent(app);

    await registerAndVerify(agent, emailService, "plain@example.com");
    await login(agent, "plain@example.com", "StrongPassword123");
    await agent.get("/api/admin/users").expect(403);
  });

  it("allows a password reset token to be used once only", async () => {
    const { app, emailService } = buildTestContext();
    const agent = request.agent(app);

    await registerAndVerify(agent, emailService, "reset@example.com");
    let token = await csrf(agent);
    await agent
      .post("/api/auth/password-reset/request")
      .set("x-csrf-token", token)
      .send({ email: "reset@example.com" })
      .expect(202);

    const resetEmail = emailService.list().find((message) => message.type === "password-reset" && message.to === "reset@example.com");
    expect(resetEmail).toBeDefined();

    token = await csrf(agent);
    await agent
      .post("/api/auth/password-reset/confirm")
      .set("x-csrf-token", token)
      .send({ token: resetEmail?.token, password: "NewPassword1234" })
      .expect(200);

    token = await csrf(agent);
    await agent
      .post("/api/auth/password-reset/confirm")
      .set("x-csrf-token", token)
      .send({ token: resetEmail?.token, password: "AnotherPassword123" })
      .expect(400);

    await login(agent, "reset@example.com", "NewPassword1234");
  });

  it("rejects expired reset tokens", async () => {
    const { app, env, repository } = buildTestContext();
    const agent = request.agent(app);
    const rawToken = "expired-reset-token-that-is-long-enough-for-validation";
    const passwordHash = await hashPassword("OldPassword1234", env.PASSWORD_PEPPER);
    const user = await repository.createUser({
      email: "expired@example.com",
      name: "Expired User",
      passwordHash,
      emailVerifiedAt: new Date()
    });
    await repository.createPasswordResetToken(user.id, sha256(rawToken), new Date(Date.now() - 1000));

    const token = await csrf(agent);
    await agent
      .post("/api/auth/password-reset/confirm")
      .set("x-csrf-token", token)
      .send({ token: rawToken, password: "NewPassword1234" })
      .expect(400);
  });

  it("uses generic responses to reduce account enumeration during reset", async () => {
    const { app, emailService } = buildTestContext();
    const agent = request.agent(app);
    await registerAndVerify(agent, emailService, "known@example.com");

    let token = await csrf(agent);
    const known = await agent
      .post("/api/auth/password-reset/request")
      .set("x-csrf-token", token)
      .send({ email: "known@example.com" })
      .expect(202);

    token = await csrf(agent);
    const unknown = await agent
      .post("/api/auth/password-reset/request")
      .set("x-csrf-token", token)
      .send({ email: "unknown@example.com" })
      .expect(202);

    expect(unknown.body).toEqual(known.body);
  });
});
