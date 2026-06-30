import { loadAssistantAiConfig } from "./assistantAiConfig";
import { loadSkyworkPptApiKey } from "./pptAiConfig";
import {
  loadTextLevelerAiConfig,
  type TextLevelerProvider,
} from "./textLevelerAiConfig";

export function resolveGemsApiKey(
  formKey: string,
  formProvider: TextLevelerProvider,
): { provider: TextLevelerProvider; apiKey: string } | null {
  const trimmed = formKey.trim();
  if (trimmed.length >= 10) {
    return { provider: formProvider, apiKey: trimmed };
  }

  const saved = loadTextLevelerAiConfig();
  if (saved?.apiKey && saved.apiKey.length >= 10) {
    return { provider: saved.provider, apiKey: saved.apiKey };
  }

  const assistant = loadAssistantAiConfig();
  if (
    assistant?.apiKey &&
    assistant.apiKey.length >= 10 &&
    (assistant.provider === "openai" || assistant.provider === "gemini")
  ) {
    return { provider: assistant.provider, apiKey: assistant.apiKey };
  }

  return null;
}

export function resolveSkyworkApiKey(formKey: string): string | null {
  const trimmed = formKey.trim();
  if (trimmed.length >= 10) return trimmed;
  const saved = loadSkyworkPptApiKey();
  return saved.length >= 10 ? saved : null;
}
