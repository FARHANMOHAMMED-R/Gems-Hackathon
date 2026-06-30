/** Detect OpenAI/Gemini quota, billing, and rate-limit failures. */
export function isAiQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|quota|billing|rate.?limit|insufficient|exceeded your current/i.test(msg);
}

export function friendlyAiErrorMessage(err: unknown, provider?: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (isAiQuotaError(err)) {
    if (provider === "openai" || /openai/i.test(raw)) {
      return (
        "OpenAI credits are used up — switched to Google Gemini. Paste a free key at aistudio.google.com/apikey below, then generate again."
      );
    }
    return "AI rate limit or quota reached. Wait a minute or switch provider in the dropdown below.";
  }
  if (/invalid.*api.?key|incorrect api key|401|403/i.test(raw)) {
    return "Invalid API key — check the key and try again, or switch provider.";
  }
  return raw || "AI request failed.";
}
