import { api } from "./client";
import type { AwardReason, AwardResponse, LeaderboardEntry, StudentRosterEntry } from "./types";
import {
  addLocalStudent,
  deleteLocalStudent,
  getLocalLeaderboard,
  getLocalRoster,
  updateLocalStudent,
  updateLocalTokens,
} from "../lib/classRoster";

/** Students for a class — API first, local roster if backend is down. */
export async function fetchClassStudents(
  classManaged: string,
): Promise<StudentRosterEntry[]> {
  try {
    const res = await api.listStudents(classManaged);
    if (res.students.length > 0) return res.students;
  } catch {
    /* fall through */
  }
  return getLocalRoster(classManaged);
}

/** Leaderboard for a class — API first, local tokens if backend is down. */
export async function fetchClassLeaderboard(
  classManaged: string,
): Promise<LeaderboardEntry[]> {
  try {
    const res = await api.getLeaderboard(classManaged);
    if (res.leaderboard.length > 0) return res.leaderboard;
  } catch {
    /* fall through */
  }
  const local = getLocalLeaderboard(classManaged);
  return local.map((s, i) => ({
    rank: i + 1,
    id: s.id,
    name: s.name,
    grade: s.grade,
    section: s.section,
    rollNumber: s.rollNumber,
    schoolId: s.schoolId,
    totalTokens: s.totalTokens,
  }));
}

/** Award points — API first, update local cache on failure. */
export async function awardClassPoints(
  classManaged: string,
  studentId: string,
  points: number,
  reason?: AwardReason,
): Promise<AwardResponse> {
  try {
    if (reason) return await api.awardToken(studentId, reason);
    return await api.awardPoints(studentId, points);
  } catch {
    updateLocalTokens(classManaged, studentId, points);
    const board = await fetchClassLeaderboard(classManaged);
    const student = board.find((s) => s.id === studentId);
    return {
      awarded: { reason: reason ?? "custom", amount: points },
      student: student
        ? { id: student.id, name: student.name, totalTokens: student.totalTokens }
        : { id: studentId, name: "Student", totalTokens: points },
      leaderboard: board,
    };
  }
}

export async function addClassStudent(
  classManaged: string,
  student: { name: string; rollNumber: string; schoolId: string },
): Promise<StudentRosterEntry> {
  try {
    const res = await api.addStudent({ classManaged, ...student });
    return res.student;
  } catch {
    return addLocalStudent(classManaged, student);
  }
}

export async function updateClassStudent(
  classManaged: string,
  studentId: string,
  updates: { name?: string; rollNumber?: string; schoolId?: string },
): Promise<StudentRosterEntry> {
  try {
    const res = await api.updateStudent(studentId, updates);
    return res.student;
  } catch {
    const updated = updateLocalStudent(classManaged, studentId, updates);
    if (!updated) throw new Error("Student not found.");
    return updated;
  }
}

export async function deleteClassStudent(
  classManaged: string,
  studentId: string,
): Promise<void> {
  try {
    await api.deleteStudent(studentId);
  } catch {
    const ok = deleteLocalStudent(classManaged, studentId);
    if (!ok) throw new Error("Student not found.");
  }
}
