import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";

export const labsRouter = Router();

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
    const date = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .parse(req.query.date);

    const occupied = await prisma.labReservation.findMany({
      where: { date, status: "Occupied" },
      orderBy: [{ roomName: "asc" }, { periodNumber: "asc" }],
    });
    res.json({ date, occupied });
  })
);
