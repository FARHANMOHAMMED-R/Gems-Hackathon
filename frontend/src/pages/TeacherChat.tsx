import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import type { TeacherChatMessage, TeacherProfile } from "../api/types";
import type { TeacherSession } from "../lib/authSession";
import {
  appendLocalChatMessage,
  deleteLocalChatMessage,
  getLocalChatMessages,
  getLocalTeachers,
} from "../lib/teacherChat";
import { Card, EmptyState, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mergeMessages(
  prev: TeacherChatMessage[],
  incoming: TeacherChatMessage[],
): TeacherChatMessage[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function TeacherChat({ teacher }: { teacher: TeacherSession }) {
  const toast = useToast();
  const [messages, setMessages] = useState<TeacherChatMessage[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [localMode, setLocalMode] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const loadTeachers = useCallback(async () => {
    try {
      const res = await api.listTeachers();
      setTeachers(res.teachers);
      setLocalMode(false);
    } catch {
      setTeachers(getLocalTeachers(teacher));
      setLocalMode(true);
    }
  }, [teacher]);

  const loadMessages = useCallback(
    async (initial = false) => {
      if (initial) setLoading(true);
      try {
        const after = initial ? undefined : latestRef.current ?? undefined;
        const res = await api.getChatMessages(after);
        if (res.messages.length > 0) {
          setMessages((prev) => mergeMessages(prev, res.messages));
          latestRef.current = res.messages[res.messages.length - 1]?.createdAt ?? latestRef.current;
        } else if (initial) {
          setMessages([]);
        }
        setLocalMode(false);
      } catch {
        const local = getLocalChatMessages(initial ? undefined : latestRef.current ?? undefined);
        if (local.length > 0) {
          setMessages((prev) => mergeMessages(prev, local));
          latestRef.current = local[local.length - 1]?.createdAt ?? latestRef.current;
        } else if (initial) {
          setMessages(getLocalChatMessages());
        }
        setTeachers(getLocalTeachers(teacher));
        setLocalMode(true);
      } finally {
        if (initial) setLoading(false);
      }
    },
    [teacher],
  );

  useEffect(() => {
    loadTeachers();
    loadMessages(true);
  }, [loadTeachers, loadMessages]);

  useEffect(() => {
    const id = window.setInterval(() => loadMessages(false), 4000);
    return () => window.clearInterval(id);
  }, [loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function send() {
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    try {
      const res = await api.sendChatMessage({
        email: teacher.email,
        name: teacher.name,
        classManaged: teacher.classManaged,
        body,
      });
      setMessages((prev) => mergeMessages(prev, [res.message]));
      latestRef.current = res.message.createdAt;
      setDraft("");
      setLocalMode(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        const msg = appendLocalChatMessage(teacher, body);
        setMessages((prev) => mergeMessages(prev, [msg]));
        latestRef.current = msg.createdAt;
        setTeachers(getLocalTeachers(teacher));
        setDraft("");
        setLocalMode(true);
        toast.success("Message saved locally — will sync when backend is online.");
      } else {
        toast.error(err instanceof Error ? err.message : "Could not send message.");
      }
    } finally {
      setSending(false);
    }
  }

  async function removeMessage(id: string) {
    try {
      await api.deleteChatMessage(id, teacher.email);
      setMessages((prev) => prev.filter((m) => m.id !== id));
    } catch {
      if (deleteLocalChatMessage(id, teacher.email)) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      } else {
        toast.error("Could not delete message.");
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending) send();
    }
  }

  return (
    <div className="grid grid-2 teacher-chat-layout">
      <Card
        title="Staff Lounge"
        subtitle="Chat with other teachers — substitutions, labs, class updates"
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => loadMessages(true)}>
            ↻ Refresh
          </button>
        }
      >
        {localMode && (
          <div className="info-note" style={{ marginBottom: 12 }}>
            💬 Local chat mode — messages sync when the backend is online.
          </div>
        )}

        <div className="chat-thread" ref={listRef}>
          {loading && (
            <div className="chat-center">
              <Spinner label="Loading messages…" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <EmptyState
              icon="💬"
              title="No messages yet"
              hint="Say hello to your colleagues — ask about lab slots or substitution cover."
            />
          )}

          {!loading &&
            messages.map((m) => {
              const mine = m.teacherEmail === teacher.email;
              return (
                <div
                  key={m.id}
                  className={`chat-bubble-wrap${mine ? " mine" : ""}`}
                >
                  <div className={`chat-bubble${mine ? " mine" : ""}`}>
                    <div className="chat-bubble-head">
                      <strong>{mine ? "You" : m.teacherName}</strong>
                      <span className="chat-meta">
                        Class {m.classManaged} · {formatTime(m.createdAt)}
                      </span>
                    </div>
                    <p className="chat-body">{m.body}</p>
                    {mine && (
                      <button
                        type="button"
                        className="chat-delete"
                        onClick={() => removeMessage(m.id)}
                        aria-label="Delete message"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message the staff lounge… (Enter to send, Shift+Enter for new line)"
            rows={3}
            maxLength={2000}
            disabled={sending}
          />
          <div className="chat-compose-foot">
            <span className="muted">{draft.length}/2000</span>
            <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim()}>
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Teachers online" subtitle={`${teachers.length} signed-in teacher(s)`}>
        {teachers.length === 0 ? (
          <EmptyState icon="👩‍🏫" title="Just you for now" hint="Other teachers appear after they sign in." />
        ) : (
          <ul className="chat-teacher-list">
            {teachers.map((t) => (
              <li key={t.email} className="chat-teacher-row">
                <span className="chat-teacher-avatar" aria-hidden>
                  {t.name.charAt(0).toUpperCase()}
                </span>
                <span>
                  <div className="chat-teacher-name">
                    {t.email === teacher.email ? `${t.name} (you)` : t.name}
                  </div>
                  <div className="chat-teacher-meta">Class {t.classManaged}</div>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          All teachers share one staff lounge. Use this to coordinate substitutions, lab bookings,
          and school announcements.
        </p>
      </Card>
    </div>
  );
}
