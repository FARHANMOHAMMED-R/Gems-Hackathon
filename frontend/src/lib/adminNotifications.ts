import type { AdminNotification } from "../api/types";

const NOTIF_KEY = "gems-admin-notifications";
const DISMISSED_KEY = "gems-admin-notifications-dismissed";

function loadNotifications(): AdminNotification[] {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? (JSON.parse(raw) as AdminNotification[]) : [];
  } catch {
    return [];
  }
}

function saveNotifications(list: AdminNotification[]) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(list.slice(0, 50)));
}

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids].slice(-200)));
}

export function getLocalAdminNotifications(): AdminNotification[] {
  return loadNotifications();
}

export function addLocalAdminNotification(
  input: Omit<AdminNotification, "id" | "createdAt">,
): AdminNotification {
  const notification: AdminNotification = {
    ...input,
    id: `local-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  saveNotifications([notification, ...loadNotifications()]);
  return notification;
}

export function deleteLocalAdminNotification(id: string): void {
  saveNotifications(loadNotifications().filter((n) => n.id !== id));
}

export function getDismissedNotificationIds(): Set<string> {
  return loadDismissed();
}

export function dismissNotification(id: string): void {
  const next = loadDismissed();
  next.add(id);
  saveDismissed(next);
}

export function visibleNotifications(all: AdminNotification[]): AdminNotification[] {
  const dismissed = loadDismissed();
  return all.filter((n) => !dismissed.has(n.id));
}
