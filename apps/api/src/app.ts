import cors from "cors";
import express from "express";
import helmet from "helmet";
import { sessionLoader } from "./auth/middleware";
import type { SessionStore } from "./auth/session-store";
import type { AppEnv } from "./config/env";
import { errorHandler } from "./http/errors";
import { createAdminRouter } from "./routes/admin";
import { createAuthRouter } from "./routes/auth";
import { createDevRouter } from "./routes/dev";
import { createUserRouter } from "./routes/users";
import type { LoginThrottle } from "./security/login-throttle";
import type { AuthRepository } from "./services/auth-repository";
import type { DevEmailService } from "./services/email-service";
import type { KeyValueStore } from "./services/key-value-store";

export type AppDeps = {
  env: AppEnv;
  repository: AuthRepository;
  emailService: DevEmailService;
  sessionStore: SessionStore;
  rateLimitStore: KeyValueStore;
  loginThrottle: LoginThrottle;
};

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'none'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"]
        }
      },
      frameguard: {
        action: "deny"
      },
      referrerPolicy: {
        policy: "no-referrer"
      }
    })
  );
  app.use(
    cors({
      origin: deps.env.WEB_ORIGIN,
      credentials: true
    })
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(sessionLoader(deps.sessionStore));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(
    "/api/auth",
    createAuthRouter({
      env: deps.env,
      repository: deps.repository,
      emailService: deps.emailService,
      sessionStore: deps.sessionStore,
      rateLimitStore: deps.rateLimitStore,
      loginThrottle: deps.loginThrottle
    })
  );
  app.use("/api", createUserRouter(deps.repository));
  app.use(
    "/api/admin",
    createAdminRouter({
      env: deps.env,
      repository: deps.repository,
      sessionStore: deps.sessionStore
    })
  );
  app.use("/api/dev", createDevRouter(deps.env, deps.emailService));

  app.use(errorHandler(deps.env.NODE_ENV === "production"));

  return app;
}
