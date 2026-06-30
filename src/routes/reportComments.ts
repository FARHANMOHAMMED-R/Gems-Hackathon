import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/http";
import { aiCompleteJSON, isAnyAiConfigured, type AiProvider } from "../lib/aiProviders";
import { REPORT_COMMENTS_SYSTEM_PROMPT } from "../lib/prompts";
import { draftReportCommentsLocally } from "../lib/localReportComments";

export const reportCommentsRouter = Router();

const generateSchema = z.object({
  gradeLevel: z.string().trim().min(1, "Grade level is required."),
  studentPronouns: z.string().trim().min(1, "Student pronouns are required."),
  strengths: z.string().trim().min(1, "Areas of strength are required."),
  growthAreas: z.string().trim().min(1, "Areas for growth are required."),
  strengthsFileContext: z.string().trim().optional(),
  growthFileContext: z.string().trim().optional(),
  provider: z.enum(["openai", "gemini", "claude"]).optional(),
});

reportCommentsRouter.post(
  "/generate-report-comments",
  asyncHandler(async (req, res) => {
    const body = generateSchema.parse(req.body);

    if (!isAnyAiConfigured()) {
      const draft = draftReportCommentsLocally(body);
      res.json({ ...draft, analysisMode: "local" as const });
      return;
    }

    const userParts = [
      `Grade level: ${body.gradeLevel}`,
      `Student pronouns (use consistently): ${body.studentPronouns}`,
      "",
      "Areas of strength:",
      body.strengths,
    ];
    if (body.strengthsFileContext?.trim()) {
      userParts.push("", "Additional strength notes from attached file:", body.strengthsFileContext.trim());
    }
    userParts.push("", "Areas for growth:", body.growthAreas);
    if (body.growthFileContext?.trim()) {
      userParts.push("", "Additional growth notes from attached file:", body.growthFileContext.trim());
    }

    const { data: result, provider } = await aiCompleteJSON<{ comment: string }>({
      systemPrompt: REPORT_COMMENTS_SYSTEM_PROMPT,
      userContent: userParts.join("\n"),
      temperature: 0.5,
      provider: body.provider as AiProvider | undefined,
    });

    res.json({
      comment: result.comment?.trim() || body.strengths,
      analysisMode: "ai" as const,
      providerUsed: provider,
    });
  }),
);
