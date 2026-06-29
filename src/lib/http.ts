import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { LlmConfigError } from "./llm";

/** Wrap an async route handler so rejected promises hit the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Domain error with an explicit HTTP status (e.g. booking conflicts). */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Centralized error formatter mounted last on the app. */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ error: "Validation failed", issues: err.flatten() });
  }
  if (err instanceof ApiError) {
    return res
      .status(err.status)
      .json({ error: err.message, code: err.code });
  }
  if (err instanceof LlmConfigError) {
    return res.status(503).json({ error: err.message, code: "LLM_NOT_CONFIGURED" });
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  // eslint-disable-next-line no-console
  console.error("[unhandled]", err);
  return res.status(500).json({ error: message });
}
