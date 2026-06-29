import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import type { LectureDetail, LectureNote, LectureSummary } from "../api/types";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology", "English", "Computer Science"];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function timelineIcon(type: string): string {
  if (type === "note") return "📌";
  if (type === "topic") return "📚";
  return "🎙";
}

export function LectureRecorder({
  classManaged,
  teacherEmail,
  teacherName,
}: {
  classManaged: string;
  teacherEmail: string;
  teacherName: string;
}) {
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [status, setStatus] = useState<{ transcription: boolean; ai: boolean } | null>(null);

  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState<LectureNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LectureDetail | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [savedLectures, setSavedLectures] = useState<LectureSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const mimeRef = useRef("audio/webm");

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await api.listLectures(classManaged);
      setSavedLectures(res.lectures);
    } catch {
      setSavedLectures([]);
    } finally {
      setLoadingList(false);
    }
  }, [classManaged]);

  useEffect(() => {
    api.getLectureStatus().then(setStatus).catch(() => setStatus(null));
    loadList();
  }, [loadList]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function startRecording() {
    if (!title.trim()) {
      toast.error("Enter a lecture title before recording.");
      return;
    }

    setError(null);
    setResult(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      mimeRef.current = mime;

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      recorderRef.current = recorder;

      setRecording(true);
      setElapsed(0);
      setNotes([]);
      timerRef.current = window.setInterval(() => setElapsed((t) => t + 1), 1000);
      toast.success("Recording started.");
    } catch {
      toast.error("Microphone access denied or unavailable.");
    }
  }

  function addNote() {
    const text = noteDraft.trim();
    if (!text) return;
    if (!recording) {
      toast.error("Start recording before adding notes.");
      return;
    }
    setNotes((prev) => [...prev, { timestampSeconds: elapsed, text }]);
    setNoteDraft("");
    toast.success(`Note added at ${formatDuration(elapsed)}`);
  }

  async function stopAndProcess() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    setRecording(false);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const duration = elapsed;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    });

    const blob = new Blob(chunksRef.current, { type: mimeRef.current });
    if (blob.size === 0) {
      toast.error("Recording was empty.");
      return;
    }

    const url = URL.createObjectURL(blob);
    setAudioUrl(url);

    setProcessing(true);
    setError(null);

    try {
      const audioBase64 = await blobToBase64(blob);
      const res = await api.processLecture({
        classManaged,
        teacherEmail,
        teacherName,
        title: title.trim(),
        subject,
        durationSeconds: duration,
        audioBase64,
        audioMimeType: mimeRef.current,
        notes,
      });
      setResult(res);
      toast.success("Lecture processed — timeline ready.");
      loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not process lecture.");
      toast.error("Processing failed.");
    } finally {
      setProcessing(false);
    }
  }

  async function openSaved(id: string) {
    setProcessing(true);
    setError(null);
    try {
      const detail = await api.getLecture(id);
      setResult(detail);
      setTitle(detail.title);
      setSubject(detail.subject || "Physics");
      setAudioUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load lecture.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="lecture-recorder-layout">
      <div className="grid grid-2">
        <Card title="Lecture Recorder" subtitle={`Record & annotate · Class ${classManaged}`}>
          {status && !status.transcription && (
            <div className="info-note">
              Add <code>OPENAI_API_KEY</code> (Whisper) or <code>GEMINI_API_KEY</code> for
              speech-to-text. Notes and timeline still work without it.
            </div>
          )}

          <Field label="Lecture title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Newton's Laws — Period 3"
              disabled={recording}
            />
          </Field>

          <Field label="Subject">
            <select value={subject} onChange={(e) => setSubject(e.target.value)} disabled={recording}>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <div className="lecture-rec-controls">
            <div className={`lecture-timer${recording ? " recording" : ""}`}>
              {recording && <span className="rec-dot" />}
              {formatDuration(elapsed)}
            </div>

            {!recording ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={startRecording}
                disabled={processing}
              >
                🎙 Start recording
              </button>
            ) : (
              <button type="button" className="btn btn-danger" onClick={stopAndProcess}>
                ⏹ Stop & process
              </button>
            )}
          </div>

          <Field label="Add note at current time" hint="Pinned to the timeline at this timestamp">
            <div className="lecture-note-row">
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Key point, example, homework…"
                onKeyDown={(e) => e.key === "Enter" && addNote()}
                disabled={!recording}
              />
              <button type="button" className="btn btn-secondary" onClick={addNote} disabled={!recording}>
                + Note
              </button>
            </div>
          </Field>

          {notes.length > 0 && (
            <ul className="lecture-live-notes">
              {notes.map((n, i) => (
                <li key={i}>
                  <span className="muted">{formatDuration(n.timestampSeconds)}</span>
                  {n.text}
                </li>
              ))}
            </ul>
          )}

          {audioUrl && !processing && (
            <audio className="lecture-audio-player" controls src={audioUrl}>
              <track kind="captions" />
            </audio>
          )}

          {processing && <Spinner label="Transcribing & building AI timeline…" />}
          {error && !processing && <ErrorNote>{error}</ErrorNote>}
        </Card>

        <Card title="AI summary" subtitle="Generated after you stop recording">
          {!result && !processing && (
            <EmptyState
              icon="📝"
              title="No lecture processed yet"
              hint="Record a class, add notes as you go, then stop to get an AI summary and timeline."
            />
          )}

          {result && (
            <div className="stack" style={{ gap: 16 }}>
              {result.analysisMode === "ai" ? (
                <span className="pill pill-primary">✨ AI summary & timeline</span>
              ) : (
                <span className="pill pill-primary">📋 Local summary (add AI keys for full analysis)</span>
              )}

              <div>
                <div className="section-label">Summary</div>
                <p>{result.summary}</p>
              </div>

              {result.keyPoints.length > 0 && (
                <div>
                  <div className="section-label">Key points</div>
                  <ul className="lecture-key-points">
                    {result.keyPoints.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.transcript && (
                <details className="lecture-transcript-details">
                  <summary>Full transcript</summary>
                  <p className="muted">{result.transcript}</p>
                </details>
              )}
            </div>
          )}
        </Card>
      </div>

      {(result || notes.length > 0) && (
        <Card title="Timeline" subtitle="Notes + transcript segments in chronological order">
          {result && result.timeline.length > 0 ? (
            <ol className="lecture-timeline">
              {result.timeline.map((entry, i) => (
                <li key={i} className={`lecture-timeline-item type-${entry.type}`}>
                  <div className="lecture-timeline-marker">
                    <span className="lecture-timeline-time">{entry.timestampLabel}</span>
                    <span className="lecture-timeline-icon">{timelineIcon(entry.type)}</span>
                  </div>
                  <div className="lecture-timeline-body">
                    <strong>{entry.title}</strong>
                    <p>{entry.content}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon="⏱" title="Timeline appears after processing" hint="Stop the recording to generate the timeline." />
          )}
        </Card>
      )}

      <Card title="Saved lectures" subtitle="Previously recorded for this class">
        {loadingList && <Spinner label="Loading…" />}
        {!loadingList && savedLectures.length === 0 && (
          <EmptyState icon="🎧" title="No saved lectures" hint="Your processed recordings appear here." />
        )}
        {!loadingList && savedLectures.length > 0 && (
          <ul className="lecture-saved-list">
            {savedLectures.map((lec) => (
              <li key={lec.id}>
                <button type="button" className="lecture-saved-btn" onClick={() => openSaved(lec.id)}>
                  <div>
                    <strong>{lec.title}</strong>
                    <span className="muted">
                      {lec.subject} · {formatDuration(lec.durationSeconds)} ·{" "}
                      {new Date(lec.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="pill pill-primary">{lec.analysisMode === "ai" ? "AI" : "Local"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
