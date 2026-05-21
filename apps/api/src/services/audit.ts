import type { Request } from "express";
import type { AppEnv } from "../config/env";
import { hashIdentifier } from "../lib/crypto";
import type { AuthRepository } from "./auth-repository";

type AuditInput = {
  action: string;
  success: boolean;
  userId?: string;
  email?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function audit(
  repository: AuthRepository,
  env: Pick<AppEnv, "SESSION_SECRET">,
  req: Request,
  input: AuditInput
): Promise<void> {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const userAgent = Array.isArray(req.headers["user-agent"]) ? req.headers["user-agent"][0] : req.headers["user-agent"];

  await repository.createAuditLog({
    action: input.action,
    success: input.success,
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.email ? { emailHash: hashIdentifier(input.email, env.SESSION_SECRET) } : {}),
    ipHash: hashIdentifier(ip, env.SESSION_SECRET),
    ...(userAgent ? { userAgent } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {})
  });
}
