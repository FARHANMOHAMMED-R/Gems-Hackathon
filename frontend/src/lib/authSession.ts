const STORAGE_KEY = "gems-auth-session";

/** Hardcoded admin passcode for hackathon MVP (validated client-side and via X-Admin-Passcode header). */
export const ADMIN_PASSCODE = "farhan";

export interface TeacherSession {
  role: "teacher";
  id?: string;
  name: string;
  classManaged: string;
  email: string;
  signedInAt: string;
}

export interface AdminSession {
  role: "admin";
  signedInAt: string;
  name?: string;
}

export type AuthSession = TeacherSession | AdminSession;

export function isTeacherSession(session: AuthSession): session is TeacherSession {
  return session.role === "teacher";
}

export function isAdminSession(session: AuthSession): session is AdminSession {
  return session.role === "admin";
}

export function getAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed.role === "admin") {
      if (!parsed.signedInAt) return null;
      return parsed;
    }
    if (parsed.role === "teacher") {
      if (!parsed.name || !parsed.classManaged || !parsed.email) return null;
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// Back-compat aliases for teacher-specific call sites
export function getTeacherSession(): TeacherSession | null {
  const session = getAuthSession();
  return session && isTeacherSession(session) ? session : null;
}

export function setTeacherSession(session: Omit<TeacherSession, "role">): void {
  setAuthSession({ ...session, role: "teacher" });
}

export function clearTeacherSession(): void {
  clearAuthSession();
}
