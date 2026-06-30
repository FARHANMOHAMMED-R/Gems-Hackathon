import { randomUUID } from "crypto";

const DEFAULT_GATEWAY =
  process.env.SKYWORK_GATEWAY_URL?.trim() || "https://api-tools.skywork.ai/theme-gateway";

export interface SkyworkPptInput {
  query: string;
  language?: string;
  reference?: string;
  apiKey: string;
  onProgress?: (message: string) => void;
}

export interface SkyworkPptResult {
  pptxBuffer: Buffer;
  outline: string;
  downloadUrl: string;
}

function unwrapPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  let data = obj.data ?? obj;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return {};
    }
  }
  return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
}

function phaseMessage(phase: string, data: Record<string, unknown>): string | null {
  if (phase === "outline") return "Generating outline…";
  if (phase === "outline_done") return "Outline complete.";
  if (phase === "slides") return "Building slides…";
  if (phase === "slides_page") return `Finished slide ${String(data.page_num ?? "")}`;
  if (phase === "slides_done") return "Slides ready — exporting PPTX…";
  if (phase === "export") {
    return data.status === "done" ? "Export complete." : "Exporting PPTX (2–5 min)…";
  }
  if (phase === "done") return "Saving presentation…";
  if (phase === "ping") {
    const progress = data.progress ?? "";
    const stage = data.stage ?? "";
    return stage ? `${progress}% — ${stage}` : `${progress}%`;
  }
  return phase ? `[${phase}]` : null;
}

async function parseSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (eventType: string, data: Record<string, unknown>) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let curEvent: string | null = null;
  let curData: string | null = null;

  const flush = () => {
    if (!curEvent || curData === null) return;
    try {
      const raw = curData ? JSON.parse(curData) : {};
      onEvent(curEvent, unwrapPayload(raw));
    } catch {
      onEvent(curEvent, {});
    }
    curEvent = null;
    curData = null;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.replace(/\r$/, "");
      if (trimmed === "") {
        flush();
        continue;
      }
      if (trimmed.startsWith("event:")) curEvent = trimmed.slice(6).trim();
      else if (trimmed.startsWith("data:")) curData = trimmed.slice(5).trim();
    }
  }
  flush();
}

export async function generateSkyworkPpt(input: SkyworkPptInput): Promise<SkyworkPptResult> {
  const apiKey = input.apiKey.trim();
  if (apiKey.length < 10) {
    throw new Error("Skywork API key is required.");
  }

  const sessionId = randomUUID().replace(/-/g, "_");
  const language = input.language?.trim() || "English";
  const url = `${DEFAULT_GATEWAY.replace(/\/$/, "")}/ppt_write_stream`;

  const payload: Record<string, unknown> = {
    query: input.query.trim(),
    language,
    source_platform: "",
  };
  if (input.reference?.trim()) payload.reference = input.reference.trim();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${apiKey}`,
      "Session-Id": sessionId,
      Language: language,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12 * 60 * 1000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      errText.slice(0, 400) || `Skywork request failed (${res.status}). Check your API key.`,
    );
  }

  if (!res.body) throw new Error("Skywork returned an empty stream.");

  let outline = "";
  let downloadUrl = "";

  await parseSseStream(res.body, (eventType, data) => {
    if (eventType === "phase") {
      const phase = String(data.phase ?? "");
      const msg = phaseMessage(phase, data);
      if (msg) input.onProgress?.(msg);
      if (phase === "outline_done" && typeof data.outline === "string") {
        outline = data.outline;
      }
    }

    if (eventType === "completionEvent" && data.phase === "done") {
      if (typeof data.download_url === "string") downloadUrl = data.download_url;
    }

    if (eventType === "error") {
      throw new Error(String(data.message ?? "Skywork generation failed."));
    }
  });

  if (!downloadUrl) {
    throw new Error("Skywork finished without a download link. Try again.");
  }

  input.onProgress?.("Downloading presentation…");
  const fileRes = await fetch(downloadUrl, { signal: AbortSignal.timeout(3 * 60 * 1000) });
  if (!fileRes.ok) {
    throw new Error(`Could not download PPTX (${fileRes.status}).`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  return {
    pptxBuffer: Buffer.from(arrayBuffer),
    outline,
    downloadUrl,
  };
}

export function buildSkyworkQuery(input: {
  grade: string;
  subject: string;
  topic: string;
  chapters: string;
  slideCount: number;
  classManaged: string;
  additionalNotes?: string;
}): string {
  return [
    `Create a professional ${input.slideCount}-slide lesson PowerPoint.`,
    `Grade: ${input.grade}`,
    `Subject: ${input.subject}`,
    `Class: ${input.classManaged}`,
    `Topic: ${input.topic}`,
    `Chapters / units to cover:\n${input.chapters}`,
    input.additionalNotes ? `Teacher notes: ${input.additionalNotes}` : "",
    "Use clear headings, bullet points, examples for students, and a recap slide.",
  ]
    .filter(Boolean)
    .join("\n");
}
