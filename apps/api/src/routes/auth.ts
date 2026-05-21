import { Router } from "express";
import {
  type EmailVerificationConfirmInput,
  type LoginInput,
  type PasswordResetConfirmInput,
  type RegisterInput,
  emailSchema,
  emailVerificationConfirmSchema,
  loginSchema,
  passwordResetConfirmSchema,
  registerSchema
} from "@secureauth/shared";
import { verifyPassword, hashPassword } from "../auth/password";
import { requireAuth, requireCsrf, type LocalsWithSession } from "../auth/middleware";
import type { SessionStore } from "../auth/session-store";
import type { AppEnv } from "../config/env";
import { asyncHandler, badRequest } from "../http/errors";
import { validateBody } from "../http/validation";
import { randomToken, sha256 } from "../lib/crypto";
import { accountKeyFromBody, createRateLimiter } from "../security/rate-limit";
import type { LoginThrottle } from "../security/login-throttle";
import { audit } from "../services/audit";
import type { AuthRepository } from "../services/auth-repository";
import type { DevEmailService } from "../services/email-service";
import type { KeyValueStore } from "../services/key-value-store";

type AuthRouterDeps = {
  env: AppEnv;
  repository: AuthRepository;
  emailService: DevEmailService;
  sessionStore: SessionStore;
  rateLimitStore: KeyValueStore;
  loginThrottle: LoginThrottle;
};

