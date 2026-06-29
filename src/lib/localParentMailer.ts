/** Student fields needed to draft a parent email offline. */
export interface StudentMailInput {
  name: string;
  grade: string;
  section: string;
  rollNumber: string;
  schoolId: string;
  totalTokens: number;
  gradingRecords: {
    type: string;
    scores: string;
    aiFeedbackText: string;
    dateTimestamp: Date;
  }[];
}

/** Turn a free-form teacher prompt into email body text. */
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

function recordsParagraph(
  name: string,
  records: StudentMailInput["gradingRecords"],
): string {
  if (records.length === 0) return "";

  const lines = records.slice(0, 5).map((r) => {
    const when = r.dateTimestamp.toISOString().slice(0, 10);
    const detail = r.aiFeedbackText?.trim() || r.scores?.trim() || "recorded";
    return `• ${when} — ${r.type}: ${detail}`;
  });

  return `\n\nRecent work for ${name}:\n${lines.join("\n")}`;
}

/**
 * Draft a parent-update email without an LLM — uses the teacher summary as the
 * main message and appends student-specific token / grading context.
 */
export function draftParentMailLocally(
  student: StudentMailInput,
  teacherSummary?: string,
): string {
  const classLabel = `${student.grade}-${student.section}`;
  const main = teacherSummary?.trim()
    ? messageFromSummary(teacherSummary)
    : "I wanted to share a brief update on your child's progress in class.";

  const tokens = tokenParagraph(student.name, student.totalTokens);
  const records = recordsParagraph(student.name, student.gradingRecords);

  return `Subject: Class ${classLabel} — Update for ${student.name}

Dear Parent/Guardian,

I hope this message finds you well. This note concerns ${student.name} (Roll ${student.rollNumber}, School ID ${student.schoolId}) in Class ${classLabel}.

${main}

${tokens}${records}

Please reply if you have any questions or would like to discuss ${student.name}'s progress further.

Warm regards,
Your Class ${classLabel} Teacher

---
*Drafted locally from your summary. Add OPENAI_API_KEY to the backend for fully AI-personalized emails.*`;
}
