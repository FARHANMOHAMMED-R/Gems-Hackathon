import { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import { api } from "../api/client";
import type { AiProvider, GradeLevel, ReadingProfile } from "../api/types";
import { GRADE_LEVELS, defaultGradeFromClass } from "../data/gradeLevels";
import {
  READING_PROFILES,
  READING_PROFILE_LABELS,
} from "../data/readingProfiles";
import { levelTextWithProvider } from "../lib/clientTextLeveler";
import { bootstrapGeminiFromEnv, persistGeminiKeyEverywhere } from "../lib/bootstrapGeminiAi";
import { friendlyAiErrorMessage, isAiQuotaError } from "../lib/aiErrors";
import { loadAssistantAiConfig } from "../lib/assistantAiConfig";
import {
  defaultTextLevelerProvider,
  persistTextLevelerCredentials,
  resolveTextLevelerCredentials,
  type TextLevelerCredentialSource,
  type TextLevelerCredentials,
} from "../lib/resolveTextLevelerCredentials";
import {
  clearTextLevelerAiConfig,
  loadTextLevelerAiConfig,
  saveTextLevelerAiConfig,
  TEXT_LEVELER_PROVIDER_HINTS,
  TEXT_LEVELER_PROVIDER_LABELS,
  TEXT_LEVELER_PROVIDER_PLACEHOLDERS,
  TEXT_LEVELER_PROVIDERS,
  type TextLevelerProvider,
} from "../lib/textLevelerAiConfig";
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

function credentialSourceLabel(source: TextLevelerCredentialSource): string {
  if (source === "assistant") return "using AI assistant key";
  if (source === "saved") return "saved key";
  if (source === "backend") return "using server AI";
  return "browser key";
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
  const savedAi = loadTextLevelerAiConfig();
  const [provider, setProvider] = useState<TextLevelerProvider>(
    savedAi?.provider ?? defaultTextLevelerProvider(),
  );
  const [apiKey, setApiKey] = useState(savedAi?.apiKey ?? "");
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [usedProvider, setUsedProvider] = useState<TextLevelerProvider | null>(null);
  const [credentialSource, setCredentialSource] = useState<TextLevelerCredentialSource | null>(null);
  const [backendProviders, setBackendProviders] = useState<
    { id: AiProvider; configured: boolean }[]
  >([]);

  const combinedText = [content, fileContext].filter(Boolean).join("\n\n");
  const totalWords = countWords(content, fileContext);
  const creds = resolveTextLevelerCredentials(provider, apiKey, backendProviders);
  const aiReady = Boolean(creds);
  const assistantKey = loadAssistantAiConfig();
  const assistantKeyReady =
    Boolean(assistantKey?.apiKey && assistantKey.apiKey.length >= 10);

  useEffect(() => {
    bootstrapGeminiFromEnv();
    api
      .getAiProviders()
      .then((res) =>
        setBackendProviders(
          res.providers.map((p) => ({ id: p.id, configured: p.configured })),
        ),
      )
      .catch(() => setBackendProviders([]));
  }, []);

  useEffect(() => {
    bootstrapGeminiFromEnv();
    const resolved = resolveTextLevelerCredentials(provider, apiKey, backendProviders);
    if (resolved?.apiKey && !apiKey.trim()) {
      setProvider(resolved.provider);
      setApiKey(resolved.apiKey);
      persistTextLevelerCredentials(resolved);
      setShowApiSettings(false);
    } else if (!apiKey.trim() && assistantKeyReady && assistantKey) {
      setProvider(assistantKey.provider);
      setApiKey(assistantKey.apiKey);
      saveTextLevelerAiConfig({ provider: assistantKey.provider, apiKey: assistantKey.apiKey });
      setShowApiSettings(false);
    } else if (resolved?.source === "backend") {
      setShowApiSettings(false);
    }
  }, [backendProviders]);

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

  async function levelTextWithCreds(
    creds: TextLevelerCredentials,
    text: string,
  ): Promise<{ markdown: string; mode: "ai" | "local" }> {
    if (creds.apiKey) {
      const markdown = await levelTextWithProvider(
        creds.provider,
        creds.apiKey,
        text,
        gradeLevel,
        readingProfile,
      );
      return { markdown, mode: "ai" };
    }

    const res = await api.differentiate({
      content: text,
      gradeLevel,
      readingProfile,
      provider: creds.provider,
    });
    if (res.analysisMode === "local") {
      throw new Error(
        "Server could not reach AI — paste a free Gemini key from aistudio.google.com/apikey below.",
      );
    }
    return { markdown: res.content, mode: res.analysisMode ?? "ai" };
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

    const resolved = resolveTextLevelerCredentials(provider, apiKey, backendProviders);
    if (!resolved) {
      setShowApiSettings(true);
      toast.error("Connect a Gemini key once below, then generate again.");
      return;
    }

    setLoading(true);
    setHtml(null);
    setAnalysisMode(null);
    setUsedProvider(null);
    setCredentialSource(null);
    setError(null);

    const text = combinedText.trim();
    persistTextLevelerCredentials(resolved);
    if (resolved.apiKey) {
      setProvider(resolved.provider);
      setApiKey(resolved.apiKey);
      setShowApiSettings(false);
    }

    let activeCreds = resolved;

    try {
      let result: { markdown: string; mode: "ai" | "local" };

      try {
        result = await levelTextWithCreds(activeCreds, text);
      } catch (firstErr) {
        if (!isAiQuotaError(firstErr)) throw firstErr;

        const alternate: TextLevelerProvider =
          activeCreds.provider === "openai" ? "gemini" : "openai";
        const altCreds = resolveTextLevelerCredentials(alternate, "", backendProviders);
        if (!altCreds || altCreds.provider === activeCreds.provider) throw firstErr;

        toast.info(`${TEXT_LEVELER_PROVIDER_LABELS[activeCreds.provider]} limit — trying ${TEXT_LEVELER_PROVIDER_LABELS[alternate]}…`);
        activeCreds = altCreds;
        persistTextLevelerCredentials(activeCreds);
        if (activeCreds.apiKey) {
          setProvider(activeCreds.provider);
          setApiKey(activeCreds.apiKey);
        }
        result = await levelTextWithCreds(activeCreds, text);
      }

      const rendered = await marked.parse(result.markdown);
      setPreviousHtml(html);
      setHtml(rendered);
      setResultGrade(gradeLevel);
      setAnalysisMode(result.mode);
      setUsedProvider(activeCreds.provider);
      setCredentialSource(activeCreds.source);
      toast.success(
        `Leveled for ${gradeLevel} with ${TEXT_LEVELER_PROVIDER_LABELS[activeCreds.provider]}.`,
      );
    } catch (err) {
      const msg = friendlyAiErrorMessage(err, resolved.provider);
      setError(msg);
      setShowApiSettings(true);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function useAssistantKey() {
    const assistant = loadAssistantAiConfig();
    if (!assistant?.apiKey || assistant.apiKey.length < 10) {
      toast.error("Set a key in the ✦ AI assistant first (bottom-right).");
      return;
    }
    if (assistant.provider !== "openai" && assistant.provider !== "gemini") {
      toast.error("AI assistant must use OpenAI or Gemini for Text Leveler.");
      return;
    }
    setProvider(assistant.provider);
    setApiKey(assistant.apiKey);
    saveTextLevelerAiConfig({ provider: assistant.provider, apiKey: assistant.apiKey });
    setShowApiSettings(false);
    toast.success(`Using ${TEXT_LEVELER_PROVIDER_LABELS[assistant.provider]} from AI assistant.`);
  }

  function saveAiKey() {
    const trimmed = apiKey.trim();
    if (trimmed.length < 10) {
      toast.error("Paste a valid API key.");
      return;
    }
    if (provider === "gemini") {
      persistGeminiKeyEverywhere(trimmed);
    } else {
      saveTextLevelerAiConfig({ provider, apiKey: trimmed });
    }
    setShowApiSettings(false);
    toast.success(`${TEXT_LEVELER_PROVIDER_LABELS[provider]} connected — all AI tools updated.`);
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

        {aiReady && !showApiSettings && (
          <p className="field-hint" style={{ color: "#059669", marginBottom: 12 }}>
            ✓ AI connected
            {creds?.apiKey
              ? ` (${TEXT_LEVELER_PROVIDER_LABELS[creds.provider]})`
              : " (server Gemini)"}
            {" — "}
            <button
              type="button"
              className="pro-email-link-btn"
              style={{ padding: 0, fontSize: "inherit" }}
              onClick={() => setShowApiSettings(true)}
            >
              Change key
            </button>
          </p>
        )}

        {!aiReady && !showApiSettings && (
          <p className="field-hint" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="pro-email-link-btn"
              style={{ padding: 0, fontSize: "inherit" }}
              onClick={() => setShowApiSettings(true)}
            >
              Connect Gemini for AI
            </button>
          </p>
        )}

        {showApiSettings && (
          <details className="ppt-ai-setup" open>
            <summary>AI API (one-time setup)</summary>
            <div className="text-leveler-key-box" style={{ marginTop: 10 }}>
              <Field label="AI provider">
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as TextLevelerProvider)}
                >
                    {TEXT_LEVELER_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {TEXT_LEVELER_PROVIDER_LABELS[p]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="API key" hint={TEXT_LEVELER_PROVIDER_HINTS[provider]}>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={TEXT_LEVELER_PROVIDER_PLACEHOLDERS[provider]}
                  autoComplete="off"
                />
              </Field>
              <div className="text-leveler-key-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={saveAiKey}>
                  Save key
                </button>
                {assistantKeyReady && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={useAssistantKey}>
                    Use assistant key
                  </button>
                )}
                {apiKey.trim().length >= 10 && (
                  <button
                    type="button"
                    className="pro-email-link-btn"
                    onClick={() => {
                      clearTextLevelerAiConfig();
                      setApiKey("");
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </details>
        )}

        <button
          type="button"
          className="pro-email-generate"
          onClick={() => void generate()}
          disabled={loading || !combinedText.trim()}
        >
          {loading ? "Generating…" : "✦ Generate with AI"}
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
                  📘 Shortened locally — add an API key for full rewrite
                </span>
              )}
              {analysisMode === "ai" && usedProvider && (
                <span className="pill pill-primary" style={{ marginBottom: 12, display: "inline-block" }}>
                  ✦ AI-leveled with {TEXT_LEVELER_PROVIDER_LABELS[usedProvider]}
                  {credentialSource ? ` (${credentialSourceLabel(credentialSource)})` : ""}
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
