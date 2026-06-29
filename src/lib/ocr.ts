import Tesseract from "tesseract.js";

/** Convert a base64 data URL to a Buffer for OCR. */
function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/s);
  if (!match) throw new Error("Invalid image data URL.");
  return Buffer.from(match[1], "base64");
}

let workerPromise: ReturnType<typeof Tesseract.createWorker> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await Tesseract.createWorker("eng", 1, { logger: () => {} });
      await worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      });
      return worker;
    })();
  }
  return workerPromise;
}

/**
 * Extract text from scanned notebook/exam images using local Tesseract OCR.
 * Uses a reused worker and auto page segmentation for photos & screenshots.
 */
export async function ocrImages(dataUrls: string[]): Promise<string> {
  const worker = await getWorker();
  const parts: string[] = [];

  for (let i = 0; i < dataUrls.length; i++) {
    const buffer = dataUrlToBuffer(dataUrls[i]);
    const { data } = await worker.recognize(buffer);
    const text = data.text?.trim();
    if (text) parts.push(text);
  }

  return parts.join("\n\n--- page break ---\n\n");
}
