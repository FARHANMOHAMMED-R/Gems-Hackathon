import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { AdminNotification } from "../api/types";
import {
  dismissNotification,
  getDismissedNotificationIds,
  getLocalAdminNotifications,
  visibleNotifications,
} from "../lib/adminNotifications";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const PRIORITY_ICON: Record<AdminNotification["priority"], string> = {
  info: "📢",
  warning: "⚠️",
  urgent: "🚨",
};

export function TeacherNotificationBox() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(() => getDismissedNotificationIds());

  const load = useCallback(async () => {
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications);
    } catch {
      setNotifications(getLocalAdminNotifications());
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
  }, [load]);

  const visible = visibleNotifications(notifications);
  const unreadCount = visible.length;

  function handleDismiss(id: string) {
    dismissNotification(id);
    const next = new Set(dismissedIds);
    next.add(id);
    setDismissedIds(next);
  }

  if (unreadCount === 0) return null;

  const preview = visible.slice(0, expanded ? 5 : 1);

  return (
    <div className="teacher-notif-box" role="region" aria-label="Admin notifications">
      <button
        type="button"
        className="teacher-notif-head"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="teacher-notif-bell" aria-hidden>
          🔔
        </span>
        <span className="teacher-notif-label">
          Admin notice{unreadCount > 1 ? "s" : ""}
        </span>
        <span className="teacher-notif-badge">{unreadCount}</span>
        <span className="teacher-notif-chevron" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      <ul className="teacher-notif-list">
        {preview.map((n) => (
          <li
            key={n.id}
            className={`teacher-notif-item priority-${n.priority}`}
          >
            <div className="teacher-notif-item-head">
              <span aria-hidden>{PRIORITY_ICON[n.priority]}</span>
              <strong>{n.title}</strong>
              <span className="teacher-notif-time">{formatWhen(n.createdAt)}</span>
            </div>
            <p className="teacher-notif-body">{n.body}</p>
            <button
              type="button"
              className="teacher-notif-dismiss"
              onClick={() => handleDismiss(n.id)}
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>

      {!expanded && unreadCount > 1 && (
        <button
          type="button"
          className="teacher-notif-more"
          onClick={() => setExpanded(true)}
        >
          +{unreadCount - 1} more
        </button>
      )}
    </div>
  );
}
