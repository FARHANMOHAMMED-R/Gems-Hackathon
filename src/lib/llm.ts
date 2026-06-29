/**
 * Backward-compatible LLM facade — delegates to multi-provider aiProviders.
 */
import {
  aiComplete,
  aiCompleteJSON,
  aiTranscribeImages,
  isAnyAiConfigured,
  isLlmConfigured,
  LlmConfigError,
  type AiProvider,
} from "./aiProviders";
import { safeParseJSON } from "./json";

export {
  isLlmConfigured,
  LlmConfigError,
  safeParseJSON,
  type AiProvider,
};

export { isAnyAiConfigured, getConfiguredProviders } from "./aiProviders";

interface CompletionOptions {
  systemPrompt: string;
  userContent: string;
  provider?: AiProvider;
  temperature?: number;
  json?: boolean;
}

export async function complete(opts: CompletionOptions): Promise<string> {
  return aiComplete(opts);
}

export async function completeJSON<T = unknown>(
  opts: Omit<CompletionOptions, "json">,
): Promise<T> {
  const { data } = await aiCompleteJSON<T>(opts);
  return data;
}

export async function transcribeDocument(
  systemPrompt: string,
  dataUrls: string[],
  provider?: AiProvider,
): Promise<string> {
  const { text } = await aiTranscribeImages(systemPrompt, dataUrls, provider);
  return text;
}
