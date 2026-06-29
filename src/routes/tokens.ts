import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";

export const tokensRouter = Router();

/** Fixed token economy: reason -> points awarded. */
export const TOKEN_REWARDS = {
  answering: 1, // +1 for answering
  kindness: 5, // +5 for kindness
  peer_support: 3, // +3 for peer support
} as const;

type RewardReason = keyof typeof TOKEN_REWARDS;

const awardSchema = z.object({
  studentId: z.string().min(1),
  reason: z.enum(["answering", "kindness", "peer_support"]).optional(),
  /** Custom points override (teacher quick-add button). */
  points: z.coerce.number().int().min(1).max(100).optional(),
});

function leaderboardSelect(classManaged?: string) {
  return prisma.studentProfile.findMany({
    where: classManaged ? { classManaged } : undefined,
    orderBy: [{ totalTokens: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      grade: true,
      section: true,
      rollNumber: true,
      schoolId: true,
      totalTokens: true,
    },
  });
}

/**
 * POST /api/tokens/award
 *
 * Atomically increments a student's total_tokens by the reward amount for the
 * given reason, then returns the recomputed leaderboard ranking array.
 */
tokensRouter.post(
  "/tokens/award",
  asyncHandler(async (req, res) => {
    const body = awardSchema.parse(req.body);
    const amount =
      body.points ??
      (body.reason ? TOKEN_REWARDS[body.reason as RewardReason] : undefined);
    if (!amount) {
      throw new ApiError(400, "Provide either reason or points.");
    }

    let updated;
    try {
      updated = await prisma.studentProfile.update({
        where: { id: body.studentId },
        data: { totalTokens: { increment: amount } },
        select: {
          id: true,
          name: true,
          totalTokens: true,
          classManaged: true,
        },
      });
    } catch {
      throw new ApiError(404, "Student not found.");
    }

    const ranked = await leaderboardSelect(updated.classManaged || undefined);
    const leaderboard = ranked.map((s, i) => ({ rank: i + 1, ...s }));

    res.json({
      awarded: { reason: body.reason ?? "custom", amount },
      student: updated,
      leaderboard,
    });
  }),
);

/** GET /api/tokens/leaderboard?classManaged=11-A */
tokensRouter.get(
  "/tokens/leaderboard",
  asyncHandler(async (req, res) => {
    const classManaged =
      typeof req.query.classManaged === "string" ? req.query.classManaged : undefined;
    const ranked = await leaderboardSelect(classManaged);
    res.json({ leaderboard: ranked.map((s, i) => ({ rank: i + 1, ...s })) });
  }),
);
