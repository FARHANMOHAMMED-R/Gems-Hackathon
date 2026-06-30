import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import type { AiProvider } from "../api/types";
import {
  ASSISTANT_NAV_LABELS,
  isAssistantNavId,
  localAssistantAnswer,
} from "../lib/localAssistant";
import {
  ASSISTANT_PROVIDER_HINTS,
  ASSISTANT_PROVIDER_LABELS,
  clearAssistantAiConfig,
  loadAssistantAiConfig,
  saveAssistantAiConfig,
  type AssistantAiProvider,
} from "../lib/assistantAiConfig";
import { fetchWikipediaAnswer, isGeneralKnowledgeQuestion } from "../lib/generalKnowledge";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  navigateTo?: string;
}

interface AiAssistantProps {
  teacherName: string;
  classManaged?: string;
  onNavigate: (pageId: string) => void;
}

function providerLabel(id: AiProvider | "local"): string {
  if (id === "openai") return "OpenAI";
  if (id === "gemini") return "Gemini";
  if (id === "claude") return "Claude";
  return "Offline";
}

export function AiAssistant({ teacherName, classManaged, onNavigate }: AiAssistantProps) {
  const saved = loadAssistantAiConfig();

  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: "assistant",
      content: `Hi ${teacherName.split(" ")[0] || "there"}! Ask me anything — history, science, or how to use Gems Assist.`,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<AssistantAiProvider>(saved?.provider ?? "gemini");
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? "");
  const [backendProviders, setBackendProviders] = useState<
    { id: AiProvider; configured: boolean }[]
  >([]);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const backendAiReady = backendProviders.some((p) => p.configured);
  const localKeyReady = apiKey.trim().length >= 10;
  const aiReady = backendAiReady || localKeyReady;

  const activeProviderLabel = (() => {
    if (backendAiReady) {
      const gemini = backendProviders.find((p) => p.id === "gemini" && p.configured);
      const openai = backendProviders.find((p) => p.id === "openai" && p.configured);
      if (localKeyReady) return ASSISTANT_PROVIDER_LABELS[provider];
      if (gemini) return "Gemini";
      if (openai) return "OpenAI";
      const any = backendProviders.find((p) => p.configured);
      return any ? providerLabel(any.id) : "AI";
    }
    return localKeyReady ? ASSISTANT_PROVIDER_LABELS[provider] : "Wikipedia";
  })();

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    api
      .getAiProviders()
      .then((res) =>
        setBackendProviders(
          res.providers.map((p) => ({ id: p.id, configured: p.configured })),
        ),
      )
      .catch(() => setBackendProviders([]));
  }, [open]);

  useEffect(() => {
    if (open) {
      scrollToBottom();
      window.setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, messages, scrollToBottom]);

  function saveKey() {
    const trimmed = apiKey.trim();
    if (trimmed.length < 10) return;
    saveAssistantAiConfig({ provider, apiKey: trimmed });
    setSettingsOpen(false);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `${ASSISTANT_PROVIDER_LABELS[provider]} is connected. Ask me anything!`,
      },
    ]);
  }

  function removeKey() {
    clearAssistantAiConfig();
    setApiKey("");
    setSettingsOpen(false);
  }

  function goToPage(pageId: string) {
    if (!isAssistantNavId(pageId)) return;
    onNavigate(pageId);
    setOpen(false);
  }

  function handleResult(reply: string, navigateTo?: string) {
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: reply, navigateTo },
    ]);

    if (navigateTo && isAssistantNavId(navigateTo)) {
      window.setTimeout(() => goToPage(navigateTo), 1400);
    }
  }

  async function tryFreeAnswer(msg: string): Promise<boolean> {
    const local = localAssistantAnswer(msg, { teacherName, classManaged });
    if (local.navigateTo) {
      handleResult(local.reply, local.navigateTo);
      return true;
    }
    if (isGeneralKnowledgeQuestion(msg)) {
      const wiki = await fetchWikipediaAnswer(msg);
      if (wiki) {
        handleResult(wiki);
        return true;
      }
    }
    if (!aiReady) {
      handleResult(local.reply);
      return true;
    }
    return false;
  }

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    if (!aiReady) {
      const answered = await tryFreeAnswer(msg);
      if (answered) {
        setLoading(false);
        return;
      }
    }

    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const chatProvider: AiProvider = localKeyReady
      ? provider
      : (backendProviders.find((p) => p.configured)?.id ?? provider);

    try {
      const res = await api.assistantChat({
        message: msg,
        history,
        teacherName,
        classManaged,
        provider: chatProvider,
        ...(localKeyReady ? { apiKey: apiKey.trim() } : {}),
      });
      handleResult(res.reply.trim(), res.navigateTo);
    } catch (err) {
      const offline =
        err instanceof TypeError ||
        (err instanceof ApiError && (err.isLlmNotConfigured || err.status >= 502));

      if (offline) {
        const local = localAssistantAnswer(msg, { teacherName, classManaged });
        if (local.navigateTo) {
          handleResult(local.reply, local.navigateTo);
        } else if (isGeneralKnowledgeQuestion(msg)) {
          const wiki = await fetchWikipediaAnswer(msg);
          handleResult(wiki ?? local.reply);
        } else {
          handleResult(local.reply);
        }
      } else {
        handleResult(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div className="ai-assistant-panel" role="dialog" aria-label="AI assistant">
          <header className="ai-assistant-head">
            <div>
              <strong>Gems Assist AI</strong>
              <span className="ai-assistant-sub">
                {aiReady
                  ? `${activeProviderLabel} · general & app help`
                  : "Free · Wikipedia & app help"}
              </span>
            </div>
            <div className="ai-assistant-head-actions">
              <button
                type="button"
                className="ai-assistant-gear"
                onClick={() => setSettingsOpen((s) => !s)}
                aria-label="AI settings"
                title="API key settings"
              >
                ⚙
              </button>
              <button
                type="button"
                className="ai-assistant-close"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
              >
                ×
              </button>
            </div>
          </header>

          {settingsOpen && (
            <div className="ai-assistant-settings">
              <p className="ai-assistant-settings-title">Connect Gemini or OpenAI</p>
              <label className="ai-assistant-settings-label">
                Provider
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as AssistantAiProvider)}
                >
                  <option value="gemini">Google Gemini (free)</option>
                  <option value="openai">OpenAI ChatGPT</option>
                </select>
              </label>
              <label className="ai-assistant-settings-label">
                API key
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key"
                  autoComplete="off"
                />
              </label>
              <p className="ai-assistant-settings-hint">
                {ASSISTANT_PROVIDER_HINTS[provider]}. Stored in this browser only.
              </p>
              {backendAiReady && (
                <p className="ai-assistant-settings-hint ai-assistant-settings-ok">
                  Backend .env also has a key — browser key overrides when saved.
                </p>
              )}
              <div className="ai-assistant-settings-actions">
                <button
                  type="button"
                  className="ai-assistant-settings-save"
                  onClick={saveKey}
                  disabled={apiKey.trim().length < 10}
                >
                  Save key
                </button>
                {localKeyReady && (
                  <button type="button" className="ai-assistant-settings-clear" onClick={removeKey}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

          {!aiReady && !settingsOpen && (
            <div className="ai-assistant-setup-banner ai-assistant-setup-banner-subtle">
              <p>
                Works free for history &amp; science questions. Tap ⚙ to optionally add Gemini for
                smarter answers.
              </p>
            </div>
          )}

          <div className="ai-assistant-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={`${i}-${m.content.slice(0, 12)}`}>
                <div className={`ai-assistant-bubble ai-assistant-bubble-${m.role}`}>
                  {m.content}
                </div>
                {m.navigateTo && isAssistantNavId(m.navigateTo) && (
                  <button
                    type="button"
                    className="ai-assistant-goto"
                    onClick={() => goToPage(m.navigateTo!)}
                  >
                    Open {ASSISTANT_NAV_LABELS[m.navigateTo]} →
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div className="ai-assistant-bubble ai-assistant-bubble-assistant ai-assistant-typing">
                Thinking…
              </div>
            )}
          </div>

          <footer className="ai-assistant-foot">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Type your question…"
              disabled={loading}
              aria-label="Message to AI assistant"
            />
            <button
              type="button"
              className="ai-assistant-send"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              ↑
            </button>
          </footer>
        </div>
      )}

      <button
        type="button"
        className={`ai-assistant-fab${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        title="AI Assistant"
      >
        {open ? "×" : "✦"}
      </button>
    </>
  );
}
