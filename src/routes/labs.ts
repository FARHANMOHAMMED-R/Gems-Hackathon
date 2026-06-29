import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";

export const labsRouter = Router();

/** Hackathon MVP admin gate — passcode checked via X-Admin-Passcode header on admin routes. */
const ADMIN_PASSCODE = "farhan";

function requireAdminPasscode(req: Request, _res: Response, next: NextFunction) {
  const passcode = req.header("X-Admin-Passcode");
  if (passcode !== ADMIN_PASSCODE) {
    return next(new ApiError(401, "Admin passcode required.", "ADMIN_UNAUTHORIZED"));
  }
  next();
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

const updateReservationSchema = z.object({
  roomName: z.string().min(1).optional(),
  date: dateSchema.optional(),
  periodNumber: z.coerce.number().int().min(1).max(7).optional(),
  reservedByTeacherId: z.string().min(1).nullable().optional(),
  status: z.enum(["Free", "Occupied"]).optional(),
});

const reserveSchema = z.object({
  roomName: z.string().min(1),
  // Date-only granularity (YYYY-MM-DD).
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  periodNumber: z.coerce.number().int().min(1).max(7),
  reservedByTeacherId: z.string().min(1),
});

/**
 * POST /api/labs/reserve
 *
 * Strict double-booking prevention: the (room_name, date, period_number) tuple
 * is UNIQUE at the database layer. We attempt the insert and translate a unique
 * constraint violation (P2002) into a 409 conflict — this closes the race
 * window that a read-then-write check would leave open under concurrency.
 */
labsRouter.post(
  "/labs/reserve",
  asyncHandler(async (req, res) => {
    const body = reserveSchema.parse(req.body);

    try {
      const reservation = await prisma.labReservation.create({
        data: {
          roomName: body.roomName,
          date: body.date,
          periodNumber: body.periodNumber,
          reservedByTeacherId: body.reservedByTeacherId,
          status: "Occupied",
        },
      });
      res.status(201).json({ ok: true, reservation });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ApiError(
          409,
          `Lab '${body.roomName}' is already booked for ${body.date} period ${body.periodNumber}.`,
          "DOUBLE_BOOKING"
        );
      }
      throw err;
    }
  })
);

/**
 * GET /api/labs/availability?date=YYYY-MM-DD
 * Convenience read for the booking grid: returns occupied slots for a date.
 */
labsRouter.get(
  "/labs/availability",
  asyncHandler(async (req, res) => {
    const date = dateSchema.parse(req.query.date);

    const occupied = await prisma.labReservation.findMany({
      where: { date, status: "Occupied" },
      orderBy: [{ roomName: "asc" }, { periodNumber: "asc" }],
    });
    res.json({ date, occupied });
  })
);

/**
 * GET /api/labs/reservations?date=YYYY-MM-DD
 * Admin-only: list all lab reservations (optional date filter).
 */
labsRouter.get(
  "/labs/reservations",
  requireAdminPasscode,
  asyncHandler(async (req, res) => {
    const date =
      typeof req.query.date === "string" && req.query.date.length > 0
        ? dateSchema.parse(req.query.date)
        : undefined;

    const reservations = await prisma.labReservation.findMany({
      where: date ? { date } : undefined,
      orderBy: [{ date: "desc" }, { roomName: "asc" }, { periodNumber: "asc" }],
    });
    res.json({ reservations });
  })
);

/**
 * PATCH /api/labs/reservations/:id
 * Admin-only: update room, date, period, teacher, or status.
 */
labsRouter.patch(
  "/labs/reservations/:id",
  requireAdminPasscode,
  asyncHandler(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);
    const body = updateReservationSchema.parse(req.body);

    const existing = await prisma.labReservation.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Reservation not found.");
    }

    try {
      const reservation = await prisma.labReservation.update({
        where: { id },
        data: body,
      });
      res.json({ ok: true, reservation });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ApiError(
          409,
          "Another reservation already exists for that room, date, and period.",
          "DOUBLE_BOOKING"
        );
      }
      throw err;
    }
  })
);

/**
 * DELETE /api/labs/reservations/:id
 * Admin-only: cancel/delete a reservation.
 */
labsRouter.delete(
  "/labs/reservations/:id",
  requireAdminPasscode,
  asyncHandler(async (req, res) => {
    const id = z.string().min(1).parse(req.params.id);

    const existing = await prisma.labReservation.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Reservation not found.");
    }

    await prisma.labReservation.delete({ where: { id } });
    res.json({ ok: true, deletedId: id });
  })
);
