import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/http";
import {
  aiComplete,
  isProviderConfigured,
  type AiProvider,
} from "../lib/aiProviders";
import { isAiQuotaError } from "../lib/aiErrors";
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

function providersToTry(requested: AiProvider | undefined, apiKey?: string): AiProvider[] {
  const order: AiProvider[] = [];
  if (requested && isProviderConfigured(requested, apiKey)) order.push(requested);
  for (const p of ["gemini", "openai", "claude"] as AiProvider[]) {
    if (isProviderConfigured(p, apiKey) && !order.includes(p)) order.push(p);
  }
  return order;
}

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

    const candidates = providersToTry(body.provider, body.apiKey);
    let lastError: unknown;

    for (const provider of candidates) {
      try {
        const output = await aiComplete({
          systemPrompt: TEXT_LEVELER_SYSTEM_PROMPT,
          userContent: buildTextLevelerUserPrompt(body.content, body.gradeLevel, profile),
          temperature: 0.35,
          provider,
          apiKeyOverride: body.apiKey,
        });

        return res.json({
          gradeLevel: body.gradeLevel,
          readingProfile: profile,
          content: output,
          analysisMode: "ai" as const,
          providerUsed: provider,
        });
      } catch (err) {
        lastError = err;
        if (isAiQuotaError(err) && candidates.length > 1) continue;
        throw err;
      }
    }

    throw lastError ?? new Error("AI request failed.");
  }),
);
