import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";

export const notificationsRouter = Router();

const ADMIN_PASSCODE = "farhan";

function requireAdminPasscode(req: Request, _res: Response, next: NextFunction) {
  const passcode = req.header("X-Admin-Passcode");
  if (passcode !== ADMIN_PASSCODE) {
    return next(new ApiError(401, "Admin passcode required.", "ADMIN_UNAUTHORIZED"));
  }
  next();
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1000),
  priority: z.enum(["info", "warning", "urgent"]).default("info"),
});

function toNotification(n: {
  id: string;
  title: string;
  body: string;
  priority: string;
  createdAt: Date;
}) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    priority: n.priority as "info" | "warning" | "urgent",
    createdAt: n.createdAt.toISOString(),
  };
}

/** GET /api/notifications — latest admin notices for teachers (last 30 days). */
notificationsRouter.get(
  "/notifications",
  asyncHandler(async (_req, res) => {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const notifications = await prisma.adminNotification.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({ notifications: notifications.map(toNotification) });
  }),
);

/** GET /api/admin/notifications */
notificationsRouter.get(
  "/admin/notifications",
  requireAdminPasscode,
  asyncHandler(async (_req, res) => {
    const notifications = await prisma.adminNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ notifications: notifications.map(toNotification) });
  }),
);

/** POST /api/admin/notifications */
notificationsRouter.post(
  "/admin/notifications",
  requireAdminPasscode,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const notification = await prisma.adminNotification.create({ data: body });
    res.status(201).json({ notification: toNotification(notification) });
  }),
);

/** DELETE /api/admin/notifications/:id */
notificationsRouter.delete(
  "/admin/notifications/:id",
  requireAdminPasscode,
  asyncHandler(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    try {
      await prisma.adminNotification.delete({ where: { id } });
      res.json({ ok: true, deletedId: id });
    } catch {
      throw new ApiError(404, "Notification not found.");
    }
  }),
);
