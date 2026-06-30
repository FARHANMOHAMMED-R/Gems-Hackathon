import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/http";
import {
  aiCompleteJSON,
  isClaudeConfigured,
  isGeminiConfigured,
  isOpenAiConfigured,
  type AiProvider,
} from "../lib/aiProviders";
import { fetchWikipediaAnswer, isGeneralKnowledgeQuestion } from "../lib/generalKnowledge";
import { ASSISTANT_SYSTEM_PROMPT } from "../lib/prompts";
import { isAssistantNavId, localAssistantAnswer } from "../lib/localAssistant";

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
  provider: z.enum(["openai", "gemini", "claude"]).optional(),
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
  return lines.join("\n");
}

/** Assistant prefers Gemini for general knowledge, then OpenAI. */
function pickAssistantProvider(requested?: AiProvider): AiProvider | null {
  if (requested === "gemini" && isGeminiConfigured()) return "gemini";
  if (requested === "openai" && isOpenAiConfigured()) return "openai";
  if (requested === "claude" && isClaudeConfigured()) return "claude";
  if (isGeminiConfigured()) return "gemini";
  if (isOpenAiConfigured()) return "openai";
  if (isClaudeConfigured()) return "claude";
  return null;
}

function sanitizeNav(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const id = raw.trim();
  return isAssistantNavId(id) ? id : undefined;
}

assistantRouter.post(
  "/assistant/chat",
  asyncHandler(async (req, res) => {
    const body = chatSchema.parse(req.body);
    const context = { teacherName: body.teacherName, classManaged: body.classManaged };

    const appLocal = localAssistantAnswer(body.message, context);
    if (appLocal.navigateTo) {
      res.json({ ...appLocal, analysisMode: "local" as const });
      return;
    }

    const provider = pickAssistantProvider(body.provider);

    if (provider) {
      try {
        const { data: result, provider: providerUsed } = await aiCompleteJSON<{
          reply: string;
          navigateTo?: string | null;
        }>({
          systemPrompt: ASSISTANT_SYSTEM_PROMPT,
          userContent: buildUserContent(body.message, body.history, context),
          temperature: 0.55,
          provider,
        });

        const navigateTo = sanitizeNav(result.navigateTo);
        res.json({
          reply: result.reply?.trim() || appLocal.reply,
          navigateTo,
          analysisMode: "ai" as const,
          providerUsed,
        });
        return;
      } catch {
        // Fall through to Wikipedia / local below
      }
    }

    if (isGeneralKnowledgeQuestion(body.message)) {
      const wiki = await fetchWikipediaAnswer(body.message);
      if (wiki) {
        res.json({
          reply: wiki,
          analysisMode: "local" as const,
          source: "wikipedia" as const,
        });
        return;
      }
    }

    res.json({ ...appLocal, analysisMode: "local" as const });
  }),
);
