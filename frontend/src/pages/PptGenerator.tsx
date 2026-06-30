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
import {
  loadTextLevelerAiConfig,
  saveTextLevelerAiConfig,
  TEXT_LEVELER_PROVIDER_HINTS,
  TEXT_LEVELER_PROVIDER_LABELS,
  TEXT_LEVELER_PROVIDER_PLACEHOLDERS,
  TEXT_LEVELER_PROVIDERS,
  type TextLevelerProvider,
} from "../lib/textLevelerAiConfig";
import { loadAssistantAiConfig } from "../lib/assistantAiConfig";
import { bootstrapAiFromEnv, persistOpenAiKeyEverywhere, persistGeminiKeyEverywhere } from "../lib/bootstrapAiKeys";
import { friendlyAiErrorMessage, isAiQuotaError } from "../lib/aiErrors";
import { buildPptxBase64, deckFileName } from "../lib/buildPptx";
import { clientGeneratePptDeck } from "../lib/clientPptGenerator";
import {
  alternateTextLevelerProvider,
  defaultTextLevelerProvider,
  persistTextLevelerCredentials,
  resolveCredentialsForProvider,
  resolveTextLevelerCredentials,
  type TextLevelerCredentials,
} from "../lib/resolveTextLevelerCredentials";
import { resolveSkyworkApiKey } from "../lib/resolvePptCredentials";
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

  const savedGems = loadTextLevelerAiConfig();
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [provider, setProvider] = useState<TextLevelerProvider>(
    savedGems?.provider ?? defaultTextLevelerProvider(),
  );
  const [gemsApiKey, setGemsApiKey] = useState(savedGems?.apiKey ?? "");
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
  const [showApiSettings, setShowApiSettings] = useState(false);

  useEffect(() => {
    bootstrapAiFromEnv();
    api
      .getAiProviders()
      .then((res) => setProviders(res.providers))
      .catch(() => setProviders([]));
  }, []);

  const backendProviders = providers.map((p) => ({
    id: p.id,
    configured: p.configured,
  }));
  const gemsCreds = resolveTextLevelerCredentials(provider, gemsApiKey, backendProviders);
  const gemsAiReady = Boolean(gemsCreds);
  const skyworkResolved = resolveSkyworkApiKey(skyworkKey);
  const skyworkReady = Boolean(skyworkResolved);
  const formReady = topic.trim().length > 0 && chapters.trim().length > 0;

  useEffect(() => {
    bootstrapAiFromEnv();
    const resolved = resolveTextLevelerCredentials(provider, gemsApiKey, backendProviders);
    if (resolved?.apiKey && !gemsApiKey.trim()) {
      setProvider(resolved.provider);
      setGemsApiKey(resolved.apiKey);
      persistTextLevelerCredentials(resolved);
      setShowApiSettings(false);
    } else if (resolved?.source === "backend") {
      setShowApiSettings(false);
    }

    const sky = resolveSkyworkApiKey(skyworkKey);
    if (sky && !skyworkKey.trim()) setSkyworkKey(sky);
  }, [backendProviders]);

  function saveGemsKey() {
    const trimmed = gemsApiKey.trim();
    if (trimmed.length < 10) {
      toast.error("Paste a valid API key.");
      return;
    }
    if (provider === "openai") {
      persistOpenAiKeyEverywhere(trimmed);
    } else if (provider === "gemini") {
      persistGeminiKeyEverywhere(trimmed);
    } else {
      saveTextLevelerAiConfig({ provider, apiKey: trimmed });
    }
    setShowApiSettings(false);
    toast.success(`${TEXT_LEVELER_PROVIDER_LABELS[provider]} connected — all AI tools updated.`);
  }

  function useAssistantKey() {
    const assistant = loadAssistantAiConfig();
    if (!assistant?.apiKey || assistant.apiKey.length < 10) {
      toast.error("Set a key in the ✦ AI assistant first (bottom-right).");
      return;
    }
    if (assistant.provider !== "openai" && assistant.provider !== "gemini") {
      toast.error("Assistant must use OpenAI or Gemini.");
      return;
    }
    setProvider(assistant.provider);
    setGemsApiKey(assistant.apiKey);
    if (assistant.provider === "openai") {
      persistOpenAiKeyEverywhere(assistant.apiKey);
    } else if (assistant.provider === "gemini") {
      persistGeminiKeyEverywhere(assistant.apiKey);
    } else {
      saveTextLevelerAiConfig({ provider: assistant.provider, apiKey: assistant.apiKey });
    }
    setShowApiSettings(false);
    toast.success(`Using ${TEXT_LEVELER_PROVIDER_LABELS[assistant.provider]} from assistant.`);
  }

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

    if (engine === "skywork" && !skyworkResolved) {
      setShowApiSettings(true);
      toast.error("Skywork needs a one-time API key — paste it below, then generate again.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(engine === "skywork" ? "Connecting to Skywork AI… (5–10 min)" : null);

    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      engine === "skywork" ? SKYWORK_TIMEOUT_MS : 3 * 60 * 1000,
    );

    try {
      const creds = resolveTextLevelerCredentials(provider, gemsApiKey, backendProviders);
      const trimmedSkyworkKey = resolveSkyworkApiKey(skyworkKey) ?? "";

      if (engine === "gems" && creds?.apiKey) {
        let activeCreds = creds as TextLevelerCredentials & { apiKey: string };
        persistTextLevelerCredentials(activeCreds);
        setProvider(activeCreds.provider);
        setGemsApiKey(activeCreds.apiKey);
        setShowApiSettings(false);

        const deckInput = {
          classManaged,
          grade,
          subject,
          topic: topic.trim(),
          chapters: chapters.trim(),
          slideCount,
          additionalNotes: additionalNotes.trim() || undefined,
        };

        let deck;
        try {
          setProgress(`Calling ${TEXT_LEVELER_PROVIDER_LABELS[activeCreds.provider]}…`);
          deck = await clientGeneratePptDeck(activeCreds.provider, activeCreds.apiKey, deckInput);
        } catch (firstErr) {
          if (!isAiQuotaError(firstErr)) throw firstErr;

          const alternate = alternateTextLevelerProvider(activeCreds.provider);
          const altCreds = resolveCredentialsForProvider(alternate, "", backendProviders);
          if (!altCreds?.apiKey || altCreds.provider === activeCreds.provider) {
            setProvider(alternate);
            setGemsApiKey("");
            throw firstErr;
          }

          toast.info(
            `${TEXT_LEVELER_PROVIDER_LABELS[activeCreds.provider]} limit — trying ${TEXT_LEVELER_PROVIDER_LABELS[alternate]}…`,
          );
          activeCreds = { ...altCreds, apiKey: altCreds.apiKey };
          persistTextLevelerCredentials(activeCreds);
          setProvider(activeCreds.provider);
          setGemsApiKey(activeCreds.apiKey);
          setProgress(`Calling ${TEXT_LEVELER_PROVIDER_LABELS[activeCreds.provider]}…`);
          deck = await clientGeneratePptDeck(activeCreds.provider, activeCreds.apiKey, deckInput);
        }

        setProgress("Building PowerPoint file…");
        const pptxBase64 = await buildPptxBase64(deck);
        const fileName = deckFileName(deck, classManaged);

        setResult({
          deck,
          fileName,
          pptxBase64,
          analysisMode: "ai",
          providerUsed: activeCreds.provider,
          slideCount: deck.slides.length,
        });
        toast.success(`Created ${deck.slides.length} slides with ${TEXT_LEVELER_PROVIDER_LABELS[activeCreds.provider]}.`);
        return;
      }

      if (engine === "skywork" && trimmedSkyworkKey) {
        saveSkyworkPptApiKey(trimmedSkyworkKey);
      }

      const res = await api.generatePpt(
        {
          classManaged,
          grade,
          subject,
          topic: topic.trim(),
          chapters: chapters.trim(),
          slideCount,
          additionalNotes: additionalNotes.trim() || undefined,
          provider: engine === "gems" ? creds?.provider ?? provider : undefined,
          engine,
          skyworkApiKey: engine === "skywork" ? trimmedSkyworkKey || undefined : undefined,
          apiKey: engine === "gems" ? creds?.apiKey : undefined,
        },
        controller.signal,
      );
      setResult(res);
      if (engine === "skywork") {
        saveSkyworkPptApiKey(trimmedSkyworkKey);
      }
      if (res.analysisMode === "local" && engine === "gems" && !creds) {
        setShowApiSettings(true);
        toast.info("Add a Gemini or OpenAI key below for AI slides, or use the outline deck.");
      } else {
        setShowApiSettings(false);
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
        setError(
          engine === "skywork"
            ? "Skywork timed out after 12 minutes. Try again with fewer slides."
            : "Request timed out. Check your API key and try again.",
        );
      } else if (err instanceof ApiError && err.isLlmNotConfigured) {
        setError("Could not reach AI. Add a Gemini key below, or try again.");
        setShowApiSettings(true);
      } else {
        const msg = friendlyAiErrorMessage(err, provider);
        if (isAiQuotaError(err)) {
          setProvider(alternateTextLevelerProvider(provider));
          setGemsApiKey("");
        }
        setError(msg);
        setShowApiSettings(true);
      }
      toast.error(
        err instanceof ApiError && err.isLlmNotConfigured
          ? "Could not reach AI."
          : friendlyAiErrorMessage(err, provider),
      );
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
              ? "Professional designed decks (5–10 min)."
              : "Fast AI slides — fill topic below and click Generate."}
          </p>
        </div>

        {engine === "gems" && gemsAiReady && !showApiSettings && (
          <p className="field-hint" style={{ color: "#059669", marginBottom: 12 }}>
            ✓ AI connected
            {gemsCreds?.apiKey
              ? ` (${TEXT_LEVELER_PROVIDER_LABELS[gemsCreds.provider]})`
              : " (server AI)"}
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

        {engine === "skywork" && skyworkReady && !showApiSettings && (
          <p className="field-hint" style={{ color: "#059669", marginBottom: 12 }}>
            ✓ Skywork connected —{" "}
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

        {engine === "gems" && !gemsAiReady && !showApiSettings && (
          <p className="field-hint" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="pro-email-link-btn"
              style={{ padding: 0, fontSize: "inherit" }}
              onClick={() => setShowApiSettings(true)}
            >
              Connect Gemini or OpenAI for AI slides
            </button>
            {" "}(outline deck works without a key)
          </p>
        )}

        {showApiSettings && (
          <details className="ppt-ai-setup" open>
            <summary>{engine === "skywork" ? "Skywork API (one-time setup)" : "AI API (one-time setup)"}</summary>
            {engine === "gems" ? (
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
                    value={gemsApiKey}
                    onChange={(e) => setGemsApiKey(e.target.value)}
                    placeholder={TEXT_LEVELER_PROVIDER_PLACEHOLDERS[provider]}
                    autoComplete="off"
                  />
                </Field>
                <div className="text-leveler-key-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={saveGemsKey}>
                    Save key
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={useAssistantKey}>
                    Use assistant key
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-leveler-key-box" style={{ marginTop: 10 }}>
                <Field
                  label="Skywork API key"
                  hint={
                    <>
                      Free key at{" "}
                      <a href={SKYWORK_PPT_KEY_URL} target="_blank" rel="noreferrer">
                        skywork.ai API settings
                      </a>
                    </>
                  }
                >
                  <input
                    type="password"
                    value={skyworkKey}
                    onChange={(e) => setSkyworkKey(e.target.value)}
                    placeholder="Your Skywork key"
                    autoComplete="off"
                  />
                </Field>
                <div className="text-leveler-key-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={saveSkyworkKey}>
                    Save key
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
                  <a href={SKYWORK_PPT_PRODUCT_URL} target="_blank" rel="noreferrer">
                    Skywork PPT Generator
                  </a>{" "}
                  — keep tab open 5–10 min while generating.
                </p>
              </div>
            )}
          </details>
        )}

        <button
          className="btn btn-primary btn-block"
          onClick={() => void generate()}
          disabled={loading || !formReady}
        >
          {loading
            ? engine === "skywork"
              ? "Skywork is building slides…"
              : "Generating slides…"
            : engine === "skywork"
              ? "Generate with Skywork AI"
              : "✦ Generate with AI"}
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
            hint="Fill in topic and chapters on the left, then click Generate."
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
