import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = "APP_ERROR"
  ) {
    super(message);
  }
}

export const badRequest = (message = "Invalid request.") => new AppError(400, message, "BAD_REQUEST");
export const unauthorized = () => new AppError(401, "Authentication required.", "UNAUTHORIZED");
export const forbidden = () => new AppError(403, "Forbidden.", "FORBIDDEN");
export const notFound = () => new AppError(404, "Not found.", "NOT_FOUND");
export const tooManyRequests = () => new AppError(429, "Too many requests. Please try again later.", "RATE_LIMITED");

export function asyncHandler<T extends Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: T, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function errorHandler(isProduction: boolean) {
  return (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request."
        }
      });
    }

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    const body: { error: { code: string; message: string; stack?: string } } = {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error."
      }
    };

    if (!isProduction && error instanceof Error && error.stack) {
      body.error.stack = error.stack;
    }

    return res.status(500).json(body);
  };
}
