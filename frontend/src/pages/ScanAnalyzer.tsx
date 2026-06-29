import { useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import type { AnalyzeScanResponse, ScanMode } from "../api/types";
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

export function ScanAnalyzer() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<ScanMode>("Exam Paper");
  const [studentId, setStudentId] = useState("");
  const [markingScheme, setMarkingScheme] = useState("");
  const [rawText, setRawText] = useState("");
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeScanResponse | null>(null);
  const [llmDown, setLlmDown] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (images.length === 0 && !rawText.trim()) {
      toast.error("Provide scanned text or upload at least one image.");
      return;
    }
    setLoading(true);
    setResult(null);
    setLlmDown(false);
    setError(null);
    try {
      const res = await api.analyzeScan({
        mode,
        studentId: studentId.trim() || undefined,
        markingScheme: mode === "Exam Paper" ? markingScheme || undefined : undefined,
        images: images.length ? images.map((i) => i.dataUrl) : undefined,
        rawScannedText: rawText.trim() || undefined,
      });
      setResult(res);
      toast.success("Analysis complete.");
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

  return (
    <div className="grid grid-2">
      <Card title="Submit a Scan" subtitle="AI grading for exams and notebooks">
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
              Notebook mode scores Handwriting, Creativity & Content (5 each).
            </span>
          )}
        </div>

        <Field label="Student ID" hint="Optional — links the result to a student record.">
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. clxxxx… (from the leaderboard)"
          />
        </Field>

        {mode === "Exam Paper" && (
          <Field label="Marking scheme" hint="Answers / rubric to grade against.">
            <textarea
              value={markingScheme}
              onChange={(e) => setMarkingScheme(e.target.value)}
              placeholder={"Q1: Newton's 2nd law, F=ma (3 marks)\nQ2: Units must be consistent (4 marks)"}
            />
          </Field>
        )}

        <Field
          label="Scanned text"
          hint="Paste OCR'd / typed student text, or upload images below."
        >
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Q1: Newton's second law states F = ma…"
          />
        </Field>

        <div className="field">
          <span className="field-label">Image upload</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => onFiles(e.target.files)}
          />
          <span className="field-hint">
            Images are converted to base64 and sent as <code>images[]</code>.
          </span>
          {images.length > 0 && (
            <div className="chip-group" style={{ marginTop: 8 }}>
              {images.map((img) => (
                <span key={img.name} className="pill pill-primary">
                  🖼 {img.name}
                  <button
                    onClick={() => removeImage(img.name)}
                    aria-label={`Remove ${img.name}`}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 14,
                      color: "inherit",
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-primary btn-block" onClick={analyze} disabled={loading}>
          {loading ? "Analyzing…" : "Analyze scan"}
        </button>
      </Card>

      <Card title="Results" subtitle="Score breakdown, feedback & concept gaps">
        {loading && <Spinner label="Running the grading pipeline…" />}

        {llmDown && !loading && (
          <div className="info-note">
            The AI grader isn't configured on the backend (no{" "}
            <code>OPENAI_API_KEY</code>). Add a key to the backend{" "}
            <code>.env</code> and restart it to enable analysis.
          </div>
        )}

        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {!loading && !llmDown && !error && !result && (
          <EmptyState
            icon="📝"
            title="No analysis yet"
            hint="Fill in the form and run an analysis to see results here."
          />
        )}

        {result && !loading && (
          <div className="stack">
            <div>
              <div className="section-label">Score breakdown</div>
              <ScoreBreakdown scores={result.score_breakdown} />
            </div>

            <div>
              <div className="section-label">Constructive feedback</div>
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
              <span className="pill pill-success">
                ✓ Saved as record {result.recordId.slice(0, 8)}…
              </span>
            )}

            <details>
              <summary className="muted" style={{ cursor: "pointer" }}>
                View extracted text
              </summary>
              <div className="text-block" style={{ marginTop: 8 }}>
                {result.rawScannedText}
              </div>
            </details>
          </div>
        )}
      </Card>
    </div>
  );
}

function ScoreBreakdown({ scores }: { scores: Record<string, unknown> }) {
  const entries = Object.entries(scores ?? {});
  if (entries.length === 0) {
    return <p className="muted">No structured scores returned.</p>;
  }
  return (
    <div className="score-grid">
      {entries.map(([key, val]) => (
        <div key={key} className="score-cell">
          <div className="score-key">{key.replace(/_/g, " ")}</div>
          <div className="score-val">
            {typeof val === "object" ? JSON.stringify(val) : String(val)}
          </div>
        </div>
      ))}
    </div>
  );
}
