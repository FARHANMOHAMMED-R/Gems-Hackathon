import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/http";
import { complete, isLlmConfigured } from "../lib/llm";
import { DIFFERENTIATION_PROMPTS } from "../lib/prompts";
import { differentiateLocally } from "../lib/localContentDifferentiator";

export const differentiateContentRouter = Router();

const schema = z.object({
  content: z.string().min(1, "content is required"),
  target: z.enum([
    "Advanced",
    "Standard",
    "Simplified Visual",
    "Neurodivergent",
  ]),
});

differentiateContentRouter.post(
  "/differentiate-content",
  asyncHandler(async (req, res) => {
    const { content, target } = schema.parse(req.body);

    if (!isLlmConfigured()) {
      const output = differentiateLocally(content, target);
      return res.json({ target, content: output, analysisMode: "local" as const });
    }

    const systemPrompt = DIFFERENTIATION_PROMPTS[target];
    const output = await complete({
      systemPrompt,
      userContent: `Source lesson content to transform:\n\n${content}`,
      temperature: 0.4,
    });

    res.json({ target, content: output, analysisMode: "ai" as const });
  }),
);
