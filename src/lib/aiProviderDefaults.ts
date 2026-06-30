import type { AiProvider } from "./aiProviders";

/** Primary AI provider for all server-side features. */
export const DEFAULT_AI_PROVIDER: AiProvider = "gemini";

/** Provider try-order when multiple keys are configured. */
export const AI_PROVIDER_PRIORITY: AiProvider[] = ["gemini", "openai", "claude"];
