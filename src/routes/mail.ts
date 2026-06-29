import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";
import { complete } from "../lib/llm";
import { PARENT_MAIL_SYSTEM_PROMPT } from "../lib/prompts";

export const mailRouter = Router();

const schema = z.object({
  studentId: z.string().min(1),
  // How many recent grading records to summarize for the parent.
  recentLimit: z.coerce.number().int().min(1).max(20).default(5),
});

/**
 * POST /api/generate-mail
 *
 * Aggregates a student's recent GradingRecord performance plus their token
 * balance, then asks the LLM to draft a compassionate, solution-driven update
 * email to parents. The model receives a compact data string only.
 */
mailRouter.post(
  "/generate-mail",
  asyncHandler(async (req, res) => {
    const { studentId, recentLimit } = schema.parse(req.body);

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        gradingRecords: {
          orderBy: { dateTimestamp: "desc" },
          take: recentLimit,
        },
      },
    });
    if (!student) throw new ApiError(404, "Student not found.");

    // Build a terse, structured data string — no prose, the model writes that.
    const performanceLines = student.gradingRecords.map((r) => {
      // `scores` is already stored as a JSON string column.
      const scores = r.scores;
      const when = r.dateTimestamp.toISOString().slice(0, 10);
      return `- [${when}] ${r.type}: scores=${scores}; feedback="${r.aiFeedbackText}"`;
    });

    const dataString = [
      `Student: ${student.name} (Grade ${student.grade}-${student.section})`,
      `Total reward tokens earned: ${student.totalTokens}`,
      `Recent performance records (${student.gradingRecords.length}):`,
      performanceLines.length ? performanceLines.join("\n") : "- (no records yet)",
    ].join("\n");

    const email = await complete({
      systemPrompt: PARENT_MAIL_SYSTEM_PROMPT,
      userContent: `Student performance data:\n\n${dataString}`,
      temperature: 0.5,
    });

    res.json({ studentId, email });
  })
);
