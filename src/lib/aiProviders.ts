import OpenAI from "openai";
import { GROUNDING_GUARDRAIL } from "./prompts";
import { safeParseJSON } from "./json";

export type AiProvider = "openai" | "gemini" | "claude";

export class LlmConfigError extends Error {}

export interface AiProviderInfo {
  id: AiProvider;
  label: string;
  configured: boolean;
  textModel: string;
}

let openaiClient: OpenAI | null = null;

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function isAnyAiConfigured(): boolean {
  return isOpenAiConfigured() || isGeminiConfigured() || isClaudeConfigured();
}

/** @deprecated use isAnyAiConfigured — kept for existing imports */
export function isLlmConfigured(): boolean {
  return isAnyAiConfigured();
}

function openAiModel(): string {
  return process.env.LLM_TEXT_MODEL?.trim() || "gpt-4o";
}

function openAiVisionModel(): string {
  return process.env.LLM_VISION_MODEL?.trim() || "gpt-4o";
}

function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
}

function geminiVisionModel(): string {
  return process.env.GEMINI_VISION_MODEL?.trim() || geminiModel();
}

function claudeModel(): string {
  return process.env.CLAUDE_MODEL?.trim() || "claude-sonnet-4-20250514";
}

export function getConfiguredProviders(): AiProviderInfo[] {
  return [
    {
      id: "openai",
      label: "ChatGPT (OpenAI)",
      configured: isOpenAiConfigured(),
      textModel: openAiModel(),
    },
    {
      id: "gemini",
      label: "Google Gemini",
      configured: isGeminiConfigured(),
      textModel: geminiModel(),
    },
    {
      id: "claude",
      label: "Anthropic Claude",
      configured: isClaudeConfigured(),
      textModel: claudeModel(),
    },
  ];
}

export function resolveProvider(requested?: AiProvider): AiProvider {
  const preferred = (process.env.LLM_DEFAULT_PROVIDER?.trim() ||
    requested) as AiProvider | undefined;

  const order: AiProvider[] = preferred
    ? [preferred, "openai", "gemini", "claude"]
    : ["openai", "gemini", "claude"];

  const seen = new Set<AiProvider>();
  for (const p of order) {
    if (!p || seen.has(p)) continue;
    seen.add(p);
    if (p === "openai" && isOpenAiConfigured()) return p;
    if (p === "gemini" && isGeminiConfigured()) return p;
    if (p === "claude" && isClaudeConfigured()) return p;
  }

  throw new LlmConfigError(
    "No AI provider configured. Add OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY to .env.",
  );
}

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new LlmConfigError("OPENAI_API_KEY is not set.");
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return openaiClient;
}

export interface AiCompletionOptions {
  systemPrompt: string;
  userContent: string;
  provider?: AiProvider;
  temperature?: number;
  json?: boolean;
  /** Per-request key from the browser (localhost) when .env has no key. */
  apiKeyOverride?: string;
}

function resolveApiKey(provider: AiProvider, override?: string): string {
  const key = override?.trim();
  if (key) return key;
  if (provider === "openai") {
    const env = process.env.OPENAI_API_KEY?.trim();
    if (!env) throw new LlmConfigError("OPENAI_API_KEY is not set.");
    return env;
  }
  if (provider === "gemini") {
    const env = process.env.GEMINI_API_KEY?.trim();
    if (!env) throw new LlmConfigError("GEMINI_API_KEY is not set.");
    return env;
  }
  const env = process.env.ANTHROPIC_API_KEY?.trim();
  if (!env) throw new LlmConfigError("ANTHROPIC_API_KEY is not set.");
  return env;
}

export function isProviderConfigured(provider: AiProvider, apiKeyOverride?: string): boolean {
  if (apiKeyOverride?.trim()) return true;
  if (provider === "openai") return isOpenAiConfigured();
  if (provider === "gemini") return isGeminiConfigured();
  return isClaudeConfigured();
}

