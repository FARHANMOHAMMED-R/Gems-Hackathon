import { ApiError } from "./http";
import { isGuruPdfConfigured, guruPdfOcrImages } from "./gurupdfOcr";
import {
  aiTranscribeImages,
  isAnyAiConfigured,
  isClaudeConfigured,
  isGeminiConfigured,
  isOpenAiConfigured,
  isProviderConfigured,
  type AiProvider,
} from "./aiProviders";
import { ocrImages } from "./ocr";
import { VISION_TRANSCRIBE_SYSTEM_PROMPT } from "./prompts";

export type OcrMode = "pasted" | "gurupdf" | "openai" | "gemini" | "claude" | "tesseract";

/** Which OCR backends are available on this server. */
export function getOcrStatus() {
  return {
    openai: isOpenAiConfigured(),
    gemini: isGeminiConfigured(),
    claude: isClaudeConfigured(),
    gurupdf: isGuruPdfConfigured(),
    tesseract: true,
    recommended:
      isAnyAiConfigured() || isGuruPdfConfigured() ? "ai" : "tesseract",
  };
}

async function tryProvider(
  name: OcrMode,
  fn: () => Promise<string>,
): Promise<{ text: string; mode: OcrMode } | null> {
  try {
    const text = (await fn()).trim();
    const minLen = name === "tesseract" ? 2 : 8;
    if (text.length >= minLen) return { text, mode: name };
    return null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[scan-ocr] ${name} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Extract text from scan images using every configured backend, best-first.
 */
export async function digitizeScanImages(
  dataUrls: string[],
  _mode: "Exam Paper" | "Notebook",
  opts?: { provider?: AiProvider; apiKey?: string },
): Promise<{ rawText: string; ocrMode: OcrMode }> {
  const browserKey = opts?.apiKey?.trim();
  const browserProvider = opts?.provider;

  const attempts: { name: OcrMode; fn: () => Promise<string> }[] = [];

  const addAiAttempts = (apiKey?: string, provider?: AiProvider) => {
    const useProvider = (p: AiProvider) =>
      isProviderConfigured(p, apiKey) &&
      (!provider || provider === p);

    if (useProvider("gemini")) {
      attempts.push({
        name: "gemini",
        fn: async () =>
          (
            await aiTranscribeImages(
              VISION_TRANSCRIBE_SYSTEM_PROMPT,
              dataUrls,
              "gemini",
              apiKey,
            )
          ).text,
      });
    }
    if (useProvider("openai")) {
      attempts.push({
        name: "openai",
        fn: async () =>
          (
            await aiTranscribeImages(
              VISION_TRANSCRIBE_SYSTEM_PROMPT,
              dataUrls,
              "openai",
              apiKey,
            )
          ).text,
      });
    }
    if (useProvider("claude")) {
      attempts.push({
        name: "claude",
        fn: async () =>
          (
            await aiTranscribeImages(
              VISION_TRANSCRIBE_SYSTEM_PROMPT,
              dataUrls,
              "claude",
              apiKey,
            )
          ).text,
      });
    }
  };

  if (browserKey && browserProvider) {
    addAiAttempts(browserKey, browserProvider);
  }

  if (isGuruPdfConfigured()) {
    attempts.push({ name: "gurupdf", fn: () => guruPdfOcrImages(dataUrls) });
  }
  addAiAttempts();
  attempts.push({ name: "tesseract", fn: () => ocrImages(dataUrls) });

  for (const attempt of attempts) {
    const result = await tryProvider(attempt.name, attempt.fn);
    if (result) return { rawText: result.text, ocrMode: result.mode };
  }

  const status = getOcrStatus();
  const hints: string[] = [];
  if (!status.openai && !status.gemini && !status.claude && !status.gurupdf && !browserKey) {
    hints.push(
      "Open the ✦ AI assistant (bottom-right), tap ⚙, and add a free Gemini or OpenAI key — or set keys in backend .env.",
    );
  }
  hints.push("Use a clear photo of the notebook page, or paste the note text in Scanned text.");

  throw new ApiError(
    422,
    `Could not extract text from the image. ${hints.join(" ")}`,
    "OCR_EMPTY",
  );
}
