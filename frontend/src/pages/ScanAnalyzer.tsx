import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { fetchClassStudents } from "../api/classData";
import type { AnalyzeScanResponse, ScanMode, ScanOcrStatusResponse, StudentRosterEntry } from "../api/types";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const MODES: ScanMode[] = ["Exam Paper", "Notebook"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function ScanAnalyzer({ classManaged }: { classManaged: string }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [students, setStudents] = useState<StudentRosterEntry[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  const [mode, setMode] = useState<ScanMode>("Notebook");
  const [studentId, setStudentId] = useState("");
  const [markingScheme, setMarkingScheme] = useState("");
  const [rawText, setRawText] = useState("");
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeScanResponse | null>(null);
  const [llmDown, setLlmDown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<ScanOcrStatusResponse | null>(null);

  useEffect(() => {
    api.getScanOcrStatus().then(setOcrStatus).catch(() => setOcrStatus(null));
  }, []);

  useEffect(() => {
    setLoadingStudents(true);
    fetchClassStudents(classManaged)
      .then((students) => {
        setStudents(students);
        if (students[0]) setStudentId(students[0].id);
      })
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false));
  }, [classManaged]);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      const loaded = await Promise.all(
        Array.from(files).map(async (f) => ({
          name: f.name,
          dataUrl: await fileToDataUrl(f),
        })),
      );
      setImages((prev) => [...prev, ...loaded]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeImage(name: string) {
    setImages((prev) => prev.filter((i) => i.name !== name));
  }

  async function analyze() {
    if (!studentId) {
      toast.error("Select a student from your class roster.");
      return;
    }
    if (images.length === 0 && !rawText.trim()) {
      toast.error("Upload a notebook image or paste scanned text.");
      return;
    }
    setLoading(true);
    setResult(null);
    setLlmDown(false);
    setError(null);
    try {
      const res = await api.analyzeScan({
        mode,
        studentId,
        markingScheme: mode === "Exam Paper" ? markingScheme || undefined : undefined,
        images: images.length ? images.map((i) => i.dataUrl) : undefined,
        rawScannedText: rawText.trim() || undefined,
      });
      setResult(res);
      if (res.analysisMode === "local") {
        toast.success("Notebook analyzed locally (no API key needed).");
      } else {
        toast.success("Analysis complete.");
      }
    } catch (err) {
      if (err instanceof ApiError && err.isLlmNotConfigured) {
        setLlmDown(true);
      } else {
        setError(err instanceof Error ? err.message : "Analysis failed.");
        toast.error("Analysis failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  const selected = students.find((s) => s.id === studentId);
  const noAiOcr =
    ocrStatus &&
    !ocrStatus.openai &&
    !ocrStatus.gemini &&
    !ocrStatus.claude &&
    !ocrStatus.gurupdf;

  return (
    <div className="grid grid-2">
      <Card title="Notebook / Exam Analyzer" subtitle="Linked to your class roster">
        <div className="field">
          <span className="field-label">Mode</span>
          <div className="chip-group">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                className={`chip${mode === m ? " active" : ""}`}
                onClick={() => setMode(m)}
              >
                {m === "Exam Paper" ? "📄 Exam Paper" : "📓 Notebook"}
              </button>
            ))}
          </div>
          {mode === "Notebook" && (
            <span className="field-hint">
              Upload a clear photo of the notebook page (not a screen screenshot). Uses offline
              Tesseract by default; AI OCR is optional for better handwriting.
            </span>
          )}
          {noAiOcr && (
            <details className="ppt-ai-setup">
              <summary>Enable AI handwriting OCR (optional)</summary>
              <p className="muted">
                Add free <code>GEMINI_API_KEY</code> from{" "}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                  Google AI Studio
                </a>
                , or <code>OPENAI_API_KEY</code> / <code>ANTHROPIC_API_KEY</code> to backend{" "}
                <code>.env</code>, then restart the server.
              </p>
            </details>
          )}
          {mode === "Exam Paper" && (
            <span className="field-hint">
              Exam OCR uses PDF Guru or AI vision when keys are set. Paste text manually anytime.
            </span>
          )}
        </div>

        <Field label="Student" hint="Pick by name — roll no. and school ID are saved automatically.">
          {loadingStudents ? (
            <Spinner label="Loading class roster…" />
          ) : students.length === 0 ? (
            <p className="muted">No students in this class. Set up the roster first.</p>
          ) : (
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · Roll {s.rollNumber} · {s.schoolId}
                </option>
              ))}
            </select>
          )}
        </Field>

        {selected && (
          <p className="muted" style={{ marginTop: -8 }}>
            Grading for <strong>{selected.name}</strong> (Roll {selected.rollNumber})
          </p>
        )}

        {mode === "Exam Paper" && (
          <Field label="Marking scheme">
            <textarea
              value={markingScheme}
              onChange={(e) => setMarkingScheme(e.target.value)}
              placeholder="Q1: Newton's 2nd law (3 marks)…"
            />
          </Field>
        )}

        <Field label="Scanned text" hint="Or upload notebook images below.">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste OCR text from the student's notebook…"
          />
        </Field>

        <div className="field">
          <span className="field-label">Upload notebook / exam image</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => onFiles(e.target.files)}
          />
          {images.length > 0 && (
            <div className="chip-group" style={{ marginTop: 8 }}>
              {images.map((img) => (
                <span key={img.name} className="pill pill-primary">
                  🖼 {img.name}
                  <button
                    type="button"
                    onClick={() => removeImage(img.name)}
                    style={{ border: "none", background: "transparent", cursor: "pointer" }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          className="btn btn-primary btn-block"
          onClick={analyze}
          disabled={loading || !studentId || students.length === 0}
        >
          {loading ? "Analyzing…" : "Analyze & save to student"}
        </button>
      </Card>

      <Card title="Results" subtitle="Scores feed into parent mailer & records">
        {loading && (
          <Spinner
            label={
              images.length && !rawText.trim()
                ? "Reading notebook image & analyzing…"
                : "Analyzing notebook…"
            }
          />
        )}

        {llmDown && !loading && mode === "Exam Paper" && (
          <div className="info-note subtle">
            Exam grading needs an AI key in backend <code>.env</code>. Notebook mode works
            offline — switch to Notebook or add <code>GEMINI_API_KEY</code>.
          </div>
        )}
        {error && !loading && <ErrorNote>{error}</ErrorNote>}
        {!loading && !llmDown && !error && !result && (
          <EmptyState icon="📝" title="No analysis yet" hint="Select a student and submit a scan." />
        )}
        {result && !loading && (
          <div className="stack">
            {result.ocrMode === "openai" && (
              <span className="pill pill-primary">📝 OCR via OpenAI vision</span>
            )}
            {result.ocrMode === "gemini" && (
              <span className="pill pill-primary">📝 OCR via Google Gemini</span>
            )}
            {result.ocrMode === "claude" && (
              <span className="pill pill-primary">📝 OCR via Anthropic Claude</span>
            )}
            {result.ocrMode === "gurupdf" && (
              <span className="pill pill-primary">📝 OCR via PDF Guru image-to-text</span>
            )}
            {result.ocrMode === "tesseract" && (
              <span className="pill pill-primary">📝 OCR via local Tesseract</span>
            )}
            {result.analysisMode === "local" && (
              <span className="pill pill-primary">
                📓 Local notebook analysis (works without OpenAI)
              </span>
            )}
            <div>
              <div className="section-label">Score breakdown</div>
              <ScoreBreakdown scores={result.score_breakdown} />
            </div>
            <div>
              <div className="section-label">Feedback</div>
              <div className="text-block">{result.constructive_feedback}</div>
            </div>
            {result.concept_gaps?.length > 0 && (
              <div>
                <div className="section-label">Concept gaps</div>
                <div className="gap-list">
                  {result.concept_gaps.map((g, i) => (
                    <div key={i} className="gap-item">
                      <span aria-hidden>⚠</span>
                      <span>{g}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.recordId && (
              <span className="pill pill-success">✓ Saved to student record</span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function ScoreBreakdown({ scores }: { scores: Record<string, unknown> }) {
  const entries = Object.entries(scores ?? {});
  if (entries.length === 0) return <p className="muted">No scores returned.</p>;
  return (
    <div className="score-grid">
      {entries.map(([key, val]) => (
        <div key={key} className="score-cell">
          <div className="score-key">{key.replace(/_/g, " ")}</div>
          <div className="score-val">{String(val)}</div>
        </div>
      ))}
    </div>
  );
}
