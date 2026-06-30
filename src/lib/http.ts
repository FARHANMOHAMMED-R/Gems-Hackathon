import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { LlmConfigError } from "./llm";
import { GuruPdfConfigError } from "./gurupdfOcr";
import { MailConfigError } from "./emailSend";
import { isAiQuotaError, friendlyAiErrorMessage } from "./aiErrors";

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
  if (err instanceof GuruPdfConfigError) {
    return res.status(503).json({ error: err.message, code: "GURUPDF_NOT_CONFIGURED" });
  }
  if (err instanceof MailConfigError) {
    return res.status(503).json({ error: err.message, code: "MAIL_NOT_CONFIGURED" });
  }
  if (err instanceof Error && isAiQuotaError(err)) {
    return res.status(429).json({
      error: friendlyAiErrorMessage(err),
      code: "AI_QUOTA_EXCEEDED",
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        error: "A student with that roll number already exists in this class.",
        code: "DUPLICATE_ROLL",
      });
    }
    if (err.code === "P2022") {
      return res.status(503).json({
        error:
          "Database schema is out of date. Run: npx prisma generate && npx prisma db push, then restart the backend.",
        code: "SCHEMA_OUT_OF_DATE",
      });
    }
  }
  if (
    err instanceof Error &&
    (err.message.includes("Unknown argument `classManaged`") ||
      err.message.includes("teacherProfile"))
  ) {
    return res.status(503).json({
      error:
        "Backend needs a restart. Run: npx prisma generate && npm run dev",
      code: "STALE_PRISMA_CLIENT",
    });
  }
  const message = err instanceof Error ? err.message : "Internal server error";
  // eslint-disable-next-line no-console
  console.error("[unhandled]", err);
  return res.status(500).json({ error: message });
}
