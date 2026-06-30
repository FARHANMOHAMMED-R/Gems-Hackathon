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
      return worker;
    })();
  }
  return workerPromise;
}

const PSM_MODES = [
  Tesseract.PSM.AUTO,
  Tesseract.PSM.SINGLE_BLOCK,
  Tesseract.PSM.SPARSE_TEXT,
  Tesseract.PSM.SINGLE_COLUMN,
] as const;

/**
 * Extract text from scanned notebook/exam images using local Tesseract OCR.
 * Tries several page layouts — works better on photos and screenshots.
 */
export async function ocrImages(dataUrls: string[]): Promise<string> {
  const worker = await getWorker();
  const parts: string[] = [];

  for (let i = 0; i < dataUrls.length; i++) {
    const buffer = dataUrlToBuffer(dataUrls[i]);
    let best = "";

    for (const psm of PSM_MODES) {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      const { data } = await worker.recognize(buffer);
      const text = data.text?.trim() ?? "";
      if (text.length > best.length) best = text;
      if (best.length >= 40) break;
    }

    if (best) parts.push(best);
  }

  return parts.join("\n\n--- page break ---\n\n");
}
