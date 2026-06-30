import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { localAssistantReply } from "../lib/localAssistant";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface AiAssistantProps {
  teacherName: string;
  classManaged?: string;
}

function getSpeechRecognition(): (new () => SpeechRecognition) | null {
  const w = window as Window & {
    webkitSpeechRecognition?: new () => SpeechRecognition;
    SpeechRecognition?: new () => SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AiAssistant({ teacherName, classManaged }: AiAssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: "assistant",
      content: `Hi ${teacherName.split(" ")[0] || "there"}! Ask me anything about Gems Assist — or tap the mic to speak.`,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis.cancel();
    };
  }, []);

  function speak(text: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput("");
    const userTurn: ChatTurn = { role: "user", content: msg };
    const history = [...messages, userTurn];
    setMessages(history);
    setLoading(true);

    try {
      const res = await api.assistantChat({
        message: msg,
        history: messages.filter((m) => m.role === "user" || m.role === "assistant"),
        teacherName,
        classManaged,
      });
      const reply = res.reply.trim();
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      speak(reply);
    } catch (err) {
      const offline =
        err instanceof TypeError ||
        (err instanceof ApiError && (err.isLlmNotConfigured || err.status >= 502));

      const reply = offline
        ? localAssistantReply(msg, { teacherName, classManaged })
        : err instanceof Error
          ? err.message
          : "Something went wrong.";

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (offline) speak(reply);
    } finally {
      setLoading(false);
    }
  }

  function toggleListen() {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const rec = new SpeechRecognitionCtor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-IN";
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setInput(transcript);
        void send(transcript);
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  const speechSupported = typeof window !== "undefined" && Boolean(getSpeechRecognition());

  return (
    <>
      {open && (
        <div className="ai-assistant-panel" role="dialog" aria-label="AI assistant">
          <header className="ai-assistant-head">
            <div>
              <strong>Gems Assist AI</strong>
              <span className="ai-assistant-sub">Ask doubts · voice supported</span>
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
              <div
                key={`${i}-${m.content.slice(0, 12)}`}
                className={`ai-assistant-bubble ai-assistant-bubble-${m.role}`}
              >
                {m.content}
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
              placeholder="Ask a question…"
              disabled={loading}
              aria-label="Message to AI assistant"
            />
            {speechSupported && (
              <button
                type="button"
                className={`ai-assistant-mic${listening ? " active" : ""}`}
                onClick={toggleListen}
                disabled={loading}
                title={listening ? "Stop listening" : "Speak your question"}
                aria-label={listening ? "Stop listening" : "Speak your question"}
              >
                {listening ? "⏹" : "🎤"}
              </button>
            )}
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
          {speaking && <p className="ai-assistant-speaking">Speaking…</p>}
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
