import type { TextLevelerProvider } from "./textLevelerAiConfig";

/** Primary browser AI provider across teacher tools. */
export const DEFAULT_TEXT_LEVELER_PROVIDER: TextLevelerProvider = "gemini";

export const TEXT_LEVELER_PROVIDER_ORDER: TextLevelerProvider[] = ["gemini", "openai"];
