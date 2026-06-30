export type TextLevelerProvider = "openai" | "gemini";

const STORAGE_KEY = "gems-assist-text-leveler-ai";
const LEGACY_OPENAI_KEY = "gems-assist-text-leveler-openai";

export interface TextLevelerAiConfig {
  provider: TextLevelerProvider;
  apiKey: string;
}

export const TEXT_LEVELER_PROVIDER_LABELS: Record<TextLevelerProvider, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI (ChatGPT)",
};

export const TEXT_LEVELER_PROVIDER_HINTS: Record<TextLevelerProvider, string> = {
  gemini: "Free key at aistudio.google.com/apikey — stored in this browser only.",
  openai: "Key at platform.openai.com/api-keys — stored in this browser only.",
};

export const TEXT_LEVELER_PROVIDER_PLACEHOLDERS: Record<TextLevelerProvider, string> = {
  gemini: "AIza…",
  openai: "sk-…",
};

/** Dropdown order — Gemini first everywhere. */
export const TEXT_LEVELER_PROVIDERS: TextLevelerProvider[] = ["gemini", "openai"];

function migrateLegacyOpenAiKey(): TextLevelerAiConfig | null {
  try {
    const raw = localStorage.getItem(LEGACY_OPENAI_KEY);
    if (raw && raw.trim().length >= 10) {
      const config: TextLevelerAiConfig = { provider: "openai", apiKey: raw.trim() };
      saveTextLevelerAiConfig(config);
      localStorage.removeItem(LEGACY_OPENAI_KEY);
      return config;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function loadTextLevelerAiConfig(): TextLevelerAiConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<TextLevelerAiConfig>;
      if (
        (parsed.provider === "openai" || parsed.provider === "gemini") &&
        typeof parsed.apiKey === "string" &&
        parsed.apiKey.trim().length >= 10
      ) {
        return { provider: parsed.provider, apiKey: parsed.apiKey.trim() };
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return migrateLegacyOpenAiKey();
}

export function saveTextLevelerAiConfig(config: TextLevelerAiConfig): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      provider: config.provider,
      apiKey: config.apiKey.trim(),
    }),
  );
}

export function clearTextLevelerAiConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_OPENAI_KEY);
}

/** @deprecated use loadTextLevelerAiConfig */
export function loadTextLevelerOpenAiKey(): string {
  const config = loadTextLevelerAiConfig();
  return config?.provider === "openai" ? config.apiKey : "";
}

/** @deprecated use saveTextLevelerAiConfig */
export function saveTextLevelerOpenAiKey(key: string): void {
  saveTextLevelerAiConfig({ provider: "openai", apiKey: key });
}

/** @deprecated use clearTextLevelerAiConfig */
export function clearTextLevelerOpenAiKey(): void {
  clearTextLevelerAiConfig();
}
