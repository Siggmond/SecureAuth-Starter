import { Router } from "express";
import type { AppEnv } from "../config/env";
import type { DevEmailService } from "../services/email-service";

export function createDevRouter(env: AppEnv, emailService: DevEmailService): Router {
  const router = Router();

  router.get("/emails", (_req, res) => {
    if (env.NODE_ENV === "production") {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found." } });
    }

    return res.json({ emails: emailService.list() });
  });

  return router;
}
