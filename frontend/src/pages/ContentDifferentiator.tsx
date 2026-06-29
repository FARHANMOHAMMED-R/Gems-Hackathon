import { useState } from "react";
import { marked } from "marked";
import { api, ApiError } from "../api/client";
import type { DifferentiationTarget } from "../api/types";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const TARGETS: { value: DifferentiationTarget; icon: string; blurb: string }[] = [
  { value: "Advanced", icon: "🚀", blurb: "Stretch & challenge" },
  { value: "Standard", icon: "📘", blurb: "Grade-level baseline" },
  { value: "Simplified Visual", icon: "🖼", blurb: "Visual, simple language" },
  { value: "Neurodivergent", icon: "🧩", blurb: "Structured, low-distraction" },
];

marked.setOptions({ breaks: true, gfm: true });

export function ContentDifferentiator() {
  const toast = useToast();
  const [content, setContent] = useState("");
  const [target, setTarget] = useState<DifferentiationTarget>("Standard");
  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [resultTarget, setResultTarget] = useState<DifferentiationTarget | null>(null);
  const [analysisMode, setAnalysisMode] = useState<"ai" | "local" | null>(null);
  const [llmDown, setLlmDown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!content.trim()) {
      toast.error("Add some lesson content first.");
      return;
    }
    setLoading(true);
    setHtml(null);
    setAnalysisMode(null);
    setLlmDown(false);
    setError(null);
    try {
      const res = await api.differentiate({ content, target });
      const rendered = await marked.parse(res.content);
      setHtml(rendered);
      setResultTarget(res.target);
      setAnalysisMode(res.analysisMode ?? "ai");
      if (res.analysisMode === "local") {
        toast.success(`Adapted locally for ${res.target} (no API key needed).`);
      } else {
        toast.success(`Adapted for ${res.target}.`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.isLlmNotConfigured) {
        setLlmDown(true);
      } else {
        setError(err instanceof Error ? err.message : "Generation failed.");
        toast.error("Generation failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-2">
      <Card title="Lesson Content" subtitle="Paste a lesson, pick a learner profile">
        <Field label="Source content">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Photosynthesis is the process by which green plants…"
            style={{ minHeight: 200 }}
          />
        </Field>

        <div className="field">
          <span className="field-label">Target learner</span>
          <div className="chip-group">
            {TARGETS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`chip${target === t.value ? " active" : ""}`}
                onClick={() => setTarget(t.value)}
                title={t.blurb}
              >
                {t.icon} {t.value}
              </button>
            ))}
          </div>
          <span className="field-hint">
            {TARGETS.find((t) => t.value === target)?.blurb} — works without OpenAI key
            (local adaptation).
          </span>
        </div>

        <button className="btn btn-primary btn-block" onClick={generate} disabled={loading}>
          {loading ? "Adapting…" : "Differentiate content"}
        </button>
      </Card>

      <Card
        title="Adapted Lesson"
        subtitle={resultTarget ? `Rendered for ${resultTarget}` : "Markdown output"}
      >
        {loading && <Spinner label="Rewriting the lesson…" />}

        {llmDown && !loading && (
          <div className="info-note">
            The AI writer isn't configured on the backend (no{" "}
            <code>OPENAI_API_KEY</code>). Add a key to the backend{" "}
            <code>.env</code> and restart it to enable differentiation.
          </div>
        )}

        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {!loading && !llmDown && !error && !html && (
          <EmptyState
            icon="🎯"
            title="Nothing adapted yet"
            hint="Enter lesson content and choose a learner profile."
          />
        )}

        {html && !loading && (
          <>
            {analysisMode === "local" && (
              <span className="pill pill-primary" style={{ marginBottom: 12, display: "inline-block" }}>
                📘 Local adaptation — add OPENAI_API_KEY for full AI rewrite
              </span>
            )}
            <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
          </>
        )}
      </Card>
    </div>
  );
}
