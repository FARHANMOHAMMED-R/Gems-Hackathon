import Tesseract from "tesseract.js";

/** Convert a base64 data URL to a Buffer for OCR. */
function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/s);
  if (!match) throw new Error("Invalid image data URL.");
  return Buffer.from(match[1], "base64");
}

/**
 * Extract text from scanned notebook/exam images using local Tesseract OCR.
 * Used when OPENAI_API_KEY is not set so teachers can still analyze notes.
 */
export async function ocrImages(dataUrls: string[]): Promise<string> {
  const parts: string[] = [];
  for (let i = 0; i < dataUrls.length; i++) {
    const buffer = dataUrlToBuffer(dataUrls[i]);
    const { data } = await Tesseract.recognize(buffer, "eng", {
      logger: () => {}, // suppress progress spam
    });
    const text = data.text?.trim();
    if (text) parts.push(text);
  }
  return parts.join("\n\n--- page break ---\n\n");
}
