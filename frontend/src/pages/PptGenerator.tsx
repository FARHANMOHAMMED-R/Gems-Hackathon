import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import type { AiProvider, AiProviderInfo, PptDeck, PptGenerateResponse } from "../api/types";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology", "English", "Computer Science"];

function parseGrade(classManaged: string): string {
  const dash = classManaged.indexOf("-");
  return dash > 0 ? classManaged.slice(0, dash) : classManaged;
}

function providerLabel(id: AiProvider): string {
  if (id === "openai") return "ChatGPT";
  if (id === "gemini") return "Gemini";
  return "Claude";
}

function downloadBase64Pptx(base64: string, fileName: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function PptGenerator({ classManaged }: { classManaged: string }) {
  const toast = useToast();
  const grade = useMemo(() => parseGrade(classManaged), [classManaged]);

  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [provider, setProvider] = useState<AiProvider | "">("");

  const [subject, setSubject] = useState("Physics");
  const [topic, setTopic] = useState("");
  const [chapters, setChapters] = useState("");
  const [slideCount, setSlideCount] = useState(10);
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PptGenerateResponse | null>(null);

  useEffect(() => {
    api
      .getAiProviders()
      .then((res) => {
        setProviders(res.providers);
        const first = res.providers.find((p) => p.configured);
        if (first) setProvider(first.id);
      })
      .catch(() => setProviders([]));
  }, []);

  const configured = providers.filter((p) => p.configured);
  const useTemplate = configured.length === 0;

  async function generate() {
    if (!topic.trim() || !chapters.trim()) {
      toast.error("Enter a topic and chapters.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.generatePpt({
        classManaged,
        grade,
        subject,
        topic: topic.trim(),
        chapters: chapters.trim(),
        slideCount,
        additionalNotes: additionalNotes.trim() || undefined,
        provider: provider || undefined,
      });
      setResult(res);
      toast.success(
        res.analysisMode === "local"
          ? `Created ${res.slideCount} template slides.`
          : `Created ${res.slideCount} slides.`,
      );
    } catch (err) {
      if (err instanceof ApiError && err.isLlmNotConfigured) {
        setError("No AI key configured. Add OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY to .env.");
      } else {
        setError(err instanceof Error ? err.message : "Generation failed.");
      }
      toast.error("Could not generate PPT.");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!result) return;
    downloadBase64Pptx(result.pptxBase64, result.fileName);
    toast.success("Download started.");
  }

  return (
    <div className="grid grid-2">
      <Card title="PPT Generator" subtitle={`AI lesson slides for Grade ${grade} (${classManaged})`}>
        {useTemplate ? (
          <div className="info-note">
            <strong>Template mode</strong> — no AI key in backend <code>.env</code>, so slides use
            your topic & chapters as a structured outline. Still downloads a real{" "}
            <code>.pptx</code>.
            <br />
            <br />
            For AI-written slides, add a free key:
            <br />
            <code>GEMINI_API_KEY</code> at{" "}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              Google AI Studio
            </a>
            , or <code>OPENAI_API_KEY</code> / <code>ANTHROPIC_API_KEY</code> — then restart the
            backend.
          </div>
        ) : (
          <div className="field">
            <span className="field-label">AI provider</span>
            <div className="chip-group">
              {configured.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`chip${provider === p.id ? " active" : ""}`}
                  onClick={() => setProvider(p.id)}
                  title={p.textModel}
                >
                  {providerLabel(p.id)}
                </button>
              ))}
            </div>
          </div>
        )}

        {useTemplate && (
          <span className="pill pill-primary" style={{ marginBottom: 12, display: "inline-block" }}>
            📋 Template mode (offline)
          </span>
        )}

        <Field label="Subject">
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Lesson topic">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Newton's Laws of Motion"
          />
        </Field>

        <Field label="Chapters" hint="One per line or comma-separated">
          <textarea
            value={chapters}
            onChange={(e) => setChapters(e.target.value)}
            placeholder="Chapter 4: Laws of Motion&#10;Chapter 5: Work and Energy"
            rows={3}
          />
        </Field>

        <Field label="Number of slides" hint="4–25">
          <input
            type="number"
            min={4}
            max={25}
            value={slideCount}
            onChange={(e) =>
              setSlideCount(Math.min(25, Math.max(4, Number(e.target.value) || 10)))
            }
          />
        </Field>

        <Field label="Extra instructions (optional)">
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Include real-life examples, add a recap slide…"
            rows={2}
          />
        </Field>

        <button className="btn btn-primary btn-block" onClick={generate} disabled={loading}>
          {loading
            ? "Generating slides…"
            : useTemplate
              ? "Generate template PowerPoint"
              : "Generate PowerPoint"}
        </button>
      </Card>

      <Card title="Preview & download" subtitle=".pptx ready for class">
        {loading && <Spinner label="AI is building your deck…" />}

        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {!loading && !error && !result && (
          <EmptyState
            icon="📊"
            title="No presentation yet"
            hint={
              useTemplate
                ? "Fill in topic and chapters, then generate a template deck."
                : "Fill in topic and chapters, pick an AI, and generate."
            }
          />
        )}

        {result && !loading && (
          <div className="stack" style={{ gap: 16 }}>
            {result.analysisMode === "local" && (
              <div className="info-note">Template deck — add an AI key for custom slides.</div>
            )}
            {result.analysisMode === "ai" && (
              <span className="pill pill-primary">
                Generated with {providerLabel(result.providerUsed as AiProvider)}
              </span>
            )}

            <div>
              <div className="section-label">{result.deck.title}</div>
              <p className="muted">{result.deck.subtitle}</p>
            </div>

            <div className="ppt-slide-preview">
              {result.deck.slides.map((s, i) => (
                <SlidePreview key={i} slide={s} index={i + 1} />
              ))}
            </div>

            <button type="button" className="btn btn-primary btn-block" onClick={download}>
              ⬇ Download {result.fileName}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

function SlidePreview({ slide, index }: { slide: PptDeck["slides"][0]; index: number }) {
  return (
    <div className="ppt-preview-card">
      <div className="ppt-preview-head">
        <span className="muted">Slide {index}</span>
        <span className="pill pill-primary">{slide.layout}</span>
      </div>
      <strong>{slide.title}</strong>
      {slide.subtitle && <p className="muted">{slide.subtitle}</p>}
      {slide.bullets && (
        <ul className="ppt-preview-bullets">
          {slide.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {slide.body && <p>{slide.body}</p>}
    </div>
  );
}
