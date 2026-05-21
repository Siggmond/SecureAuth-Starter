import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../http/errors";
import type { SessionRecord, SessionStore } from "./session-store";

export type LocalsWithSession = {
  session?: SessionRecord;
};

export function sessionLoader(sessionStore: SessionStore) {
  return async (req: Request, res: Response<unknown, LocalsWithSession>, next: NextFunction) => {
    try {
      const record = await sessionStore.readFromRequest(req);
      if (record) {
        res.locals.session = record;
        sessionStore.setCookie(res, record);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireCsrf(sessionStore: SessionStore) {
  return (req: Request, res: Response<unknown, LocalsWithSession>, next: NextFunction) => {
    const token = Array.isArray(req.headers["x-csrf-token"])
      ? req.headers["x-csrf-token"][0]
      : req.headers["x-csrf-token"];

    if (!res.locals.session || !sessionStore.verifyCsrfToken(res.locals.session, token)) {
      next(forbidden());
      return;
    }

    next();
  };
}

export function requireAuth(_req: Request, res: Response<unknown, LocalsWithSession>, next: NextFunction) {
  const session = res.locals.session;
  if (!session?.data.userId) {
    next(unauthorized());
    return;
  }

  next();
}

export function requireAdmin(_req: Request, res: Response<unknown, LocalsWithSession>, next: NextFunction) {
  const session = res.locals.session;
  if (!session?.data.userId) {
    next(unauthorized());
    return;
  }

  if (session.data.role !== "ADMIN") {
    next(forbidden());
    return;
  }

  next();
}
