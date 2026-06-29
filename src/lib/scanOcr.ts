import { ApiError } from "./http";
import { isGuruPdfConfigured, guruPdfOcrImages } from "./gurupdfOcr";
import {
  aiTranscribeImages,
  isAnyAiConfigured,
  isClaudeConfigured,
  isGeminiConfigured,
  isOpenAiConfigured,
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
    if (text.length >= 8) return { text, mode: name };
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
): Promise<{ rawText: string; ocrMode: OcrMode }> {
  const attempts: { name: OcrMode; fn: () => Promise<string> }[] = [];

  if (isGuruPdfConfigured()) {
    attempts.push({ name: "gurupdf", fn: () => guruPdfOcrImages(dataUrls) });
  }
  if (isOpenAiConfigured()) {
    attempts.push({
      name: "openai",
      fn: async () =>
        (await aiTranscribeImages(VISION_TRANSCRIBE_SYSTEM_PROMPT, dataUrls, "openai")).text,
    });
  }
  if (isGeminiConfigured()) {
    attempts.push({
      name: "gemini",
      fn: async () =>
        (await aiTranscribeImages(VISION_TRANSCRIBE_SYSTEM_PROMPT, dataUrls, "gemini")).text,
    });
  }
  if (isClaudeConfigured()) {
    attempts.push({
      name: "claude",
      fn: async () =>
        (await aiTranscribeImages(VISION_TRANSCRIBE_SYSTEM_PROMPT, dataUrls, "claude")).text,
    });
  }
  attempts.push({ name: "tesseract", fn: () => ocrImages(dataUrls) });

  for (const attempt of attempts) {
    const result = await tryProvider(attempt.name, attempt.fn);
    if (result) return { rawText: result.text, ocrMode: result.mode };
  }

  const status = getOcrStatus();
  const hints: string[] = [];
  if (!status.openai && !status.gemini && !status.claude && !status.gurupdf) {
    hints.push(
      "Add OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY to .env for handwriting OCR.",
    );
  }
  hints.push("Use a clear photo of the notebook page (not a screen screenshot).");
  hints.push("Or paste the note text in the Scanned text box.");

  throw new ApiError(
    422,
    `Could not extract text from the image. ${hints.join(" ")}`,
    "OCR_EMPTY",
  );
}
