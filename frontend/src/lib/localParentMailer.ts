import type { StudentRosterEntry } from "../api/types";

function messageFromSummary(summary: string): string {
  const raw = summary.trim();
  const stripped = raw
    .replace(/^(please\s+)?(make|write|draft|create|send)\s+(a\s+)?(mail|email|message)\s+(regarding|about|on|for)\s+/i, "")
    .replace(/^(regarding|about|on)\s+/i, "")
    .trim();
  const text = stripped || raw;
  const sentence = text.charAt(0).toUpperCase() + text.slice(1);
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

function tokenParagraph(name: string, totalTokens: number): string {
  if (totalTokens > 0) {
    return `${name} has earned ${totalTokens} classroom reward token${totalTokens === 1 ? "" : "s"} so far — a sign of positive participation and effort.`;
  }
  return `We are encouraging ${name} to stay engaged in class activities; reward tokens are awarded for participation, peer support, and kindness.`;
}

/** Draft a parent email in the browser when the backend has no API key. */
export function draftParentMailLocally(
  student: Pick<
    StudentRosterEntry,
    "name" | "grade" | "section" | "rollNumber" | "schoolId" | "totalTokens"
  >,
  teacherSummary: string,
): string {
  const classLabel = `${student.grade}-${student.section}`;
  const main = teacherSummary.trim()
    ? messageFromSummary(teacherSummary)
    : "I wanted to share a brief update on your child's progress in class.";

  return `Subject: Class ${classLabel} — Update for ${student.name}

Dear Parent/Guardian,

I hope this message finds you well. This note concerns ${student.name} (Roll ${student.rollNumber}, School ID ${student.schoolId}) in Class ${classLabel}.

${main}

${tokenParagraph(student.name, student.totalTokens)}

Please reply if you have any questions or would like to discuss ${student.name}'s progress further.

Warm regards,
Your Class ${classLabel} Teacher

---
*Drafted locally from your summary. Add OPENAI_API_KEY to the backend for fully AI-personalized emails.*`;
}

export function draftBatchMailsLocally(
  students: StudentRosterEntry[],
  teacherSummary: string,
  scope: "all" | "selected",
  selectedIds?: Set<string>,
  classManaged?: string,
) {
  const targets =
    scope === "all"
      ? students
      : students.filter((s) => selectedIds?.has(s.id));

  return targets.map((s) => {
    const body = draftParentMailLocally(s, teacherSummary);
    const classLabel = classManaged ?? `${s.grade}-${s.section}`;
    return {
      studentId: s.id,
      name: s.name,
      rollNumber: s.rollNumber,
      parentEmail: s.parentEmail ?? "",
      subject: `Class update for ${s.name} — ${classLabel}`,
      body,
      email: body,
    };
  });
}
