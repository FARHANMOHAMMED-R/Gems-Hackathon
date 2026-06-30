import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import {
  ASSISTANT_NAV_LABELS,
  isAssistantNavId,
  localAssistantAnswer,
} from "../lib/localAssistant";

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

export function AiAssistant({ teacherName, classManaged, onNavigate }: AiAssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: "assistant",
      content: `Hi ${teacherName.split(" ")[0] || "there"}! Ask me anything — general doubts or how to use Gems Assist.`,
    },
  ]);
  const [loading, setLoading] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom();
      window.setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open, messages, scrollToBottom]);

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

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await api.assistantChat({
        message: msg,
        history,
        teacherName,
        classManaged,
      });
      handleResult(res.reply.trim(), res.navigateTo);
    } catch (err) {
      const offline =
        err instanceof TypeError ||
        (err instanceof ApiError && (err.isLlmNotConfigured || err.status >= 502));

      if (offline) {
        const local = localAssistantAnswer(msg, { teacherName, classManaged });
        handleResult(local.reply, local.navigateTo);
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
              <span className="ai-assistant-sub">General help · app navigation</span>
            </div>
            <button
              type="button"
              className="ai-assistant-close"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
            >
              ×
            </button>
          </header>

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
