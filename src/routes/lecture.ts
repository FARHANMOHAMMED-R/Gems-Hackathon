import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler, ApiError } from "../lib/http";
import { transcribeLectureAudio, isAudioTranscriptionConfigured } from "../lib/audioTranscribe";
import { aiCompleteJSON, isAnyAiConfigured, type AiProvider } from "../lib/aiProviders";
import {
  buildLocalLectureResult,
  normalizeTimeline,
  type LectureAiOutput,
  type LectureNoteInput,
  type TimelineEntry,
} from "../lib/localLectureProcessor";
import { fromJsonColumn, toJsonColumn } from "../lib/json";
import { LECTURE_TIMELINE_PROMPT } from "../lib/prompts";

export const lectureRouter = Router();

const noteSchema = z.object({
  timestampSeconds: z.coerce.number().min(0),
  text: z.string().trim().min(1),
});

const processSchema = z.object({
  classManaged: z.string().min(1),
  teacherEmail: z.string().trim().optional(),
  teacherName: z.string().trim().optional(),
  title: z.string().trim().min(1, "Enter a lecture title."),
  subject: z.string().trim().default(""),
  durationSeconds: z.coerce.number().int().min(0),
  audioBase64: z.string().min(1, "Recording is empty."),
  audioMimeType: z.string().trim().default("audio/webm"),
  notes: z.array(noteSchema).default([]),
  provider: z.enum(["openai", "gemini", "claude"]).optional(),
});

function serializeLecture(row: {
  id: string;
  classManaged: string;
  teacherEmail: string;
  teacherName: string;
  title: string;
  subject: string;
  durationSeconds: number;
  transcript: string;
  summary: string;
  keyPoints: string;
  timeline: string;
  notes: string;
  analysisMode: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    classManaged: row.classManaged,
    teacherEmail: row.teacherEmail,
    teacherName: row.teacherName,
    title: row.title,
    subject: row.subject,
    durationSeconds: row.durationSeconds,
    transcript: row.transcript,
    summary: row.summary,
    keyPoints: fromJsonColumn<string[]>(row.keyPoints, []),
    timeline: fromJsonColumn<TimelineEntry[]>(row.timeline, []),
    notes: fromJsonColumn<LectureNoteInput[]>(row.notes, []),
    analysisMode: row.analysisMode as "ai" | "local",
    createdAt: row.createdAt.toISOString(),
  };
}

lectureRouter.get(
  "/lectures/status",
  asyncHandler(async (_req, res) => {
    res.json({
      transcription: isAudioTranscriptionConfigured(),
      ai: isAnyAiConfigured(),
    });
  }),
);

lectureRouter.get(
  "/lectures",
  asyncHandler(async (req, res) => {
    const classManaged = z.string().min(1).parse(req.query.classManaged);
    const rows = await prisma.lectureRecording.findMany({
      where: { classManaged },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({
      classManaged,
      lectures: rows.map((r) => ({
        id: r.id,
        title: r.title,
        subject: r.subject,
        durationSeconds: r.durationSeconds,
        summary: r.summary.slice(0, 160),
        analysisMode: r.analysisMode,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  }),
);

lectureRouter.get(
  "/lectures/:id",
  asyncHandler(async (req, res) => {
    const row = await prisma.lectureRecording.findUnique({
      where: { id: req.params.id },
    });
    if (!row) throw new ApiError(404, "Lecture not found.");
    res.json(serializeLecture(row));
  }),
);

lectureRouter.post(
  "/lecture/process",
  asyncHandler(async (req, res) => {
    const body = processSchema.parse(req.body);
    const notes: LectureNoteInput[] = body.notes;

    const transcription = await transcribeLectureAudio(body.audioBase64, body.audioMimeType);
    const transcript = transcription.text;

    let summary: string;
    let keyPoints: string[];
    let timeline: TimelineEntry[];
    let analysisMode: "ai" | "local" = "local";
    let aiProviderUsed: AiProvider | "local" = "local";

    if (isAnyAiConfigured()) {
      const segmentBlock =
        transcription.segments.length > 0
          ? transcription.segments
              .map(
                (s) =>
                  `[${Math.floor(s.startSeconds)}s] ${s.text}`,
              )
              .join("\n")
          : "(no timed segments)";

      const notesBlock =
        notes.length > 0
          ? notes.map((n) => `[${n.timestampSeconds}s] ${n.text}`).join("\n")
          : "(none)";

      const { data, provider } = await aiCompleteJSON<LectureAiOutput>({
        provider: body.provider,
        systemPrompt: LECTURE_TIMELINE_PROMPT,
        userContent: [
          `Title: ${body.title}`,
          `Subject: ${body.subject || "General"}`,
          `Class: ${body.classManaged}`,
          `Duration: ${body.durationSeconds} seconds`,
          `Transcription provider: ${transcription.provider}`,
          `\nFull transcript:\n${transcript || "(empty — use teacher notes only)"}`,
          `\nTimed segments:\n${segmentBlock}`,
          `\nTeacher notes during recording:\n${notesBlock}`,
        ].join("\n"),
        temperature: 0.3,
      });

      summary = data.summary?.trim() || "";
      keyPoints = Array.isArray(data.keyPoints) ? data.keyPoints : [];
      timeline = normalizeTimeline(data.timeline ?? []);
      analysisMode = "ai";
      aiProviderUsed = provider;

      if (!summary) {
        const local = buildLocalLectureResult({
          title: body.title,
          subject: body.subject,
          durationSeconds: body.durationSeconds,
          transcript,
          notes,
        });
        summary = local.summary;
        keyPoints = local.keyPoints;
        timeline = local.timeline;
        analysisMode = "local";
      }
    } else {
      const local = buildLocalLectureResult({
        title: body.title,
        subject: body.subject,
        durationSeconds: body.durationSeconds,
        transcript,
        notes,
      });
      summary = local.summary;
      keyPoints = local.keyPoints;
      timeline = local.timeline;
    }

    const saved = await prisma.lectureRecording.create({
      data: {
        classManaged: body.classManaged,
        teacherEmail: body.teacherEmail ?? "",
        teacherName: body.teacherName ?? "",
        title: body.title,
        subject: body.subject,
        durationSeconds: body.durationSeconds,
        transcript,
        summary,
        keyPoints: toJsonColumn(keyPoints),
        timeline: toJsonColumn(timeline),
        notes: toJsonColumn(notes),
        analysisMode,
      },
    });

    res.json({
      ...serializeLecture(saved),
      transcriptionProvider: transcription.provider,
      aiProvider: analysisMode === "ai" ? aiProviderUsed : "local",
    });
  }),
);
