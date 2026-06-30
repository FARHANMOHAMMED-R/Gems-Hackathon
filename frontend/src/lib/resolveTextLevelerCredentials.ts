import { loadAssistantAiConfig, type AssistantAiProvider } from "./assistantAiConfig";
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

export function resolveTextLevelerCredentials(
  formProvider: TextLevelerProvider,
  formApiKey: string,
  backendProviders: { id: string; configured: boolean }[],
): TextLevelerCredentials | null {
  const trimmed = formApiKey.trim();
  if (trimmed.length >= 10) {
    return { provider: formProvider, apiKey: trimmed, source: "form" };
  }

  const saved = loadTextLevelerAiConfig();
  if (saved?.apiKey && saved.apiKey.length >= 10) {
    return { provider: saved.provider, apiKey: saved.apiKey, source: "saved" };
  }

  const assistant = loadAssistantAiConfig();
  if (
    assistant?.apiKey &&
    assistant.apiKey.length >= 10 &&
    isTextLevelerProvider(assistant.provider)
  ) {
    return {
      provider: assistant.provider,
      apiKey: assistant.apiKey,
      source: "assistant",
    };
  }

  const backendMatch = backendProviders.find(
    (p) => p.configured && p.id === formProvider && isTextLevelerProvider(p.id),
  );
  if (backendMatch) {
    return { provider: formProvider, source: "backend" };
  }

  const anyBackend = backendProviders.find(
    (p) => p.configured && isTextLevelerProvider(p.id),
  );
  if (anyBackend && isTextLevelerProvider(anyBackend.id)) {
    return { provider: anyBackend.id, source: "backend" };
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
