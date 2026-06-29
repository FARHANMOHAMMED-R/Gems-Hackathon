import { ApiError } from "./http";

const DEFAULT_BASE = "https://gurupdf.com";
const POLL_MS = 2000;
const MAX_POLLS = 60;

export class GuruPdfConfigError extends Error {}

export function isGuruPdfConfigured(): boolean {
  return Boolean(process.env.GURUPDF_API_KEY?.trim());
}

function baseUrl(): string {
  return (process.env.GURUPDF_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
}

function apiKey(): string {
  const key = process.env.GURUPDF_API_KEY?.trim();
  if (!key) {
    throw new GuruPdfConfigError(
      "GURUPDF_API_KEY is not set. Get a free key at https://gurupdf.com/api (PDF Guru image-to-text).",
    );
  }
  return key;
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error("Invalid image data URL.");
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "image/tiff"
          ? "tiff"
          : mime === "image/bmp"
            ? "bmp"
            : "jpg";
  return { buffer, mime, ext };
}

interface ConversionSubmit {
  uuid: string;
  status: string;
}

async function guruFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey()}`);
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  return res;
}

async function submitConversion(
  slug: string,
  buffer: Buffer,
  mime: string,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.append("files[]", new Blob([buffer], { type: mime }), filename);

  const res = await guruFetch(`/api/v1/convert/${slug}`, {
    method: "POST",
    body: form,
  });

  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: { code?: string; message?: string };
    conversions?: ConversionSubmit[];
  };

  if (!res.ok) {
    const code = body.error?.code;
    if (res.status === 401 || code === "UNAUTHORIZED") {
      throw new ApiError(503, "Invalid GURUPDF_API_KEY.", "GURUPDF_AUTH_FAILED");
    }
    if (res.status === 402 || code === "INSUFFICIENT_CREDITS") {
      throw new ApiError(
        503,
        "PDF Guru (GuruPDF) credits exhausted. Top up at gurupdf.com or use pasted text.",
        "GURUPDF_NO_CREDITS",
      );
    }
    if (res.status === 429 || code === "RATE_LIMIT_EXCEEDED") {
      throw new ApiError(
        503,
        "PDF Guru OCR rate limit hit. Wait a minute and try again.",
        "GURUPDF_RATE_LIMIT",
      );
    }
    throw new ApiError(
      502,
      body.error?.message ?? `PDF Guru conversion failed (${res.status}).`,
      "GURUPDF_CONVERT_FAILED",
    );
  }

  const uuid = body.conversions?.[0]?.uuid;
  if (!uuid) {
    throw new ApiError(502, "PDF Guru did not return a conversion id.", "GURUPDF_CONVERT_FAILED");
  }
  return uuid;
}

async function waitForConversion(uuid: string): Promise<void> {
  for (let i = 0; i < MAX_POLLS; i++) {
    const res = await guruFetch(`/api/v1/conversions/${uuid}`);
    const body = (await res.json()) as { status?: string; error_message?: string };

    if (!res.ok) {
      throw new ApiError(502, "Could not poll PDF Guru conversion status.", "GURUPDF_POLL_FAILED");
    }

    if (body.status === "completed") return;
    if (body.status === "failed") {
      throw new ApiError(
        502,
        body.error_message ?? "PDF Guru OCR conversion failed.",
        "GURUPDF_OCR_FAILED",
      );
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  throw new ApiError(504, "PDF Guru OCR timed out. Try again with a smaller image.", "GURUPDF_TIMEOUT");
}

async function downloadConversion(uuid: string): Promise<Buffer> {
  const res = await guruFetch(`/api/v1/conversions/${uuid}/download`);
  if (!res.ok) {
    throw new ApiError(502, "Could not download PDF Guru conversion result.", "GURUPDF_DOWNLOAD_FAILED");
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Run one GuruPDF tool end-to-end and return the output bytes. */
async function runTool(
  slug: string,
  buffer: Buffer,
  mime: string,
  filename: string,
): Promise<Buffer> {
  const uuid = await submitConversion(slug, buffer, mime, filename);
  await waitForConversion(uuid);
  return downloadConversion(uuid);
}

/**
 * OCR a single notebook/exam image via PDF Guru (GuruPDF API).
 * Matches the pdfguru.com image-to-text flow: OCR the image, then extract plain text.
 */
async function ocrImageDataUrl(dataUrl: string, pageIndex: number): Promise<string> {
  const { buffer, mime, ext } = parseDataUrl(dataUrl);
  const filename = `scan-page-${pageIndex + 1}.${ext}`;

  // ocr-pdf accepts images directly and returns a searchable PDF.
  const searchablePdf = await runTool("ocr-pdf", buffer, mime, filename);

  const textBuffer = await runTool(
    "extract-text",
    searchablePdf,
    "application/pdf",
    `scan-page-${pageIndex + 1}.pdf`,
  );

  return textBuffer.toString("utf8").trim();
}

/**
 * Extract text from scanned images using PDF Guru / GuruPDF (image-to-text).
 * Requires GURUPDF_API_KEY — free tier available at https://gurupdf.com/api
 */
export async function guruPdfOcrImages(dataUrls: string[]): Promise<string> {
  if (!isGuruPdfConfigured()) {
    throw new GuruPdfConfigError(
      "GURUPDF_API_KEY is not set. Sign up at https://gurupdf.com/api for PDF Guru image-to-text.",
    );
  }

  const parts: string[] = [];
  for (let i = 0; i < dataUrls.length; i++) {
    const text = await ocrImageDataUrl(dataUrls[i], i);
    if (text) parts.push(text);
  }

  const combined = parts.join("\n\n--- page break ---\n\n");
  if (!combined.trim()) {
    throw new ApiError(
      422,
      "PDF Guru could not read any text from the image. Try a clearer photo or paste the text.",
      "GURUPDF_EMPTY_TEXT",
    );
  }
  return combined;
}
