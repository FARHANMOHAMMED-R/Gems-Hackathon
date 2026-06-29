/**
 * Local class roster cache — used when the backend is offline so teachers
 * can still set up students and use scan/mailer/tokens UI.
 */

export interface LocalStudent {
  id: string;
  name: string;
  rollNumber: string;
  schoolId: string;
  grade: string;
  section: string;
  classManaged: string;
  totalTokens: number;
}

const KEY = "gems-class-roster";

function store(): Record<string, LocalStudent[]> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, LocalStudent[]>) : {};
  } catch {
    return {};
  }
}

function save(all: Record<string, LocalStudent[]>) {
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function parseClass(classManaged: string): { grade: string; section: string } {
  const dash = classManaged.indexOf("-");
  if (dash > 0) {
    return {
      grade: classManaged.slice(0, dash).trim(),
      section: classManaged.slice(dash + 1).trim(),
    };
  }
  return { grade: classManaged.trim(), section: "" };
}

export function getLocalRoster(classManaged: string): LocalStudent[] {
  return store()[classManaged] ?? [];
}

export function hasLocalRoster(classManaged: string): boolean {
  return getLocalRoster(classManaged).length > 0;
}

export function saveLocalRoster(
  classManaged: string,
  students: { name: string; rollNumber: string; schoolId: string }[],
): LocalStudent[] {
  const { grade, section } = parseClass(classManaged);
  const created: LocalStudent[] = students.map((s, i) => ({
    id: `local-${classManaged}-${s.rollNumber}-${i}`,
    name: s.name.trim(),
    rollNumber: s.rollNumber.trim(),
    schoolId: s.schoolId.trim(),
    grade,
    section,
    classManaged,
    totalTokens: 0,
  }));
  const all = store();
  all[classManaged] = created;
  save(all);
  return created;
}

export function updateLocalTokens(classManaged: string, studentId: string, delta: number) {
  const all = store();
  const list = all[classManaged];
  if (!list) return;
  all[classManaged] = list.map((s) =>
    s.id === studentId ? { ...s, totalTokens: s.totalTokens + delta } : s,
  );
  save(all);
}

export function getLocalLeaderboard(classManaged: string): LocalStudent[] {
  return [...getLocalRoster(classManaged)].sort(
    (a, b) => b.totalTokens - a.totalTokens || a.name.localeCompare(b.name),
  );
}

export function updateLocalStudent(
  classManaged: string,
  studentId: string,
  updates: { name?: string; rollNumber?: string; schoolId?: string },
): LocalStudent | null {
  const all = store();
  const list = all[classManaged];
  if (!list) return null;
  let updated: LocalStudent | null = null;
  all[classManaged] = list.map((s) => {
    if (s.id !== studentId) return s;
    updated = {
      ...s,
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.rollNumber !== undefined ? { rollNumber: updates.rollNumber.trim() } : {}),
      ...(updates.schoolId !== undefined ? { schoolId: updates.schoolId.trim() } : {}),
    };
    return updated;
  });
  if (!updated) return null;
  save(all);
  return updated;
}

export function deleteLocalStudent(classManaged: string, studentId: string): boolean {
  const all = store();
  const list = all[classManaged];
  if (!list) return false;
  const next = list.filter((s) => s.id !== studentId);
  if (next.length === list.length) return false;
  all[classManaged] = next;
  save(all);
  return true;
}

export function addLocalStudent(
  classManaged: string,
  student: { name: string; rollNumber: string; schoolId: string },
): LocalStudent {
  const { grade, section } = parseClass(classManaged);
  const entry: LocalStudent = {
    id: `local-${classManaged}-${student.rollNumber}-${Date.now()}`,
    name: student.name.trim(),
    rollNumber: student.rollNumber.trim(),
    schoolId: student.schoolId.trim(),
    grade,
    section,
    classManaged,
    totalTokens: 0,
  };
  const all = store();
  all[classManaged] = [...(all[classManaged] ?? []), entry];
  save(all);
  return entry;
}
