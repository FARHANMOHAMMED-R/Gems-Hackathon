import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/http";
import { fromJsonColumn } from "../lib/json";

export const substitutionRouter = Router();

const querySchema = z.object({
  // Period to cover (1-7). Accepts string from query params and coerces.
  period: z.coerce.number().int().min(1).max(7),
  // Optional department to prioritise (matching subject substitutes first).
  department: z.string().optional(),
});

/**
 * GET /api/substitution/check-free?period=3&department=Physics
 *
 * Reads TeacherAvailability and returns every teacher whose
 * `current_period_free_status[target_period] === true`, sorted so that
 * teachers in the requested department come first (department-matched subs).
 */
substitutionRouter.get(
  "/substitution/check-free",
  asyncHandler(async (req, res) => {
    const { period, department } = querySchema.parse(req.query);

    // Boolean array is 1-indexed by period in the request; arrays are 0-indexed.
    const targetIndex = period - 1;

    const all = await prisma.teacherAvailability.findMany();

    const free = all
      .map((t) => ({
        id: t.id,
        teacherName: t.teacherName,
        department: t.department,
        freeStatus: fromJsonColumn<boolean[]>(t.currentPeriodFreeStatus, []),
      }))
      // Filter: only teachers explicitly free in the target period.
      .filter((t) => Array.isArray(t.freeStatus) && t.freeStatus[targetIndex] === true)
      // Sort: department match first (if requested), then alphabetical.
      .sort((a, b) => {
        if (department) {
          const aMatch = a.department === department ? 0 : 1;
          const bMatch = b.department === department ? 0 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
        }
        return a.teacherName.localeCompare(b.teacherName);
      })
      .map(({ freeStatus, ...rest }) => rest);

    if (department && free.length === 0) {
      // Not an error — just report no candidates for transparency.
      return res.json({ period, department, freeTeachers: [], note: "No free teachers for this period." });
    }

    res.json({ period, department: department ?? null, freeTeachers: free });
  })
);
