import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ApiError } from "../lib/http";
import {
  aiCompleteJSON,
  getConfiguredProviders,
  isAnyAiConfigured,
  type AiProvider,
} from "../lib/aiProviders";
import { generatePptLocally } from "../lib/localPptGenerator";
import { buildPptxBuffer, deckFileName, type PptDeck } from "../lib/pptBuilder";
import { PPT_SYSTEM_PROMPT } from "../lib/prompts";

export const pptRouter = Router();
export const aiRouter = Router();

const providerSchema = z.enum(["openai", "gemini", "claude"]).optional();

const generateSchema = z.object({
  classManaged: z.string().min(1),
  grade: z.string().min(1),
  subject: z.string().trim().min(1).default("Physics"),
  topic: z.string().trim().min(1, "Enter a lesson topic."),
  chapters: z.string().trim().min(1, "Enter chapters to cover."),
  slideCount: z.coerce.number().int().min(4).max(25).default(10),
  audience: z.enum(["students", "teachers"]).default("students"),
  additionalNotes: z.string().trim().optional(),
  provider: providerSchema,
});

aiRouter.get(
  "/ai/providers",
  asyncHandler(async (_req, res) => {
    res.json({ providers: getConfiguredProviders() });
  }),
);

pptRouter.post(
  "/generate-ppt",
  asyncHandler(async (req, res) => {
    const body = generateSchema.parse(req.body);

    let deck: PptDeck;
    let analysisMode: "ai" | "local";
    let providerUsed: AiProvider | "local" = "local";

    if (isAnyAiConfigured()) {
      const { data, provider } = await aiCompleteJSON<PptDeck>({
        provider: body.provider,
        systemPrompt: PPT_SYSTEM_PROMPT,
        userContent: [
          `Class: ${body.classManaged} (Grade ${body.grade})`,
          `Subject: ${body.subject}`,
          `Lesson topic: ${body.topic}`,
          `Chapters: ${body.chapters}`,
          `Target slide count: ${body.slideCount}`,
          `Audience: ${body.audience}`,
          body.additionalNotes ? `Teacher notes: ${body.additionalNotes}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        temperature: 0.4,
      });

      if (!data.slides?.length) {
        throw new ApiError(422, "AI did not return any slides. Try again.");
      }

      deck = {
        title: data.title || body.topic,
        subtitle: data.subtitle || `${body.subject} · Grade ${body.grade}`,
        subject: data.subject || body.subject,
        grade: data.grade || body.grade,
        slides: data.slides,
      };
      analysisMode = "ai";
      providerUsed = provider;
    } else {
      deck = generatePptLocally({
        classManaged: body.classManaged,
        grade: body.grade,
        subject: body.subject,
        topic: body.topic,
        chapters: body.chapters,
        slideCount: body.slideCount,
      });
      analysisMode = "local";
    }

    const buffer = await buildPptxBuffer(deck);
    const fileName = deckFileName(deck, body.classManaged);

    res.json({
      deck,
      fileName,
      pptxBase64: buffer.toString("base64"),
      analysisMode,
      providerUsed,
      slideCount: deck.slides.length,
    });
  }),
);
