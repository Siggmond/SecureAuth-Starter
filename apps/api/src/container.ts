import type { AppEnv } from "./config/env";
import { LoginThrottle } from "./security/login-throttle";
import { DevEmailService } from "./services/email-service";
import { RedisKeyValueStore } from "./services/key-value-store";
import { PrismaAuthRepository } from "./services/prisma-auth-repository";
import { prisma } from "./prisma/client";
import { SessionStore } from "./auth/session-store";

export function createProductionDeps(env: AppEnv) {
  const redisStore = new RedisKeyValueStore(env.REDIS_URL);
  const repository = new PrismaAuthRepository(prisma);
  const sessionStore = new SessionStore(redisStore, env);
  const emailService = new DevEmailService(env.WEB_ORIGIN);
  const loginThrottle = new LoginThrottle(redisStore, env.SESSION_SECRET, env.LOGIN_THROTTLE_BASE_MS);

  return {
    env,
    repository,
    sessionStore,
    emailService,
    rateLimitStore: redisStore,
    loginThrottle
  };
}
