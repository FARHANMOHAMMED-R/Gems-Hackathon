import { useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import type { ExamBlueprint, GenerateBlueprintResponse } from "../api/types";
import { extractUploadedText } from "../lib/extractDocumentText";
import { generateBlueprintLocally } from "../lib/localBlueprintGenerator";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function BlueprintView({ blueprint, localMode }: { blueprint: ExamBlueprint; localMode: boolean }) {
  return (
    <div className="blueprint-result">
      {localMode && (
        <div className="info-note" style={{ marginBottom: 12 }}>
          📋 Local blueprint — add <code>OPENAI_API_KEY</code> for full AI topic & Bloom's analysis.
        </div>
      )}

      <div className="blueprint-summary-card">
        <h3>{blueprint.examTitle}</h3>
        <div className="blueprint-stats">
          <span>
            <strong>{blueprint.totalMarks}</strong> total marks
          </span>
          {blueprint.durationMinutes != null && (
            <span>
              <strong>{blueprint.durationMinutes}</strong> min
            </span>
          )}
          <span>
            <strong>{blueprint.sections.reduce((n, s) => n + s.questions.length, 0)}</strong>{" "}
            questions
          </span>
        </div>
        <p className="muted">{blueprint.summary}</p>
      </div>

      <div className="grid grid-2 blueprint-charts">
        <Card title="Topic distribution" subtitle="Marks by unit / topic">
          {blueprint.topicDistribution.length === 0 ? (
            <p className="muted">No topics detected.</p>
          ) : (
            <table className="roster-table blueprint-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Qs</th>
                  <th>Marks</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {blueprint.topicDistribution.map((t) => (
                  <tr key={t.topic}>
                    <td>{t.topic}</td>
                    <td>{t.questionCount}</td>
                    <td>{t.marks}</td>
                    <td>
                      <div className="blueprint-bar-wrap">
                        <div className="blueprint-bar" style={{ width: `${t.percentage}%` }} />
                        <span>{t.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Cognitive levels" subtitle="Bloom's taxonomy breakdown">
          {blueprint.cognitiveDistribution.length === 0 ? (
            <p className="muted">No levels detected.</p>
          ) : (
            <table className="roster-table blueprint-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Marks</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {blueprint.cognitiveDistribution.map((c) => (
                  <tr key={c.level}>
                    <td>{c.level}</td>
                    <td>{c.marks}</td>
                    <td>
                      <div className="blueprint-bar-wrap">
                        <div
                          className="blueprint-bar cognitive"
                          style={{ width: `${c.percentage}%` }}
                        />
                        <span>{c.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {blueprint.sections.map((section) => (
        <Card
          key={section.name}
          title={section.name}
          subtitle={
            section.instructions ||
            `${section.questions.length} question(s) · ${section.sectionMarks} marks`
          }
        >
          {section.questions.length === 0 ? (
            <p className="muted">No questions parsed in this section.</p>
          ) : (
            <div className="roster-table-wrap">
              <table className="roster-table blueprint-table">
                <thead>
                  <tr>
                    <th>Q#</th>
                    <th>Marks</th>
                    <th>Type</th>
                    <th>Topic</th>
                    <th>Cognitive</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {section.questions.map((q) => (
                    <tr key={`${section.name}-${q.number}`}>
                      <td>{q.number}</td>
                      <td>{q.marks}</td>
                      <td>{q.questionType}</td>
                      <td>{q.topic}</td>
                      <td>
                        <span className={`bloom-tag bloom-${q.cognitiveLevel.toLowerCase()}`}>
                          {q.cognitiveLevel}
                        </span>
                      </td>
                      <td className="blueprint-desc">{q.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export function BlueprintGenerator() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");
  const [rawText, setRawText] = useState("");
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateBlueprintResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
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

  async function resolveExamText(): Promise<string> {
    const pasted = rawText.trim();
    if (pasted) return pasted;
    if (images.length === 0) return "";
    return extractUploadedText(images.map((i) => i.dataUrl));
  }

  async function runLocalBlueprint(text: string): Promise<GenerateBlueprintResponse> {
    const blueprint = generateBlueprintLocally(text, {
      subject: subject.trim() || undefined,
      examTitle: examTitle.trim() || undefined,
      durationMinutes: durationMinutes === "" ? undefined : Number(durationMinutes),
    });
    return { rawScannedText: text, analysisMode: "local", blueprint };
  }

  async function generate() {
    if (images.length === 0 && !rawText.trim()) {
      toast.error("Upload the exam paper or paste its text.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    const opts = {
      subject: subject.trim() || undefined,
      examTitle: examTitle.trim() || undefined,
      durationMinutes: durationMinutes === "" ? undefined : Number(durationMinutes),
      images: images.length ? images.map((i) => i.dataUrl) : undefined,
      rawScannedText: rawText.trim() || undefined,
    };

    try {
      const res = await api.generateBlueprint(opts);
      setResult(res);
      toast.success(
        res.analysisMode === "local" ? "Blueprint generated locally." : "Blueprint ready.",
      );
    } catch (err) {
      try {
        const text = await resolveExamText();
        if (!text.trim()) {
          const hint =
            err instanceof ApiError && err.status === 404
              ? "Backend route missing — restart the server (npm run dev). For PDF-only uploads, ensure the PDF has selectable text."
              : "Could not read text from the file. Try pasting the exam text, or use a PDF with selectable text (not a scanned image-only PDF).";
          throw new Error(hint);
        }
        const local = await runLocalBlueprint(text);
        setResult(local);
        toast.success("Blueprint generated from PDF locally.");
      } catch (fallbackErr) {
        const message =
          fallbackErr instanceof Error ? fallbackErr.message : "Blueprint generation failed.";
        setError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="blueprint-page">
      <div className="grid grid-2">
        <Card
          title="Blueprint Generator"
          subtitle="Upload an exam paper — get marks, topics & Bloom's breakdown"
        >
          <p className="muted" style={{ marginBottom: 16 }}>
            Upload a question paper (PDF/image) or paste text. The tool builds a CBSE-style blueprint
            showing section structure, mark distribution, topics, and cognitive levels.
          </p>

          <Field label="Subject">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Physics, Chemistry, Mathematics"
            />
          </Field>

          <Field label="Exam title (optional)">
            <input
              type="text"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="e.g. Unit Test 2 — Kinematics"
            />
          </Field>

          <Field label="Duration in minutes (optional)">
            <input
              type="number"
              min={1}
              max={600}
              value={durationMinutes}
              onChange={(e) =>
                setDurationMinutes(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="e.g. 180"
            />
          </Field>

          <div className="field">
            <span className="field-label">Exam paper (PDF or image)</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              multiple
              onChange={(e) => onFiles(e.target.files)}
            />
            <p className="field-hint">PDFs with selectable text work best. Scanned image-only PDFs may need pasted text.</p>
            {images.length > 0 && (
              <ul className="file-list">
                {images.map((img) => (
                  <li key={img.name}>
                    {img.name}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeImage(img.name)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Field label="Or paste exam text" hint="Question paper text only — not student answers">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Section A — Attempt all questions…&#10;1. Define velocity… [2 marks]&#10;2. Derive equations of motion… [5 marks]"
              rows={8}
            />
          </Field>

          <button type="button" className="btn btn-primary btn-block" onClick={generate} disabled={loading}>
            {loading ? "Analyzing paper…" : "Generate blueprint"}
          </button>
        </Card>

        <Card title="Blueprint output" subtitle="Structured exam analysis">
          {loading && <Spinner label="Building blueprint from exam paper…" />}
          {error && !loading && <ErrorNote>{error}</ErrorNote>}
          {!loading && !error && !result && (
            <EmptyState
              icon="📋"
              title="No blueprint yet"
              hint="Upload your exam paper and click Generate blueprint."
            />
          )}
          {result && !loading && (
            <BlueprintView
              blueprint={result.blueprint}
              localMode={result.analysisMode === "local"}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
