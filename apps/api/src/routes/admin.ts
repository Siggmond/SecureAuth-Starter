import { Router } from "express";
import { type UpdateUserRoleInput, updateUserRoleSchema } from "@secureauth/shared";
import { requireAdmin, requireCsrf, type LocalsWithSession } from "../auth/middleware";
import type { SessionStore } from "../auth/session-store";
import type { AppEnv } from "../config/env";
import { asyncHandler, notFound } from "../http/errors";
import { validateBody } from "../http/validation";
import { audit } from "../services/audit";
import type { AuthRepository } from "../services/auth-repository";

type AdminRouterDeps = {
  env: AppEnv;
  repository: AuthRepository;
  sessionStore: SessionStore;
};

export function createAdminRouter(deps: AdminRouterDeps): Router {
  const router = Router();

  router.get(
    "/users",
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const users = await deps.repository.listUsers();
      return res.json({ users });
    })
  );

  router.patch(
    "/users/:userId/role",
    requireCsrf(deps.sessionStore),
    requireAdmin,
    validateBody(updateUserRoleSchema),
    asyncHandler(async (req, res) => {
      const session = (res as typeof res & { locals: LocalsWithSession }).locals.session;
      const { role } = req.body as UpdateUserRoleInput;
      const userId = typeof req.params.userId === "string" ? req.params.userId : undefined;
      const updated = userId ? await deps.repository.updateUserRole(userId, role) : null;

      if (!updated) {
        throw notFound();
      }

      await audit(deps.repository, deps.env, req, {
        action: "admin_update_user_role",
        success: true,
        ...(session?.data.userId ? { userId: session.data.userId } : {}),
        metadata: {
          targetUserId: updated.id,
          role
        }
      });

      return res.json({ user: updated });
    })
  );

  router.get(
    "/audit-logs",
    requireAdmin,
    asyncHandler(async (_req, res) => {
      const logs = await deps.repository.listAuditLogs(100);
      return res.json({ logs });
    })
  );

  return router;
}
