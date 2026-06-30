import { ApiError } from "./http";

/** Detect OpenAI/Gemini quota, billing, and rate-limit failures. */
export function isAiQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|quota|billing|rate.?limit|insufficient|exceeded your current/i.test(msg);
}

export function friendlyAiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (isAiQuotaError(err)) {
    if (/openai/i.test(raw)) {
      return (
        "OpenAI credits are used up. Use Google Gemini (free at aistudio.google.com/apikey) instead."
      );
    }
    return "AI rate limit or quota reached. Wait a minute or try another provider.";
  }
  return raw || "AI request failed.";
}

export function toAiHttpError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (isAiQuotaError(err)) {
    return new ApiError(429, friendlyAiErrorMessage(err), "AI_QUOTA_EXCEEDED");
  }
  const msg = err instanceof Error ? err.message : "AI request failed.";
  return new ApiError(422, msg, "AI_REQUEST_FAILED");
}
