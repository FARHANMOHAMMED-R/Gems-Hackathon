import { saveAssistantAiConfig } from "./assistantAiConfig";
import { loadTextLevelerAiConfig, saveTextLevelerAiConfig } from "./textLevelerAiConfig";

const OPENAI_BOOTSTRAP_FLAG = "gems-assist-openai-bootstrapped";
const GEMINI_BOOTSTRAP_FLAG = "gems-assist-gemini-bootstrapped";

/** Seed browser storage from VITE_GEMINI_API_KEY / VITE_OPENAI_API_KEY (frontend/.env.local). */
export function bootstrapAiFromEnv(): boolean {
  let seeded = false;
  if (bootstrapGeminiFromEnv()) seeded = true;
  const existing = loadTextLevelerAiConfig();
  if (!existing?.apiKey || existing.apiKey.length < 10) {
    if (bootstrapOpenAiFromEnv()) seeded = true;
  }
  return seeded;
}

export function bootstrapOpenAiFromEnv(): boolean {
  const fromVite = import.meta.env.VITE_OPENAI_API_KEY?.trim();
  if (!fromVite || fromVite.length < 10) return false;

  const existing = loadTextLevelerAiConfig();
  if (existing?.provider === "openai" && existing.apiKey.length >= 10) {
    return true;
  }

  try {
    const marker = localStorage.getItem(OPENAI_BOOTSTRAP_FLAG);
    if (marker === fromVite.slice(-8)) return true;
    localStorage.setItem(OPENAI_BOOTSTRAP_FLAG, fromVite.slice(-8));
  } catch {
    /* ignore */
  }

  persistOpenAiKeyEverywhere(fromVite);
  return true;
}

export function bootstrapGeminiFromEnv(): boolean {
  const fromVite = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!fromVite || fromVite.length < 10) return false;

  const existing = loadTextLevelerAiConfig();
  if (existing?.provider === "gemini" && existing.apiKey.length >= 10) {
    return true;
  }

  try {
    const marker = localStorage.getItem(GEMINI_BOOTSTRAP_FLAG);
    if (marker === fromVite.slice(-8)) return true;
    localStorage.setItem(GEMINI_BOOTSTRAP_FLAG, fromVite.slice(-8));
  } catch {
    /* ignore */
  }

  persistGeminiKeyEverywhere(fromVite);
  return true;
}

/** Save OpenAI key to Text Leveler + AI assistant (shared across all tools). */
export function persistOpenAiKeyEverywhere(apiKey: string): void {
  const trimmed = apiKey.trim();
  if (trimmed.length < 10) return;
  saveTextLevelerAiConfig({ provider: "openai", apiKey: trimmed });
  saveAssistantAiConfig({ provider: "openai", apiKey: trimmed });
}

/** Save Gemini key to Text Leveler + AI assistant (shared across all tools). */
export function persistGeminiKeyEverywhere(apiKey: string): void {
  const trimmed = apiKey.trim();
  if (trimmed.length < 10) return;
  saveTextLevelerAiConfig({ provider: "gemini", apiKey: trimmed });
  saveAssistantAiConfig({ provider: "gemini", apiKey: trimmed });
}