const GENERIC_REGISTER_MESSAGE = "If the request can be processed, a verification message will be sent.";
const GENERIC_RESET_MESSAGE = "If the account exists, a password reset message will be sent.";
const GENERIC_VERIFY_MESSAGE = "If the account exists, a verification message will be sent.";

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();

  const authLimiter = createRateLimiter(deps.rateLimitStore, {
    name: "auth",
    max: deps.env.AUTH_RATE_LIMIT_MAX,
    windowSeconds: deps.env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    secret: deps.env.SESSION_SECRET,
    keyParts: accountKeyFromBody("email")
  });

  const tokenLimiter = createRateLimiter(deps.rateLimitStore, {
    name: "auth-token",
    max: deps.env.AUTH_RATE_LIMIT_MAX,
    windowSeconds: deps.env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    secret: deps.env.SESSION_SECRET,
    keyParts: () => []
  });

  const loginLimiter = createRateLimiter(deps.rateLimitStore, {
    name: "login",
    max: deps.env.LOGIN_RATE_LIMIT_MAX,
    windowSeconds: deps.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    secret: deps.env.SESSION_SECRET,
    keyParts: accountKeyFromBody("email")
  });

  router.get(
    "/csrf-token",
    asyncHandler(async (_req, res) => {
      let session = (res as typeof res & { locals: LocalsWithSession }).locals.session;
      if (!session) {
        session = await deps.sessionStore.createAnonymousSession();
        deps.sessionStore.setCookie(res, session);
      }

      return res.json({
        csrfToken: deps.sessionStore.csrfToken(session)
      });
    })
  );

  router.post(
    "/register",
    requireCsrf(deps.sessionStore),
    validateBody(registerSchema),
    authLimiter,
    asyncHandler(async (req, res) => {
      const { email, name, password } = req.body as RegisterInput;
      const existing = await deps.repository.findUserByEmail(email);

      if (existing) {
        await audit(deps.repository, deps.env, req, {
          action: "register",
          success: true,
          email
        });
        return res.status(202).json({ message: GENERIC_REGISTER_MESSAGE });
      }

      const passwordHash = await hashPassword(password, deps.env.PASSWORD_PEPPER);
      const user = await deps.repository.createUser({
        email,
        name,
        passwordHash
      });

      const token = randomToken(48);
      await deps.repository.createEmailVerificationToken(
        user.id,
        sha256(token),
        new Date(Date.now() + 24 * 60 * 60 * 1000)
      );
      await deps.emailService.sendEmailVerification(user, token);
      await audit(deps.repository, deps.env, req, {
        action: "register",
        success: true,
        userId: user.id,
        email
      });

      return res.status(202).json({ message: GENERIC_REGISTER_MESSAGE });
    })
  );

  router.post(
    "/login",
    requireCsrf(deps.sessionStore),
    validateBody(loginSchema),
    loginLimiter,
    asyncHandler(async (req, res) => {
      const { email, password } = req.body as LoginInput;
      const ip = req.ip || req.socket.remoteAddress || "unknown";

      await deps.loginThrottle.delayFor(email, ip);

      const user = await deps.repository.findUserByEmail(email);
      const passwordMatches = user ? await verifyPassword(user.passwordHash, password, deps.env.PASSWORD_PEPPER) : false;
      const canLogin = Boolean(user && user.emailVerifiedAt && passwordMatches);

      if (!canLogin || !user) {
        await deps.loginThrottle.recordFailure(email, ip);
        await audit(deps.repository, deps.env, req, {
          action: "login",
          success: false,
          ...(user ? { userId: user.id } : {}),
          email
        });
        return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } });
      }

      const oldSession = (res as typeof res & { locals: LocalsWithSession }).locals.session;
      if (oldSession) {
        await deps.sessionStore.destroy(oldSession);
      }

      const session = await deps.sessionStore.createAuthenticatedSession(user.id, user.role);
      deps.sessionStore.setCookie(res, session);
      await deps.loginThrottle.reset(email, ip);
      await audit(deps.repository, deps.env, req, {
        action: "login",
        success: true,
        userId: user.id,
        email
      });

      return res.json({
        csrfToken: deps.sessionStore.csrfToken(session),
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerifiedAt: user.emailVerifiedAt
        }
      });
    })
  );

  router.post(
    "/logout",
    requireCsrf(deps.sessionStore),
    requireAuth,
    asyncHandler(async (req, res) => {
      const session = (res as typeof res & { locals: LocalsWithSession }).locals.session;
      if (session) {
        await deps.sessionStore.destroy(session);
        await audit(deps.repository, deps.env, req, {
          action: "logout",
          success: true,
          ...(session.data.userId ? { userId: session.data.userId } : {})
        });
      }

      deps.sessionStore.clearCookie(res);
      return res.status(204).send();
    })
  );

  router.get(
    "/me",
    requireAuth,
    asyncHandler(async (_req, res) => {
      const session = (res as typeof res & { locals: LocalsWithSession }).locals.session;
      const user = session?.data.userId ? await deps.repository.findUserById(session.data.userId) : null;

      if (!user) {
        throw badRequest("Session user no longer exists.");
      }

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerifiedAt: user.emailVerifiedAt
        }
      });
    })
  );

  router.post(
    "/password-reset/request",
    requireCsrf(deps.sessionStore),
    validateBody(emailSchema),
    authLimiter,
    asyncHandler(async (req, res) => {
      const { email } = req.body as { email: string };
      const user = await deps.repository.findUserByEmail(email);

      if (user) {
        const token = randomToken(48);
        await deps.repository.createPasswordResetToken(
          user.id,
          sha256(token),
          new Date(Date.now() + 60 * 60 * 1000)
        );
        await deps.emailService.sendPasswordReset(user, token);
      }

      await audit(deps.repository, deps.env, req, {
        action: "password_reset_request",
        success: true,
        ...(user ? { userId: user.id } : {}),
        email
      });
      return res.status(202).json({ message: GENERIC_RESET_MESSAGE });
    })
  );

  router.post(
    "/password-reset/confirm",
    requireCsrf(deps.sessionStore),
    validateBody(passwordResetConfirmSchema),
    tokenLimiter,
    asyncHandler(async (req, res) => {
      const { token, password } = req.body as PasswordResetConfirmInput;
      const user = await deps.repository.consumePasswordResetToken(sha256(token), new Date());

      if (!user) {
        await audit(deps.repository, deps.env, req, {
          action: "password_reset_complete",
          success: false
        });
        return res.status(400).json({ error: { code: "INVALID_RESET_TOKEN", message: "Reset link is invalid or expired." } });
      }

      const passwordHash = await hashPassword(password, deps.env.PASSWORD_PEPPER);
      await deps.repository.updatePassword(user.id, passwordHash);
      await deps.sessionStore.destroyUserSessions(user.id);
      await audit(deps.repository, deps.env, req, {
        action: "password_reset_complete",
        success: true,
        userId: user.id,
        email: user.email
      });

      return res.json({ message: "Password reset complete." });
    })
  );

  router.post(
    "/email-verification/request",
    requireCsrf(deps.sessionStore),
    validateBody(emailSchema),
    authLimiter,
    asyncHandler(async (req, res) => {
      const { email } = req.body as { email: string };
      const user = await deps.repository.findUserByEmail(email);

      if (user && !user.emailVerifiedAt) {
        const token = randomToken(48);
        await deps.repository.createEmailVerificationToken(
          user.id,
          sha256(token),
          new Date(Date.now() + 24 * 60 * 60 * 1000)
        );
        await deps.emailService.sendEmailVerification(user, token);
      }

      await audit(deps.repository, deps.env, req, {
        action: "email_verification_request",
        success: true,
        ...(user ? { userId: user.id } : {}),
        email
      });
      return res.status(202).json({ message: GENERIC_VERIFY_MESSAGE });
    })
  );

  router.post(
    "/email-verification/confirm",
    requireCsrf(deps.sessionStore),
    validateBody(emailVerificationConfirmSchema),
    tokenLimiter,
    asyncHandler(async (req, res) => {
      const { token } = req.body as EmailVerificationConfirmInput;
      const user = await deps.repository.consumeEmailVerificationToken(sha256(token), new Date());

      if (!user) {
        await audit(deps.repository, deps.env, req, {
          action: "email_verification_complete",
          success: false
        });
        return res.status(400).json({ error: { code: "INVALID_VERIFICATION_TOKEN", message: "Verification link is invalid or expired." } });
      }

      await audit(deps.repository, deps.env, req, {
        action: "email_verification_complete",
        success: true,
        userId: user.id,
        email: user.email
      });
      return res.json({ message: "Email verified." });
    })
  );

  return router;
}
