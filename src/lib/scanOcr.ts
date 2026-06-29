import { ApiError } from "./http";
import { isGuruPdfConfigured, guruPdfOcrImages } from "./gurupdfOcr";
import { isLlmConfigured, transcribeDocument } from "./llm";
import { ocrImages } from "./ocr";
import { VISION_TRANSCRIBE_SYSTEM_PROMPT } from "./prompts";

export type OcrMode = "pasted" | "gurupdf" | "openai" | "gemini" | "tesseract";

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/** Which OCR backends are available on this server. */
export function getOcrStatus() {
  return {
    openai: isLlmConfigured(),
    gurupdf: isGuruPdfConfigured(),
    gemini: isGeminiConfigured(),
    tesseract: true,
    recommended:
      isLlmConfigured() || isGeminiConfigured() || isGuruPdfConfigured()
        ? "ai"
        : "tesseract",
  };
}

async function transcribeWithGemini(dataUrls: string[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY not set.");

  const parts: { text?: string; inline_data?: { mime_type: string; data: string } }[] = [
    {
      text:
        "Transcribe all handwritten and printed text from these document images exactly as written. " +
        "Do not grade, summarize, or add commentary. Output only the raw transcribed text.",
    },
  ];

  for (const url of dataUrls) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) continue;
    parts.push({
      inline_data: { mime_type: match[1], data: match[2] },
    });
  }

  const model = process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0 },
      }),
    },
  );

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new ApiError(
      502,
      body.error?.message ?? `Gemini OCR failed (${res.status}).`,
      "GEMINI_OCR_FAILED",
    );
  }

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return text.trim();
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
 * Always attempts Tesseract last so notebook/exam uploads work offline.
 */
export async function digitizeScanImages(
  dataUrls: string[],
  _mode: "Exam Paper" | "Notebook",
): Promise<{ rawText: string; ocrMode: OcrMode }> {
  const attempts: { name: OcrMode; fn: () => Promise<string> }[] = [];

  if (isGuruPdfConfigured()) {
    attempts.push({ name: "gurupdf", fn: () => guruPdfOcrImages(dataUrls) });
  }
  if (isLlmConfigured()) {
    attempts.push({
      name: "openai",
      fn: () => transcribeDocument(VISION_TRANSCRIBE_SYSTEM_PROMPT, dataUrls),
    });
  }
  if (isGeminiConfigured()) {
    attempts.push({ name: "gemini", fn: () => transcribeWithGemini(dataUrls) });
  }
  attempts.push({ name: "tesseract", fn: () => ocrImages(dataUrls) });

  for (const attempt of attempts) {
    const result = await tryProvider(attempt.name, attempt.fn);
    if (result) return { rawText: result.text, ocrMode: result.mode };
  }

  const status = getOcrStatus();
  const hints: string[] = [];
  if (!status.openai && !status.gemini && !status.gurupdf) {
    hints.push(
      "Add OPENAI_API_KEY or GEMINI_API_KEY (free at ai.google.dev) to your backend .env for handwriting OCR.",
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
