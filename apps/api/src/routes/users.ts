import { Router } from "express";
import { requireAuth, type LocalsWithSession } from "../auth/middleware";
import { forbidden, notFound, asyncHandler } from "../http/errors";
import type { AuthRepository } from "../services/auth-repository";

export function createUserRouter(repository: AuthRepository): Router {
  const router = Router();

  router.get(
    "/dashboard",
    requireAuth,
    asyncHandler(async (_req, res) => {
      const session = (res as typeof res & { locals: LocalsWithSession }).locals.session;
      const user = session?.data.userId ? await repository.findUserById(session.data.userId) : null;

      if (!user) {
        throw notFound();
      }

      return res.json({
        profile: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerifiedAt: user.emailVerifiedAt
        },
        security: {
          sessionIdleTimeoutMinutes: 30,
          absoluteSessionExpirationHours: 12
        }
      });
    })
  );

  router.get(
    "/users/:userId",
    requireAuth,
    asyncHandler(async (req, res) => {
      const session = (res as typeof res & { locals: LocalsWithSession }).locals.session;
      const requestedUserId = typeof req.params.userId === "string" ? req.params.userId : undefined;
      const isSelf = session?.data.userId === requestedUserId;
      const isAdmin = session?.data.role === "ADMIN";

      if (!isSelf && !isAdmin) {
        throw forbidden();
      }

      const user = requestedUserId ? await repository.findUserById(requestedUserId) : null;
      if (!user) {
        throw notFound();
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

  return router;
}