async function completeOpenAi(opts: AiCompletionOptions): Promise<string> {
  const apiKey = resolveApiKey("openai", opts.apiKeyOverride);
  const client =
    opts.apiKeyOverride?.trim()
      ? new OpenAI({
          apiKey,
          baseURL: process.env.OPENAI_BASE_URL || undefined,
        })
      : getOpenAiClient();
  const res = await client.chat.completions.create({
    model: openAiModel(),
    temperature: opts.temperature ?? 0.2,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    messages: [
      {
        role: "system",
        content: `${opts.systemPrompt}\n\n${GROUNDING_GUARDRAIL}`,
      },
      { role: "user", content: opts.userContent },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

async function completeGemini(opts: AiCompletionOptions): Promise<string> {
  const apiKey = resolveApiKey("gemini", opts.apiKeyOverride);

  const system = opts.json
    ? `${opts.systemPrompt}\n\n${GROUNDING_GUARDRAIL}\nRespond with valid JSON only.`
    : `${opts.systemPrompt}\n\n${GROUNDING_GUARDRAIL}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: opts.userContent }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.2,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(body.error?.message ?? `Gemini error (${res.status})`);
  }

  return body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
}

async function completeClaude(opts: AiCompletionOptions): Promise<string> {
  const apiKey = resolveApiKey("claude", opts.apiKeyOverride);

  const system = opts.json
    ? `${opts.systemPrompt}\n\n${GROUNDING_GUARDRAIL}\nRespond with valid JSON only, no markdown fences.`
    : `${opts.systemPrompt}\n\n${GROUNDING_GUARDRAIL}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: claudeModel(),
      max_tokens: 8192,
      temperature: opts.temperature ?? 0.2,
      system,
      messages: [{ role: "user", content: opts.userContent }],
    }),
  });

  const body = (await res.json()) as {
    content?: { type: string; text?: string }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(body.error?.message ?? `Claude error (${res.status})`);
  }

  return body.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
}

function resolveProviderWithOverride(opts: AiCompletionOptions): AiProvider {
  if (opts.apiKeyOverride?.trim() && opts.provider) return opts.provider;
  return resolveProvider(opts.provider);
}

export async function aiComplete(opts: AiCompletionOptions): Promise<string> {
  const provider = resolveProviderWithOverride(opts);
  switch (provider) {
    case "openai":
      return completeOpenAi(opts);
    case "gemini":
      return completeGemini(opts);
    case "claude":
      return completeClaude(opts);
  }
}

export async function aiCompleteJSON<T = unknown>(
  opts: Omit<AiCompletionOptions, "json">,
): Promise<{ data: T; provider: AiProvider }> {
  const provider = resolveProviderWithOverride(opts);
  const raw = await aiComplete({ ...opts, provider, json: true });
  return { data: safeParseJSON<T>(raw), provider };
}

export async function aiTranscribeImages(
  systemPrompt: string,
  dataUrls: string[],
  provider?: AiProvider,
): Promise<{ text: string; provider: AiProvider }> {
  const resolved = resolveProvider(provider);

  if (resolved === "openai") {
    const res = await getOpenAiClient().chat.completions.create({
      model: openAiVisionModel(),
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe the following document page(s)." },
            ...dataUrls.map((url) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          ],
        },
      ],
    });
    return {
      text: res.choices[0]?.message?.content?.trim() ?? "",
      provider: "openai",
    };
  }

  if (resolved === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY!.trim();
    const parts: { text?: string; inline_data?: { mime_type: string; data: string } }[] = [
      { text: systemPrompt + "\n\nTranscribe the following document page(s)." },
    ];
    for (const url of dataUrls) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/s);
      if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiVisionModel()}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0 },
        }),
      },
    );
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
    return { text, provider: "gemini" };
  }

  // Claude vision
  const apiKey = process.env.ANTHROPIC_API_KEY!.trim();
  const content: { type: string; text?: string; source?: object }[] = [
    { type: "text", text: "Transcribe the following document page(s)." },
  ];
  for (const url of dataUrls) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: match[1],
          data: match[2],
        },
      });
    }
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: claudeModel(),
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content }],
    }),
  });

  const body = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = body.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  return { text, provider: "claude" };
}
