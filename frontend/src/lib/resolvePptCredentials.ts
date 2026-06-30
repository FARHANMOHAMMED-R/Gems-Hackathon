import { loadAssistantAiConfig } from "./assistantAiConfig";
import { loadSkyworkPptApiKey } from "./pptAiConfig";
import { DEFAULT_TEXT_LEVELER_PROVIDER } from "./aiProviderDefaults";
import {
  loadTextLevelerAiConfig,
  type TextLevelerProvider,
} from "./textLevelerAiConfig";

function resolveSavedOrAssistantGemini(): {
  provider: TextLevelerProvider;
  apiKey: string;
} | null {
  const saved = loadTextLevelerAiConfig();
  if (saved?.apiKey && saved.apiKey.length >= 10 && saved.provider === "gemini") {
    return { provider: "gemini", apiKey: saved.apiKey };
  }

  const assistant = loadAssistantAiConfig();
  if (
    assistant?.apiKey &&
    assistant.apiKey.length >= 10 &&
    assistant.provider === "gemini"
  ) {
    return { provider: "gemini", apiKey: assistant.apiKey };
  }

  return null;
}

export function resolveGemsApiKey(
  formKey: string,
  formProvider: TextLevelerProvider,
): { provider: TextLevelerProvider; apiKey: string } | null {
  const trimmed = formKey.trim();
  if (trimmed.length >= 10) {
    return { provider: formProvider, apiKey: trimmed };
  }

  const gemini = resolveSavedOrAssistantGemini();
  if (gemini) return gemini;

  const saved = loadTextLevelerAiConfig();
  if (
    saved?.apiKey &&
    saved.apiKey.length >= 10 &&
    saved.provider === "openai" &&
    formProvider === "openai"
  ) {
    return { provider: saved.provider, apiKey: saved.apiKey };
  }

  const assistant = loadAssistantAiConfig();
  if (
    assistant?.apiKey &&
    assistant.apiKey.length >= 10 &&
    assistant.provider === "openai" &&
    formProvider === "openai"
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

/** Default provider when no saved preference exists. */
export function defaultGemsProvider(): TextLevelerProvider {
  const saved = loadTextLevelerAiConfig();
  if (saved?.provider) return saved.provider;
  const assistant = loadAssistantAiConfig();
  if (assistant?.provider === "gemini") return "gemini";
  return DEFAULT_TEXT_LEVELER_PROVIDER;
}
