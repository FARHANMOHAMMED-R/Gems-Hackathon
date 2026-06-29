export interface LectureNoteInput {
  timestampSeconds: number;
  text: string;
}

export interface TimelineEntry {
  timestampSeconds: number;
  timestampLabel: string;
  title: string;
  content: string;
  type: "transcript" | "note" | "topic";
}

export interface LectureAiOutput {
  summary: string;
  keyPoints: string[];
  timeline: Omit<TimelineEntry, "timestampLabel">[];
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function withLabels(
  entries: Omit<TimelineEntry, "timestampLabel">[],
): TimelineEntry[] {
  return entries
    .slice()
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds)
    .map((e) => ({
      ...e,
      timestampLabel: formatTimestamp(e.timestampSeconds),
    }));
}

/** Offline fallback when no transcription or AI is available. */
export function buildLocalLectureResult(opts: {
  title: string;
  subject: string;
  durationSeconds: number;
  transcript: string;
  notes: LectureNoteInput[];
}): { summary: string; keyPoints: string[]; timeline: TimelineEntry[] } {
  const timeline: Omit<TimelineEntry, "timestampLabel">[] = [];

  if (opts.transcript.trim()) {
    timeline.push({
      timestampSeconds: 0,
      title: "Lecture transcript",
      content: opts.transcript.trim(),
      type: "transcript",
    });
  }

  for (const note of opts.notes) {
    timeline.push({
      timestampSeconds: note.timestampSeconds,
      title: "Teacher note",
      content: note.text,
      type: "note",
    });
  }

  if (timeline.length === 0 && opts.durationSeconds > 0) {
    timeline.push({
      timestampSeconds: 0,
      title: opts.title || "Recorded lecture",
      content: "No transcript available. Add OPENAI_API_KEY or GEMINI_API_KEY for speech-to-text.",
      type: "topic",
    });
  }

  const noteTexts = opts.notes.map((n) => n.text).filter(Boolean);
  const summary =
    opts.transcript.trim().length > 40
      ? opts.transcript.trim().slice(0, 400) + (opts.transcript.length > 400 ? "…" : "")
      : noteTexts.length > 0
        ? `Lecture notes: ${noteTexts.join("; ")}`
        : `Recorded ${formatTimestamp(opts.durationSeconds)} lecture on ${opts.subject || "general topics"}. Enable AI keys for a full summary.`;

  const keyPoints =
    noteTexts.length > 0
      ? noteTexts.slice(0, 5)
      : opts.transcript
        ? opts.transcript
            .split(/[.!?]\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 20)
            .slice(0, 4)
        : ["Add teacher notes during recording for key takeaways."];

  return { summary, keyPoints, timeline: withLabels(timeline) };
}

export function normalizeTimeline(
  entries: Omit<TimelineEntry, "timestampLabel">[],
): TimelineEntry[] {
  return withLabels(entries);
}

export { formatTimestamp };
