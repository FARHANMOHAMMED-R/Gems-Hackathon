import { PDFParse } from "pdf-parse";
import { ocrImages } from "./ocr";

function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/s);
  if (!match) throw new Error("Invalid file data URL.");
  return Buffer.from(match[1], "base64");
}

function isPdfDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith("data:application/pdf");
}

async function extractPdfText(dataUrl: string): Promise<string> {
  const buffer = dataUrlToBuffer(dataUrl);
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text?.trim() ?? "";
  } finally {
    await parser.destroy();
  }
}

/**
 * Extract plain text from uploaded exam files — PDF (text layer) or images (Tesseract OCR).
 */
export async function extractDocumentText(dataUrls: string[]): Promise<string> {
  const parts: string[] = [];

  for (const url of dataUrls) {
    if (isPdfDataUrl(url)) {
      const text = await extractPdfText(url);
      if (text) parts.push(text);
    } else {
      const ocrText = await ocrImages([url]);
      if (ocrText.trim()) parts.push(ocrText.trim());
    }
  }

  return parts.join("\n\n--- page break ---\n\n");
}
