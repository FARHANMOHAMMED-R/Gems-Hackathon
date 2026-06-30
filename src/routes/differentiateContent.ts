import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/http";
import {
  aiComplete,
  isProviderConfigured,
  type AiProvider,
} from "../lib/aiProviders";
import { GRADE_LEVELS } from "../lib/gradeLevels";
import { levelTextLocally } from "../lib/localTextLeveler";
import { READING_PROFILES } from "../lib/readingProfiles";
import {
  buildTextLevelerUserPrompt,
  TEXT_LEVELER_SYSTEM_PROMPT,
} from "../lib/textLevelerPrompt";

export const differentiateContentRouter = Router();

const schema = z.object({
  content: z.string().min(1, "Original text is required."),
  gradeLevel: z.enum(GRADE_LEVELS),
  readingProfile: z.enum(READING_PROFILES).optional().default("None"),
  provider: z.enum(["openai", "gemini", "claude"]).optional(),
  apiKey: z.string().trim().min(10).max(512).optional(),
});

differentiateContentRouter.post(
  "/differentiate-content",
  asyncHandler(async (req, res) => {
    const body = schema.parse(req.body);
    const profile = body.readingProfile ?? "None";

    const hasAi =
      isProviderConfigured("gemini", body.apiKey) ||
      isProviderConfigured("openai", body.apiKey) ||
      isProviderConfigured("claude", body.apiKey);

    if (!hasAi) {
      const output = levelTextLocally(body.content, body.gradeLevel, profile);
      return res.json({
        gradeLevel: body.gradeLevel,
        readingProfile: profile,
        content: output,
        analysisMode: "local" as const,
      });
    }

    const provider: AiProvider = (() => {
      if (body.provider && isProviderConfigured(body.provider, body.apiKey)) {
        return body.provider;
      }
      if (isProviderConfigured("openai", body.apiKey)) return "openai";
      if (isProviderConfigured("gemini", body.apiKey)) return "gemini";
      if (isProviderConfigured("claude", body.apiKey)) return "claude";
      return "openai";
    })();

    const output = await aiComplete({
      systemPrompt: TEXT_LEVELER_SYSTEM_PROMPT,
      userContent: buildTextLevelerUserPrompt(body.content, body.gradeLevel, profile),
      temperature: 0.35,
      provider,
      apiKeyOverride: body.apiKey,
    });

    res.json({
      gradeLevel: body.gradeLevel,
      readingProfile: profile,
      content: output,
      analysisMode: "ai" as const,
      providerUsed: provider,
    });
  }),
);
