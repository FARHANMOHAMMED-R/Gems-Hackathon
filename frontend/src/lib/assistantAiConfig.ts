import type { AiProvider } from "../api/types";

const STORAGE_KEY = "gems-assist-ai-config";

export type AssistantAiProvider = Extract<AiProvider, "openai" | "gemini">;

export interface AssistantAiConfig {
  provider: AssistantAiProvider;
  apiKey: string;
}

export function loadAssistantAiConfig(): AssistantAiConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AssistantAiConfig>;
    if (
      (parsed.provider === "openai" || parsed.provider === "gemini") &&
      typeof parsed.apiKey === "string" &&
      parsed.apiKey.trim().length >= 10
    ) {
      return { provider: parsed.provider, apiKey: parsed.apiKey.trim() };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return null;
}

export function saveAssistantAiConfig(config: AssistantAiConfig): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      provider: config.provider,
      apiKey: config.apiKey.trim(),
    }),
  );
}

export function clearAssistantAiConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export const ASSISTANT_PROVIDER_LABELS: Record<AssistantAiProvider, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI (ChatGPT)",
};

export const ASSISTANT_PROVIDER_HINTS: Record<AssistantAiProvider, string> = {
  gemini: "Free key at aistudio.google.com/apikey",
  openai: "Key at platform.openai.com/api-keys",
};
