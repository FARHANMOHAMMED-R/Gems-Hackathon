import type { TeacherChatMessage, TeacherProfile } from "../api/types";
import type { TeacherSession } from "./authSession";

const KEY = "gems-teacher-chat";

function load(): TeacherChatMessage[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TeacherChatMessage[]) : [];
  } catch {
    return [];
  }
}

function save(messages: TeacherChatMessage[]) {
  localStorage.setItem(KEY, JSON.stringify(messages.slice(-200)));
}

export function getLocalChatMessages(after?: string): TeacherChatMessage[] {
  const all = load();
  if (!after) return all;
  const t = new Date(after).getTime();
  return all.filter((m) => new Date(m.createdAt).getTime() > t);
}

export function appendLocalChatMessage(
  teacher: TeacherSession,
  body: string,
): TeacherChatMessage {
  const message: TeacherChatMessage = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    teacherId: teacher.id ?? teacher.email,
    teacherName: teacher.name,
    classManaged: teacher.classManaged,
    teacherEmail: teacher.email,
    body,
    createdAt: new Date().toISOString(),
  };
  save([...load(), message]);
  return message;
}

export function getLocalTeachers(self: TeacherSession): TeacherProfile[] {
  const seen = new Map<string, TeacherProfile>();
  for (const m of load()) {
    if (!seen.has(m.teacherEmail)) {
      seen.set(m.teacherEmail, {
        id: m.teacherId,
        name: m.teacherName,
        classManaged: m.classManaged,
        email: m.teacherEmail,
      });
    }
  }
  if (!seen.has(self.email)) {
    seen.set(self.email, {
      id: self.id ?? self.email,
      name: self.name,
      classManaged: self.classManaged,
      email: self.email,
    });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function deleteLocalChatMessage(id: string, email: string): boolean {
  const all = load();
  const target = all.find((m) => m.id === id);
  if (!target || target.teacherEmail !== email) return false;
  save(all.filter((m) => m.id !== id));
  return true;
}
