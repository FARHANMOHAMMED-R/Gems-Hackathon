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
  reason: z.enum(["answering", "kindness", "peer_support"]),
});

/**
 * POST /api/tokens/award
 *
 * Atomically increments a student's total_tokens by the reward amount for the
 * given reason, then returns the recomputed leaderboard ranking array.
 */
tokensRouter.post(
  "/tokens/award",
  asyncHandler(async (req, res) => {
    const { studentId, reason } = awardSchema.parse(req.body);
    const amount = TOKEN_REWARDS[reason as RewardReason];

    // Atomic increment — avoids read-modify-write races on the balance.
    let updated;
    try {
      updated = await prisma.studentProfile.update({
        where: { id: studentId },
        data: { totalTokens: { increment: amount } },
        select: { id: true, name: true, totalTokens: true },
      });
    } catch {
      throw new ApiError(404, "Student not found.");
    }

    // Recompute leaderboard ranking array (highest tokens first).
    const ranked = await prisma.studentProfile.findMany({
      orderBy: [{ totalTokens: "desc" }, { name: "asc" }],
      select: { id: true, name: true, grade: true, section: true, totalTokens: true },
    });

    const leaderboard = ranked.map((s, i) => ({ rank: i + 1, ...s }));

    res.json({
      awarded: { reason, amount },
      student: updated,
      leaderboard,
    });
  })
);

/** GET /api/tokens/leaderboard — read-only ranking for the UI. */
tokensRouter.get(
  "/tokens/leaderboard",
  asyncHandler(async (_req, res) => {
    const ranked = await prisma.studentProfile.findMany({
      orderBy: [{ totalTokens: "desc" }, { name: "asc" }],
      select: { id: true, name: true, grade: true, section: true, totalTokens: true },
    });
    res.json({ leaderboard: ranked.map((s, i) => ({ rank: i + 1, ...s })) });
  })
);
