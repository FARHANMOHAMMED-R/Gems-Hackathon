import OpenAI from "openai";
import { GROUNDING_GUARDRAIL } from "./prompts";

/**
 * Thin, provider-agnostic wrapper around an OpenAI-compatible Chat Completions
 * API. Centralizes: client construction, low-temperature grounded defaults,
 * JSON-mode parsing, and multimodal (vision) transcription.
 */

let client: OpenAI | null = null;

/** Lazily construct the client so the server can boot without a key present. */
function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new LlmConfigError(
      "OPENAI_API_KEY is not set. Add it to your environment to enable AI endpoints."
    );
  }
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return client;
}

export class LlmConfigError extends Error {}

/** True when an OpenAI-compatible API key is present. */
export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

const TEXT_MODEL = () => process.env.LLM_TEXT_MODEL || "gpt-4o";
const VISION_MODEL = () => process.env.LLM_VISION_MODEL || "gpt-4o";

/** Low temperature keeps responses grounded and deterministic. */
const GROUNDED_TEMPERATURE = 0.2;

interface CompletionOptions {
  systemPrompt: string;
  userContent: string;
  /** When true, request strict JSON and parse it before returning. */
  json?: boolean;
  temperature?: number;
}

/**
 * Run a single-turn grounded completion. The grounding guardrail is appended
 * to every system prompt so model output never drifts into boilerplate.
 */
export async function complete(opts: CompletionOptions): Promise<string> {
  const { systemPrompt, userContent, temperature } = opts;
  const res = await getClient().chat.completions.create({
    model: TEXT_MODEL(),
    temperature: temperature ?? GROUNDED_TEMPERATURE,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    messages: [
      { role: "system", content: `${systemPrompt}\n\n${GROUNDING_GUARDRAIL}` },
      { role: "user", content: userContent },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

/**
 * Run a grounded completion that must return JSON, then parse it.
 * Throws if the model returns malformed JSON.
 */
export async function completeJSON<T = unknown>(
  opts: Omit<CompletionOptions, "json">
): Promise<T> {
  const raw = await complete({ ...opts, json: true });
  return safeParseJSON<T>(raw);
}

/**
 * Transcribe one or more scanned pages (base64 data URLs) into plain text via
 * a multimodal model. Used as the OCR step ahead of grading.
 *
 * @param dataUrls Array of `data:<mime>;base64,...` strings (images). PDFs
 *                 should be pre-rendered to page images by the caller/front end.
 */
export async function transcribeDocument(
  systemPrompt: string,
  dataUrls: string[]
): Promise<string> {
  const res = await getClient().chat.completions.create({
    model: VISION_MODEL(),
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text" as const,
            text: "Transcribe the following document page(s).",
          },
          ...dataUrls.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ],
      },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

/** Defensive JSON parse that tolerates models wrapping output in code fences. */
export function safeParseJSON<T = unknown>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Last-resort: extract the first {...} or [...] block.
    const match = cleaned.match(/[{[][\s\S]*[}\]]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Model did not return valid JSON.");
  }
}
