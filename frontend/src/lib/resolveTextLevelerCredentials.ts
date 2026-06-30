import { loadAssistantAiConfig, type AssistantAiProvider } from "./assistantAiConfig";
import {
  DEFAULT_TEXT_LEVELER_PROVIDER,
  TEXT_LEVELER_PROVIDER_ORDER,
} from "./aiProviderDefaults";
import {
  loadTextLevelerAiConfig,
  saveTextLevelerAiConfig,
  type TextLevelerProvider,
} from "./textLevelerAiConfig";

export type TextLevelerCredentialSource = "form" | "saved" | "assistant" | "backend";

export interface TextLevelerCredentials {
  provider: TextLevelerProvider;
  apiKey?: string;
  source: TextLevelerCredentialSource;
}

export function isTextLevelerProvider(id: string): id is TextLevelerProvider {
  return id === "openai" || id === "gemini";
}

function resolveGeminiCredentials(): TextLevelerCredentials | null {
  const saved = loadTextLevelerAiConfig();
  if (saved?.apiKey && saved.apiKey.length >= 10 && saved.provider === "gemini") {
    return { provider: "gemini", apiKey: saved.apiKey, source: "saved" };
  }

  const assistant = loadAssistantAiConfig();
  if (
    assistant?.apiKey &&
    assistant.apiKey.length >= 10 &&
    assistant.provider === "gemini"
  ) {
    return { provider: "gemini", apiKey: assistant.apiKey, source: "assistant" };
  }

  return null;
}

export function resolveTextLevelerCredentials(
  formProvider: TextLevelerProvider,
  formApiKey: string,
  backendProviders: { id: string; configured: boolean }[],
): TextLevelerCredentials | null {
  const trimmed = formApiKey.trim();
  if (trimmed.length >= 10) {
    return { provider: formProvider, apiKey: trimmed, source: "form" };
  }

  const gemini = resolveGeminiCredentials();
  if (gemini) return gemini;

  const saved = loadTextLevelerAiConfig();
  if (
    saved?.apiKey &&
    saved.apiKey.length >= 10 &&
    saved.provider === "openai" &&
    formProvider === "openai"
  ) {
    return { provider: saved.provider, apiKey: saved.apiKey, source: "saved" };
  }

  const assistant = loadAssistantAiConfig();
  if (
    assistant?.apiKey &&
    assistant.apiKey.length >= 10 &&
    assistant.provider === "openai" &&
    formProvider === "openai"
  ) {
    return {
      provider: assistant.provider,
      apiKey: assistant.apiKey,
      source: "assistant",
    };
  }

  for (const id of TEXT_LEVELER_PROVIDER_ORDER) {
    const backendMatch = backendProviders.find((p) => p.configured && p.id === id);
    if (backendMatch && isTextLevelerProvider(backendMatch.id)) {
      return { provider: backendMatch.id, source: "backend" };
    }
  }

  return null;
}

export function persistTextLevelerCredentials(creds: TextLevelerCredentials): void {
  if (creds.apiKey && creds.source !== "backend") {
    saveTextLevelerAiConfig({ provider: creds.provider, apiKey: creds.apiKey });
  }
}

export function assistantProviderLabel(provider: AssistantAiProvider): TextLevelerProvider {
  return provider;
}

export function defaultTextLevelerProvider(): TextLevelerProvider {
  const saved = loadTextLevelerAiConfig();
  if (saved?.provider === "gemini") return "gemini";
  const assistant = loadAssistantAiConfig();
  if (assistant?.provider === "gemini") return "gemini";
  return DEFAULT_TEXT_LEVELER_PROVIDER;
}
