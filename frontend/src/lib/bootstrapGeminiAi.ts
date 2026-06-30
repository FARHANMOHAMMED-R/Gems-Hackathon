import { saveAssistantAiConfig } from "./assistantAiConfig";
import { loadTextLevelerAiConfig, saveTextLevelerAiConfig } from "./textLevelerAiConfig";

const BOOTSTRAP_FLAG = "gems-assist-gemini-bootstrapped";

/** Seed browser storage from VITE_GEMINI_API_KEY (frontend/.env.local). */
export function bootstrapGeminiFromEnv(): boolean {
  const fromVite = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (!fromVite || fromVite.length < 10) return false;

  const existing = loadTextLevelerAiConfig();
  if (existing?.provider === "gemini" && existing.apiKey.length >= 10) {
    return true;
  }

  try {
    const marker = localStorage.getItem(BOOTSTRAP_FLAG);
    if (marker === fromVite.slice(-8)) return true;
    localStorage.setItem(BOOTSTRAP_FLAG, fromVite.slice(-8));
  } catch {
    /* ignore */
  }

  persistGeminiKeyEverywhere(fromVite);
  return true;
}

/** Save Gemini key to Text Leveler + AI assistant (shared across all tools). */
export function persistGeminiKeyEverywhere(apiKey: string): void {
  const trimmed = apiKey.trim();
  if (trimmed.length < 10) return;
  saveTextLevelerAiConfig({ provider: "gemini", apiKey: trimmed });
  saveAssistantAiConfig({ provider: "gemini", apiKey: trimmed });
}
