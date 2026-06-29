import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./http";

export const ADMIN_PASSCODE = "farhan";

/** Hackathon MVP admin gate — passcode checked via X-Admin-Passcode header. */
export function requireAdminPasscode(req: Request, _res: Response, next: NextFunction) {
  const passcode = req.header("X-Admin-Passcode");
  if (passcode !== ADMIN_PASSCODE) {
    return next(new ApiError(401, "Admin passcode required.", "ADMIN_UNAUTHORIZED"));
  }
  next();
}

/** Teacher is online if last seen within this window. */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function isTeacherOnline(lastSeenAt: Date | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  return now - lastSeenAt.getTime() < ONLINE_WINDOW_MS;
}
