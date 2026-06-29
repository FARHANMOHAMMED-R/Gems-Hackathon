import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

async function extractPdfText(dataUrl: string): Promise<string> {
  const base64 = dataUrl.match(/^data:[^;]+;base64,(.+)$/s)?.[1];
  if (!base64) throw new Error("Invalid PDF data.");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim(),
    );
  }

  return pages.filter(Boolean).join("\n\n");
}

/** Extract text from uploaded PDFs in the browser (for offline blueprint generation). */
export async function extractUploadedText(dataUrls: string[]): Promise<string> {
  const parts: string[] = [];
  for (const url of dataUrls) {
    if (url.startsWith("data:application/pdf")) {
      const text = await extractPdfText(url);
      if (text) parts.push(text);
    }
  }
  return parts.join("\n\n--- page break ---\n\n");
}
