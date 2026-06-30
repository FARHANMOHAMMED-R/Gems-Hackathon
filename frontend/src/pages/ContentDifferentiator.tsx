import { useRef, useState } from "react";
import { marked } from "marked";
import { api } from "../api/client";
import type { GradeLevel, ReadingProfile } from "../api/types";
import { GRADE_LEVELS, defaultGradeFromClass } from "../data/gradeLevels";
import {
  READING_PROFILES,
  READING_PROFILE_LABELS,
} from "../data/readingProfiles";
import { clientGeminiLevelText, clientOpenAiLevelText } from "../lib/clientTextLeveler";
import {
  clearTextLevelerOpenAiKey,
  loadTextLevelerOpenAiKey,
  saveTextLevelerOpenAiKey,
} from "../lib/textLevelerAiConfig";
import { loadAssistantAiConfig } from "../lib/assistantAiConfig";
import { ErrorNote, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const WORD_LIMIT = 75000;

const EXEMPLAR = {
  gradeLevel: "6th grade" as GradeLevel,
  readingProfile: "None" as ReadingProfile,
  content: `Photosynthesis is the biochemical process by which green plants, algae, and some bacteria convert light energy—usually from the sun—into chemical energy stored in glucose. During this process, plants absorb carbon dioxide from the atmosphere and water from the soil. Using chlorophyll in their chloroplasts, they transform these raw materials into glucose and release oxygen as a byproduct. This process is fundamental to life on Earth because it forms the base of most food chains and replenishes atmospheric oxygen.`,
};

marked.setOptions({ breaks: true, gfm: true });

function countWords(...texts: string[]): number {
  return texts.reduce((sum, text) => {
    const n = text.trim() ? text.trim().split(/\s+/).length : 0;
    return sum + n;
  }, 0);
}

export function ContentDifferentiator({ classManaged }: { classManaged: string }) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(defaultGradeFromClass(classManaged));
  const [readingProfile, setReadingProfile] = useState<ReadingProfile>("None");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContext, setFileContext] = useState("");

  const [loading, setLoading] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [resultGrade, setResultGrade] = useState<GradeLevel | null>(null);
  const [analysisMode, setAnalysisMode] = useState<"ai" | "local" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previousHtml, setPreviousHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [openAiKey, setOpenAiKey] = useState(loadTextLevelerOpenAiKey);
  const [showKeyField, setShowKeyField] = useState(!loadTextLevelerOpenAiKey());

  const combinedText = [content, fileContext].filter(Boolean).join("\n\n");
  const totalWords = countWords(content, fileContext);
  const assistantConfig = loadAssistantAiConfig();
  const openAiReady = openAiKey.trim().length >= 10;
  const geminiReady =
    assistantConfig?.provider === "gemini" && assistantConfig.apiKey.trim().length >= 10;
  const aiReady = openAiReady || geminiReady;

  async function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const isText =
      file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name);

    if (!isText) {
      toast.error("Upload a text file (.txt, .md, .csv) for now.");
      e.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      setFileName(file.name);
      setFileContext(text.slice(0, 50000));
      toast.success(`Added ${file.name}.`);
    } catch {
      toast.error("Could not read that file.");
    }
    e.target.value = "";
  }

  function showExemplar() {
    setGradeLevel(EXEMPLAR.gradeLevel);
    setReadingProfile(EXEMPLAR.readingProfile);
    setContent(EXEMPLAR.content);
    setHtml(null);
    setError(null);
  }

  function undo() {
    if (!previousHtml) {
      toast.error("Nothing to undo.");
      return;
    }
    setHtml(previousHtml);
    setPreviousHtml(null);
    toast.success("Restored previous version.");
  }

  async function generate() {
    if (!combinedText.trim()) {
      toast.error("Paste the original text first.");
      return;
    }
    if (totalWords > WORD_LIMIT) {
      toast.error(`Keep content under ${WORD_LIMIT.toLocaleString()} words.`);
      return;
    }

    if (!aiReady) {
      setShowKeyField(true);
      toast.error("Add your OpenAI API key below to level text.");
      return;
    }

    setLoading(true);
    setHtml(null);
    setAnalysisMode(null);
    setError(null);

    const text = combinedText.trim();

    try {
      let markdown: string;
      let mode: "ai" | "local" = "ai";

      if (openAiReady) {
        markdown = await clientOpenAiLevelText(openAiKey.trim(), text, gradeLevel, readingProfile);
      } else if (geminiReady && assistantConfig) {
        markdown = await clientGeminiLevelText(
          assistantConfig.apiKey,
          text,
          gradeLevel,
          readingProfile,
        );
      } else {
        const res = await api.differentiate({
          content: text,
          gradeLevel,
          readingProfile,
          provider: "openai",
          apiKey: openAiKey.trim() || assistantConfig?.apiKey,
        });
        markdown = res.content;
        mode = res.analysisMode ?? "ai";
      }

      const rendered = await marked.parse(markdown);
      setPreviousHtml(html);
      setHtml(rendered);
      setResultGrade(gradeLevel);
      setAnalysisMode(mode);
      toast.success(`Leveled for ${gradeLevel} with AI.`);
    } catch (err) {
      try {
        const res = await api.differentiate({
          content: text,
          gradeLevel,
          readingProfile,
          provider: "openai",
          apiKey: openAiKey.trim(),
        });
        const rendered = await marked.parse(res.content);
        setPreviousHtml(html);
        setHtml(rendered);
        setResultGrade(gradeLevel);
        setAnalysisMode(res.analysisMode ?? "ai");
        toast.success(`Leveled for ${gradeLevel}.`);
      } catch (fallbackErr) {
        setError(
          fallbackErr instanceof Error
            ? fallbackErr.message
            : err instanceof Error
              ? err.message
              : "Generation failed.",
        );
        toast.error("Could not level text — check your OpenAI key.");
      }
    } finally {
      setLoading(false);
    }
  }

  function saveOpenAiKey() {
    const trimmed = openAiKey.trim();
    if (trimmed.length < 10) {
      toast.error("Paste a valid OpenAI API key.");
      return;
    }
    saveTextLevelerOpenAiKey(trimmed);
    setShowKeyField(false);
    toast.success("OpenAI key saved for Text Leveler.");
  }

  async function copyOutput() {
    if (!html) return;
    try {
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      await navigator.clipboard.writeText(tmp.textContent ?? "");
      setCopied(true);
      toast.success("Copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <div className="pro-email-page">
      <nav className="pro-email-crumb" aria-label="Breadcrumb">
        Teacher Tools <span aria-hidden>›</span> Text Leveler
      </nav>

      <div className="pro-email-card">
        <header className="pro-email-card-head">
          <div>
            <h2 className="pro-email-title">Text Leveler</h2>
            <p className="pro-email-desc">
              Level any text to adapt it to fit a student&apos;s reading level / skills.
            </p>
          </div>
          <div className="pro-email-head-actions">
            <button
              type="button"
              className="pro-email-icon-btn"
              onClick={undo}
              disabled={!previousHtml}
              title="Undo"
              aria-label="Undo"
            >
              ↶
            </button>
            <button type="button" className="pro-email-link-btn" onClick={showExemplar}>
              Show exemplar
            </button>
          </div>
        </header>

        <Field label="Grade level *">
          <select
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
          >
            {GRADE_LEVELS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Reading support profile"
          hint="Optional — for dyslexia, ADHD, ELL, or visual impairment adaptations."
        >
          <select
            value={readingProfile}
            onChange={(e) => setReadingProfile(e.target.value as ReadingProfile)}
          >
            {READING_PROFILES.map((p) => (
              <option key={p} value={p}>
                {READING_PROFILE_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Original Text *">
          <textarea
            className="pro-email-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste the original text here."
            rows={10}
          />
        </Field>

        <div className="pro-email-footer">
          <div className="pro-email-footer-left">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
              hidden
              onChange={onFilePick}
            />
            <button
              type="button"
              className="pro-email-file-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              + Add File ▾
            </button>
            {fileName && (
              <span className="pro-email-file-name">
                {fileName}
                <button
                  type="button"
                  className="pro-email-file-clear"
                  onClick={() => {
                    setFileName(null);
                    setFileContext("");
                  }}
                  aria-label="Remove file"
                >
                  ×
                </button>
              </span>
            )}
          </div>
          <span className="pro-email-wordcount">
            Total word limit: {totalWords.toLocaleString()}/{WORD_LIMIT.toLocaleString()}
          </span>
        </div>

        {(showKeyField || !openAiReady) && (
          <div className="text-leveler-key-box">
            <Field
              label="OpenAI API key *"
              hint="Required for real grade-level rewriting. Get one at platform.openai.com/api-keys — stored in this browser only."
            >
              <input
                type="password"
                value={openAiKey}
                onChange={(e) => setOpenAiKey(e.target.value)}
                placeholder="sk-…"
                autoComplete="off"
              />
            </Field>
            <div className="text-leveler-key-actions">
              <button
                type="button"
                className="pro-email-generate"
                style={{ marginTop: 0, flex: 1 }}
                onClick={saveOpenAiKey}
                disabled={openAiKey.trim().length < 10}
              >
                Save OpenAI key
              </button>
              {openAiReady && (
                <button
                  type="button"
                  className="pro-email-link-btn"
                  onClick={() => {
                    clearTextLevelerOpenAiKey();
                    setOpenAiKey("");
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )}

        {openAiReady && !showKeyField && (
          <p className="field-hint" style={{ color: "#059669" }}>
            ✓ OpenAI connected —{" "}
            <button
              type="button"
              className="pro-email-link-btn"
              style={{ padding: 0, fontSize: "inherit" }}
              onClick={() => setShowKeyField(true)}
            >
              Change key
            </button>
          </p>
        )}

        {!openAiReady && !showKeyField && (
          <button
            type="button"
            className="pro-email-link-btn"
            onClick={() => setShowKeyField(true)}
          >
            Add OpenAI API key
          </button>
        )}

        <button
          type="button"
          className="pro-email-generate"
          onClick={() => void generate()}
          disabled={loading || !combinedText.trim()}
        >
          {loading ? "Generating…" : "✦ Generate"}
        </button>
      </div>

      {(loading || html || error) && (
        <div className="pro-email-output">
          {loading && <Spinner label="Leveling text…" />}

          {error && !loading && <ErrorNote>{error}</ErrorNote>}

          {html && !loading && (
            <>
              <header className="pro-email-output-head">
                <h3>
                  Leveled text
                  {resultGrade ? ` · ${resultGrade}` : ""}
                </h3>
                <button type="button" className="pro-email-link-btn" onClick={() => void copyOutput()}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </header>
              {analysisMode === "local" && (
                <span className="pill pill-primary" style={{ marginBottom: 12, display: "inline-block" }}>
                  📘 Shortened locally — add OpenAI key for full rewrite
                </span>
              )}
              {analysisMode === "ai" && (
                <span className="pill pill-primary" style={{ marginBottom: 12, display: "inline-block" }}>
                  ✦ AI-leveled with OpenAI
                </span>
              )}
              <div className="markdown pro-email-body" dangerouslySetInnerHTML={{ __html: html }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
