import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/http";
import {
  aiComplete,
  isGeminiConfigured,
  isOpenAiConfigured,
  type AiProvider,
} from "../lib/aiProviders";
import { ASSISTANT_SYSTEM_PROMPT } from "../lib/prompts";
import { localAssistantReply } from "../lib/localAssistant";

export const assistantRouter = Router();

const chatSchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .max(20)
    .optional(),
  teacherName: z.string().trim().optional(),
  classManaged: z.string().trim().optional(),
});

function buildUserContent(
  message: string,
  history: { role: "user" | "assistant"; content: string }[] | undefined,
  context: { teacherName?: string; classManaged?: string },
): string {
  const lines: string[] = [];
  if (context.teacherName) lines.push(`Teacher name: ${context.teacherName}`);
  if (context.classManaged) lines.push(`Class: ${context.classManaged}`);
  if (lines.length) lines.push("");

  const recent = (history ?? []).slice(-10);
  for (const turn of recent) {
    lines.push(`${turn.role === "user" ? "Teacher" : "Assistant"}: ${turn.content}`);
  }
  lines.push(`Teacher: ${message}`);
  lines.push("Assistant:");
  return lines.join("\n");
}

function pickProvider(): AiProvider | null {
  if (isOpenAiConfigured()) return "openai";
  if (isGeminiConfigured()) return "gemini";
  return null;
}

assistantRouter.post(
  "/assistant/chat",
  asyncHandler(async (req, res) => {
    const body = chatSchema.parse(req.body);
    const context = { teacherName: body.teacherName, classManaged: body.classManaged };

    const provider = pickProvider();
    if (!provider) {
      res.json({
        reply: localAssistantReply(body.message, context),
        analysisMode: "local" as const,
      });
      return;
    }

    const reply = await aiComplete({
      systemPrompt: ASSISTANT_SYSTEM_PROMPT,
      userContent: buildUserContent(body.message, body.history, context),
      temperature: 0.55,
      provider,
    });

    res.json({
      reply: reply.trim() || localAssistantReply(body.message, context),
      analysisMode: "ai" as const,
      providerUsed: provider,
    });
  }),
);
