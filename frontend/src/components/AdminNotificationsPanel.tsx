import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { AdminNotification } from "../api/types";
import {
  addLocalAdminNotification,
  deleteLocalAdminNotification,
  getLocalAdminNotifications,
} from "../lib/adminNotifications";
import { Card, EmptyState, Field, Spinner } from "../components/ui";
import { useToast } from "../components/Toast";

const PRIORITIES = [
  { value: "info" as const, label: "Info" },
  { value: "warning" as const, label: "Warning" },
  { value: "urgent" as const, label: "Urgent" },
];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminNotificationsPanel() {
  const toast = useToast();
  const [list, setList] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<AdminNotification["priority"]>("info");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listAdminNotifications();
      setList(res.notifications);
    } catch {
      setList(getLocalAdminNotifications());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      toast.error("Title and message are required.");
      return;
    }

    setSending(true);
    try {
      const res = await api.createAdminNotification({ title: t, body: b, priority });
      setList((prev) => [res.notification, ...prev]);
      setTitle("");
      setBody("");
      setPriority("info");
      toast.success("Notification sent to all teachers.");
    } catch {
      const local = addLocalAdminNotification({ title: t, body: b, priority });
      setList((prev) => [local, ...prev]);
      setTitle("");
      setBody("");
      toast.success("Saved locally — will broadcast when backend is online.");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteAdminNotification(id);
    } catch {
      deleteLocalAdminNotification(id);
    }
    setList((prev) => prev.filter((n) => n.id !== id));
    toast.success("Notification removed.");
  }

  return (
    <Card
      title="Teacher notifications"
      subtitle="Broadcast a notice — appears in every teacher's sidebar"
      className="admin-notif-card"
    >
      <form onSubmit={send} className="admin-notif-form">
        <Field label="Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. School closed tomorrow"
            maxLength={120}
          />
        </Field>
        <Field label="Message">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Details for all teachers…"
            rows={3}
            maxLength={1000}
          />
        </Field>
        <Field label="Priority">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as AdminNotification["priority"])}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <button type="submit" className="btn btn-primary" disabled={sending}>
          {sending ? "Sending…" : "Send to teachers"}
        </button>
      </form>

      <div className="admin-notif-sent">
        <h3 className="admin-notif-sent-title">Sent notices</h3>
        {loading && <Spinner label="Loading…" />}
        {!loading && list.length === 0 && (
          <EmptyState icon="📢" title="No notices yet" hint="Send your first announcement above." />
        )}
        {!loading && list.length > 0 && (
          <ul className="admin-notif-sent-list">
            {list.map((n) => (
              <li key={n.id} className={`admin-notif-sent-item priority-${n.priority}`}>
                <div className="admin-notif-sent-head">
                  <strong>{n.title}</strong>
                  <span className="muted">{formatWhen(n.createdAt)}</span>
                </div>
                <p>{n.body}</p>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(n.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
