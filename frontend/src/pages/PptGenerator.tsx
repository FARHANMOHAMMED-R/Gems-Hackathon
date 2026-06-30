import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import type { AiProvider, AiProviderInfo, PptDeck, PptEngine, PptGenerateResponse } from "../api/types";
import {
  clearSkyworkPptApiKey,
  loadSkyworkPptApiKey,
  saveSkyworkPptApiKey,
  SKYWORK_PPT_KEY_URL,
  SKYWORK_PPT_PRODUCT_URL,
} from "../lib/pptAiConfig";
import { Card, EmptyState, ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology", "English", "Computer Science"];
const SKYWORK_TIMEOUT_MS = 12 * 60 * 1000;

function parseGrade(classManaged: string): string {
  const dash = classManaged.indexOf("-");
  return dash > 0 ? classManaged.slice(0, dash) : classManaged;
}

function providerLabel(id: AiProvider | "skywork"): string {
  if (id === "openai") return "ChatGPT";
  if (id === "gemini") return "Gemini";
  if (id === "skywork") return "Skywork AI";
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
  const [engine, setEngine] = useState<PptEngine>("gems");
  const [skyworkKey, setSkyworkKey] = useState(loadSkyworkPptApiKey);

  const [subject, setSubject] = useState("Physics");
  const [topic, setTopic] = useState("");
  const [chapters, setChapters] = useState("");
  const [slideCount, setSlideCount] = useState(10);
  const [additionalNotes, setAdditionalNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
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
  const useTemplate = engine === "gems" && configured.length === 0;
  const skyworkReady = skyworkKey.trim().length >= 10;

  function saveSkyworkKey() {
    const trimmed = skyworkKey.trim();
    if (trimmed.length < 10) {
      toast.error("Paste a valid Skywork API key.");
      return;
    }
    saveSkyworkPptApiKey(trimmed);
    toast.success("Skywork API key saved.");
  }

  async function generate() {
    if (!topic.trim() || !chapters.trim()) {
      toast.error("Enter a topic and chapters.");
      return;
    }

    if (engine === "skywork" && !skyworkReady) {
      toast.error("Add your Skywork API key below.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(engine === "skywork" ? "Connecting to Skywork AI… (5–10 min)" : null);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), SKYWORK_TIMEOUT_MS);

    try {
      const res = await api.generatePpt(
        {
          classManaged,
          grade,
          subject,
          topic: topic.trim(),
          chapters: chapters.trim(),
          slideCount,
          additionalNotes: additionalNotes.trim() || undefined,
          provider: engine === "gems" ? provider || undefined : undefined,
          engine,
          skyworkApiKey: engine === "skywork" ? skyworkKey.trim() : undefined,
        },
        controller.signal,
      );
      setResult(res);
      if (engine === "skywork") {
        saveSkyworkPptApiKey(skyworkKey.trim());
      }
      toast.success(
        res.analysisMode === "skywork"
          ? "Skywork presentation ready!"
          : res.analysisMode === "local"
            ? `Created ${res.slideCount} template slides.`
            : `Created ${res.slideCount} slides.`,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Skywork timed out after 12 minutes. Try fewer slides or try again.");
      } else if (err instanceof ApiError && err.isLlmNotConfigured) {
        setError("No AI key configured. Add OPENAI_API_KEY, GEMINI_API_KEY, or use Skywork AI.");
      } else {
        setError(err instanceof Error ? err.message : "Generation failed.");
      }
      toast.error("Could not generate PPT.");
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
      setProgress(null);
    }
  }

  function download() {
    if (!result) return;
    downloadBase64Pptx(result.pptxBase64, result.fileName);
    toast.success("Download started.");
  }

  return (
    <div className="grid grid-2">
      <Card
        title="PPT Generator"
        subtitle={
          engine === "skywork"
            ? `Skywork AI slides for Grade ${grade} (${classManaged})`
            : useTemplate
              ? `Lesson slides for Grade ${grade} (${classManaged})`
              : `AI lesson slides for Grade ${grade} (${classManaged})`
        }
      >
        <div className="field">
          <span className="field-label">Slide engine *</span>
          <div className="chip-group">
            <button
              type="button"
              className={`chip${engine === "gems" ? " active" : ""}`}
              onClick={() => setEngine("gems")}
            >
              Gems Assist
            </button>
            <button
              type="button"
              className={`chip${engine === "skywork" ? " active" : ""}`}
              onClick={() => setEngine("skywork")}
            >
              Skywork AI
            </button>
          </div>
          <p className="field-hint">
            {engine === "skywork"
              ? "Professional AI-designed decks via Skywork (5–10 min)."
              : "Fast slides via ChatGPT, Gemini, or Claude."}
          </p>
        </div>

        {engine === "skywork" && (
          <div className="text-leveler-key-box">
            <Field
              label="Skywork API key *"
              hint={
                <>
                  Get a free key at{" "}
                  <a href={SKYWORK_PPT_KEY_URL} target="_blank" rel="noreferrer">
                    skywork.ai API settings
                  </a>{" "}
                  — stored in this browser only.
                </>
              }
            >
              <input
                type="password"
                value={skyworkKey}
                onChange={(e) => setSkyworkKey(e.target.value)}
                placeholder="sk-… or your Skywork key"
                autoComplete="off"
              />
            </Field>
            <div className="text-leveler-key-actions">
              <button
                type="button"
                className="pro-email-generate"
                style={{ marginTop: 0, flex: 1 }}
                onClick={saveSkyworkKey}
                disabled={!skyworkReady}
              >
                Save Skywork key
              </button>
              {skyworkReady && (
                <button
                  type="button"
                  className="pro-email-link-btn"
                  onClick={() => {
                    clearSkyworkPptApiKey();
                    setSkyworkKey("");
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            <p className="field-hint" style={{ marginTop: 8, marginBottom: 0 }}>
              Powered by{" "}
              <a href={SKYWORK_PPT_PRODUCT_URL} target="_blank" rel="noreferrer">
                Skywork PPT Generator
              </a>
              . Generation usually takes 5–10 minutes — keep this tab open.
            </p>
          </div>
        )}

        {engine === "gems" && !useTemplate && (
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

        {engine === "gems" && useTemplate && (
          <details className="ppt-ai-setup">
            <summary>Enable AI-written slides (optional)</summary>
            <p className="muted">
              Add <code>GEMINI_API_KEY</code> from{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                Google AI Studio
              </a>
              , or <code>OPENAI_API_KEY</code> / <code>ANTHROPIC_API_KEY</code> to backend{" "}
              <code>.env</code>, then restart the server. Or switch to <strong>Skywork AI</strong>{" "}
              with a browser key.
            </p>
          </details>
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

        <button
          className="btn btn-primary btn-block"
          onClick={() => void generate()}
          disabled={loading || (engine === "skywork" && !skyworkReady)}
        >
          {loading
            ? engine === "skywork"
              ? "Skywork is building slides…"
              : "Generating slides…"
            : engine === "skywork"
              ? "Generate with Skywork AI"
              : "Generate PowerPoint"}
        </button>
      </Card>

      <Card title="Preview & download" subtitle=".pptx ready for class">
        {loading && (
          <Spinner
            label={
              progress ??
              (engine === "skywork"
                ? "Skywork AI is designing your deck — this can take 5–10 minutes…"
                : "AI is building your deck…")
            }
          />
        )}

        {error && !loading && <ErrorNote>{error}</ErrorNote>}

        {!loading && !error && !result && (
          <EmptyState
            icon="📊"
            title="No presentation yet"
            hint={
              engine === "skywork"
                ? "Add your Skywork key, fill in topic and chapters, then generate."
                : useTemplate
                  ? "Fill in topic and chapters, then generate a template deck."
                  : "Fill in topic and chapters, pick an AI, and generate."
            }
          />
        )}

        {result && !loading && (
          <div className="stack" style={{ gap: 16 }}>
            {result.analysisMode === "local" && (
              <div className="info-note subtle">Outline deck from your topic & chapters.</div>
            )}
            {result.analysisMode === "ai" && (
              <span className="pill pill-primary">
                Generated with {providerLabel(result.providerUsed as AiProvider)}
              </span>
            )}
            {result.analysisMode === "skywork" && (
              <span className="pill pill-primary">
                Generated with Skywork AI — download for full designed slides
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
