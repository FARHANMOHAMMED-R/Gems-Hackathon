import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { isGeminiConfigured, isOpenAiConfigured } from "./aiProviders";

export interface TranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface AudioTranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
  provider: "openai" | "gemini" | "none";
}

function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
}

function whisperModel(): string {
  return process.env.WHISPER_MODEL?.trim() || "whisper-1";
}

function extensionForMime(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

async function transcribeWithOpenAi(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<AudioTranscriptionResult> {
  const client = getOpenAiClient();
  const ext = extensionForMime(mimeType);
  const file = await toFile(audioBuffer, `lecture.${ext}`, { type: mimeType });

  const res = await client.audio.transcriptions.create({
    file,
    model: whisperModel(),
    response_format: "verbose_json",
  });

  const verbose = res as {
    text?: string;
    segments?: { start: number; end: number; text: string }[];
  };

  const segments: TranscriptSegment[] = (verbose.segments ?? []).map((s) => ({
    startSeconds: s.start,
    endSeconds: s.end,
    text: s.text.trim(),
  }));

  return {
    text: (verbose.text ?? segments.map((s) => s.text).join(" ")).trim(),
    segments,
    provider: "openai",
  };
}

async function transcribeWithGemini(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<AudioTranscriptionResult> {
  const apiKey = process.env.GEMINI_API_KEY!.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  "Transcribe this classroom lecture audio verbatim. " +
                  "Return only the spoken transcript text, no commentary.",
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: audioBuffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    },
  );

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(body.error?.message ?? `Gemini audio transcription failed (${res.status}).`);
  }

  const text =
    body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";

  return { text, segments: [], provider: "gemini" };
}

/** Transcribe lecture audio (base64). Prefers OpenAI Whisper, then Gemini. */
export async function transcribeLectureAudio(
  audioBase64: string,
  mimeType: string,
): Promise<AudioTranscriptionResult> {
  const audioBuffer = Buffer.from(audioBase64, "base64");
  if (audioBuffer.length === 0) {
    return { text: "", segments: [], provider: "none" };
  }

  if (isOpenAiConfigured()) {
    return transcribeWithOpenAi(audioBuffer, mimeType);
  }
  if (isGeminiConfigured()) {
    return transcribeWithGemini(audioBuffer, mimeType);
  }

  return { text: "", segments: [], provider: "none" };
}

export function isAudioTranscriptionConfigured(): boolean {
  return isOpenAiConfigured() || isGeminiConfigured();
}
