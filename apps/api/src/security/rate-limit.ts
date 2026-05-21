import type { NextFunction, Request, Response } from "express";
import type { KeyValueStore } from "../services/key-value-store";
import { hashIdentifier } from "../lib/crypto";
import { tooManyRequests } from "../http/errors";

type RateLimitOptions = {
  name: string;
  max: number;
  windowSeconds: number;
  secret: string;
  keyParts: (req: Request) => Array<string | undefined>;
};

export function createRateLimiter(store: KeyValueStore, options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const rawKeys = [
        `ip:${ip}`,
        ...options.keyParts(req).filter((value): value is string => Boolean(value))
      ];

      for (const rawKey of rawKeys) {
        const key = `rate:${options.name}:${hashIdentifier(rawKey, options.secret)}`;
        const count = await store.increment(key, options.windowSeconds);
        if (count > options.max) {
          res.setHeader("Retry-After", options.windowSeconds.toString());
          next(tooManyRequests());
          return;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function accountKeyFromBody(field: string) {
  return (req: Request): Array<string | undefined> => {
    const value = typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>)[field] : undefined;
    return typeof value === "string" ? [`account:${value.toLowerCase()}`] : [];
  };
}
