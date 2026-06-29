import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/http";
import { complete } from "../lib/llm";
import { DIFFERENTIATION_PROMPTS } from "../lib/prompts";

export const differentiateContentRouter = Router();

const schema = z.object({
  // Raw lesson text extracted from a source document.
  content: z.string().min(1, "content is required"),
  // Which differentiation track to render the lesson into.
  target: z.enum([
    "Advanced",
    "Standard",
    "Simplified Visual",
    "Neurodivergent",
  ]),
});

/**
 * /api/differentiate-content
 *
 * Selects the exact system prompt for the requested target track and rewrites
 * the supplied lesson text accordingly. Output is markdown (not JSON) so it can
 * be rendered directly in the study-notes UI.
 */
differentiateContentRouter.post(
  "/differentiate-content",
  asyncHandler(async (req, res) => {
    const { content, target } = schema.parse(req.body);

    // CASE switch is encoded in the prompt registry keyed by target.
    const systemPrompt = DIFFERENTIATION_PROMPTS[target];

    const output = await complete({
      systemPrompt,
      userContent: `Source lesson content to transform:\n\n${content}`,
      // Slightly higher than grading: content rewriting benefits from fluency
      // while still staying grounded to the source.
      temperature: 0.4,
    });

    res.json({ target, content: output });
  })
);
